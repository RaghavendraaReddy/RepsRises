import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { readFile, realpath } from 'node:fs/promises';
import { join, resolve, extname, sep } from 'node:path';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { gzipSync } from 'node:zlib';
import { APP_VERSION, isCoachRequest, LIMITS, type CoachReply, type CoachRequest, type CoachResult } from '../shared/coach/contracts.js';
import { offlineCoach } from '../shared/coach/offline.js';
import { redactValue } from '../shared/redact.js';
import { defaultProvider, providerStatuses, type Config } from './config.js';
import { PublicError } from './errors.js';
import { loadInstructions } from './prompt.js';
import { anthropicTurn, type AnthropicClient } from './providers/anthropic.js';
import { claudeTurn } from './providers/claude-cli.js';
import { codexTurn } from './providers/codex-cli.js';
import { openaiTurn } from './providers/openai.js';
import type { ProcessTransport } from './subprocess.js';
export { readConfig } from './config.js';

const CSP = "default-src 'self'; script-src 'self'; style-src 'self'; font-src 'self'; img-src 'self' data:; connect-src 'self'; manifest-src 'self'; media-src 'none'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'";
const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'Content-Security-Policy': CSP, 'X-Frame-Options': 'DENY',
  'Cross-Origin-Opener-Policy': 'same-origin', 'Cross-Origin-Resource-Policy': 'same-origin', 'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
};
const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.txt': 'text/plain; charset=utf-8', '.ico': 'image/x-icon',
};
const COMPRESSIBLE = new Set(['.html', '.css', '.js', '.svg', '.webmanifest', '.txt']);

export type Dependencies = { fetch?: typeof fetch; anthropic?: AnthropicClient; process?: ProcessTransport; resolveCli?: (path: string) => Promise<string>; log?: (line: string) => void };

function json(res: ServerResponse, status: number, value: unknown, extra: Record<string, string> = {}) {
  res.writeHead(status, { ...SECURITY_HEADERS, 'Cache-Control': 'no-store', 'Content-Type': 'application/json; charset=utf-8', ...extra });
  res.end(JSON.stringify(value));
}

async function readBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let length = 0;
  for await (const chunk of req) {
    length += chunk.length;
    if (length > 256_000) throw new PublicError('INPUT', 'This conversation is too long. Start a new one.', 413);
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw new PublicError('INPUT', 'The request was not valid JSON.', 400); }
}

/** Fixed-window limiter per client address. Keeps a public deployment from spending unbounded API budget. */
class RateLimiter {
  private hits = new Map<string, { start: number; count: number }>();
  constructor(private limit: number, private windowMs: number) {}
  take(key: string, now = Date.now()) {
    const entry = this.hits.get(key);
    if (!entry || now - entry.start >= this.windowMs) { this.hits.set(key, { start: now, count: 1 }); this.prune(now); return true; }
    if (entry.count >= this.limit) return false;
    entry.count++;
    return true;
  }
  private prune(now: number) {
    if (this.hits.size < 5000) return;
    for (const [key, entry] of this.hits) if (now - entry.start >= this.windowMs) this.hits.delete(key);
  }
}

export function createApp(config: Config, deps: Dependencies = {}) {
  // A per-process token the page must echo. It blocks cross-site form posts; it is not user authentication.
  const token = randomBytes(32).toString('hex');
  const live = new RateLimiter(config.aiRequestsPer10Min, 10 * 60_000);
  const offline = new RateLimiter(120, 60_000);
  const assets = new Map<string, { raw: Buffer; gzip: Buffer | null }>();
  const log = deps.log ?? (() => {});
  let active = 0;

  async function coach(request: CoachRequest, signal: AbortSignal): Promise<{ reply: CoachReply; returnedModel: string | null }> {
    if (request.provider === 'offline') {
      if (config.testFaults && request.fault === 'error') throw new PublicError('TEST_FAULT', 'Simulated coach failure.');
      await delay(config.testFaults && request.fault === 'slow' ? 2500 : 250, undefined, { signal });
      return { reply: offlineCoach(request.messages, request.context), returnedModel: null };
    }
    const { instructions } = await loadInstructions(config.root);
    switch (request.provider) {
      case 'openai-api': return openaiTurn(request, instructions, config.openai, signal, deps.fetch);
      case 'anthropic-api': return anthropicTurn(request, instructions, config.anthropic, signal, deps.anthropic);
      case 'claude-cli': return claudeTurn(request, instructions, config.claude, signal, deps.process, deps.resolveCli);
      case 'codex-cli': return codexTurn(request, instructions, config.codex, signal, deps.process, deps.resolveCli);
    }
  }

  async function serveStatic(req: IncomingMessage, res: ServerResponse, path: string) {
    const file = path === '/' ? 'web/index.html' : decodeURIComponent(path.slice(1));
    if (!/^(web|shared)\/[a-zA-Z0-9/_.-]+\.(js|css|html|svg|woff2|png|webmanifest|txt|ico)$/.test(file) || file.includes('..')) { json(res, 404, { error: 'Not found.' }); return; }
    let entry = assets.get(file);
    const ext = extname(file);
    if (!entry) {
      const root = await realpath(join(config.root, 'dist'));
      const target = await realpath(resolve(root, file));
      if (!['web', 'shared'].some(directory => target.startsWith(join(root, directory) + sep))) { json(res, 404, { error: 'Not found.' }); return; }
      const raw = await readFile(target);
      entry = { raw, gzip: COMPRESSIBLE.has(ext) && raw.length > 1024 ? gzipSync(raw) : null };
      // Built files are immutable for the life of the process, so they are read and compressed once.
      assets.set(file, entry);
    }
    const gzip = entry.gzip && /\bgzip\b/.test(String(req.headers['accept-encoding'] ?? ''));
    res.writeHead(200, {
      ...SECURITY_HEADERS, 'Content-Type': MIME[ext], Vary: 'Accept-Encoding',
      'Cache-Control': ext === '.woff2' || ext === '.png' ? 'public, max-age=604800' : 'no-cache',
      ...(gzip ? { 'Content-Encoding': 'gzip' } : {}),
    });
    res.end(gzip ? entry.gzip : entry.raw);
  }

  const server = createServer(async (req, res) => {
    const address = server.address();
    const port = typeof address === 'object' && address ? address.port : config.port;
    const hosts = [`127.0.0.1:${port}`, `localhost:${port}`, `[::1]:${port}`, ...config.allowedHosts];
    const host = String(req.headers.host ?? '').toLowerCase();
    const allowed = hosts.includes(host) || config.allowedHosts.includes(host.replace(/:\d+$/, ''));
    const origin = req.headers.origin?.toLowerCase();
    const originOk = !origin || hosts.some(name => origin === `http://${name}` || origin === `https://${name}`);
    if (!allowed || !originOk || req.headers['sec-fetch-site'] === 'cross-site') { json(res, 403, { error: 'Requests from this address are not allowed.' }); return; }
    try {
      const path = new URL(req.url ?? '/', 'http://localhost').pathname;
      if (path === '/api/health' && req.method === 'GET') { json(res, 200, { ok: true, version: APP_VERSION }); return; }
      if (path === '/api/config' && req.method === 'GET') {
        json(res, 200, { appVersion: APP_VERSION, token, providers: providerStatuses(config), defaultProvider: defaultProvider(config), limits: LIMITS, testFaults: config.testFaults });
        return;
      }
      if (path === '/api/coach' && req.method === 'POST') {
        const supplied = Buffer.from(String(req.headers['x-icarus-token'] ?? ''));
        if (supplied.length !== token.length || !timingSafeEqual(supplied, Buffer.from(token))) throw new PublicError('FORBIDDEN', 'The app was updated. Reload the page and try again.', 403);
        if (!String(req.headers['content-type'] ?? '').startsWith('application/json')) throw new PublicError('INPUT', 'Expected JSON.', 415);
        const input = await readBody(req);
        if (!isCoachRequest(input)) throw new PublicError('INPUT', 'That message could not be sent. Start a new conversation and try again.', 400);
        const provider = providerStatuses(config).find(item => item.id === input.provider)!;
        if (!provider.enabled) throw new PublicError('NOT_CONFIGURED', `${provider.label} is not set up on this server. ${provider.detail}`, 403);
        const forwarded = config.trustProxy ? String(req.headers['x-forwarded-for'] ?? '').split(',')[0].trim() : '';
        const client = forwarded || req.socket.remoteAddress || 'unknown';
        if (!(input.provider === 'offline' ? offline : live).take(client)) throw new PublicError('RATE_LIMIT', 'You are sending messages faster than this server allows. Wait a few minutes and try again.', 429);
        if (active >= 4) throw new PublicError('BUSY', 'The coach is busy with other requests. Try again in a moment.', 429);
        active++;
        const started = Date.now();
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), input.provider.endsWith('-cli') ? 130_000 : 90_000);
        res.once('close', () => { if (!res.writableEnded) controller.abort(); });
        try {
          const { reply, returnedModel } = await coach(input, controller.signal);
          const result: CoachResult = { reply: redactValue(reply) as CoachReply, meta: { provider: input.provider, model: provider.model, returnedModel, ms: Date.now() - started } };
          log(`coach ${input.provider} ok ${result.meta.ms}ms`);
          if (!res.destroyed) json(res, 200, result);
        } catch (error) {
          log(`coach ${input.provider} failed ${error instanceof PublicError ? error.code : 'ERROR'} ${Date.now() - started}ms`);
          if (controller.signal.aborted && !(error instanceof PublicError && error.code !== 'CANCELLED')) throw new PublicError('TIMEOUT', 'The coach took too long to answer. Try again, or ask for something shorter.', 504);
          throw error;
        } finally { clearTimeout(timeout); active--; }
        return;
      }
      if (path.startsWith('/api/')) { json(res, 404, { error: 'Not found.' }); return; }
      if (req.method !== 'GET' && req.method !== 'HEAD') { json(res, 405, { error: 'Method not allowed.' }); return; }
      await serveStatic(req, res, path);
    } catch (error) {
      if (res.destroyed || res.writableEnded) return;
      if (error instanceof PublicError) json(res, error.status, { error: error.message, code: error.code }, error.status === 429 ? { 'Retry-After': '60' } : {});
      else if (error instanceof Error && 'code' in error && error.code === 'ENOENT') json(res, 404, { error: 'Not found. If you just changed the code, run npm run build.' });
      else { log(`unexpected error: ${error instanceof Error ? error.name : 'unknown'}`); json(res, 500, { error: 'Something went wrong on the server. Try again.' }); }
    }
  });
  server.requestTimeout = 140_000;
  server.headersTimeout = 15_000;
  return server;
}
