import { isAbsolute, join } from 'node:path';
import type { ProviderId, ProviderStatus } from '../shared/coach/contracts.js';

export const DEFAULT_MODELS = { openai: 'gpt-6-astra', anthropic: 'claude-opus-5-5' } as const;
const MODEL_ID = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,99}$/;
const LOOPBACK = new Set(['127.0.0.1', 'localhost', '::1']);

export type CliConfig = { binary: string; model: string; timeoutMs: number };
export type Config = {
  root: string;
  host: string;
  port: number;
  /** Extra Host header values for a public deployment. Loopback with the live port is always allowed. */
  allowedHosts: string[];
  /** Read the client address from X-Forwarded-For (only behind a trusted reverse proxy). */
  trustProxy: boolean;
  openai: { key: string; model: string };
  anthropic: { key: string; model: string };
  claude: CliConfig;
  codex: CliConfig;
  /** Live (paid) coach requests per client address per 10 minutes. */
  aiRequestsPer10Min: number;
  /** Lets tests ask the offline coach to fail or be slow. Never enable in production. */
  testFaults: boolean;
  warnings: string[];
  /** Where booking and enquiry requests are stored. */
  dataDir: string;
  retentionDays: number;
  /** Optional HTTPS endpoint that receives each new request (your CRM, a provider integration, or a ticketing tool). */
  webhookUrl: string | null;
  /** Map view is offered only when a tile provider is configured. */
  map: { tileUrl: string; attribution: string } | null;
  supportEmail: string | null;
};

function model(value: string | undefined, fallback: string, name: string) {
  const result = value?.trim() || fallback;
  if (result && !MODEL_ID.test(result)) throw new Error(`${name} must be a single model ID without spaces or flags.`);
  return result;
}

function cliPath(value: string | undefined, name: string, warnings: string[]) {
  const path = value?.trim() ?? '';
  if (path && !isAbsolute(path)) { warnings.push(`${name} must be an absolute path; that provider stays off.`); return ''; }
  return path;
}

function positive(value: string | undefined, fallback: number) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 && number <= 3650 ? number : fallback;
}

function httpsUrl(value: string | undefined, name: string, warnings: string[], template = false): string | null {
  const raw = value?.trim();
  if (!raw) return null;
  try {
    const url = new URL(template ? raw.replace(/\{[a-z]\}/g, 'a') : raw);
    if (url.protocol !== 'https:') throw new Error();
    return raw;
  } catch { warnings.push(`${name} must be an https:// URL; it was ignored.`); return null; }
}

export function readConfig(env: NodeJS.ProcessEnv, root: string): Config {
  const warnings: string[] = [];
  const host = env.HOST?.trim() || '127.0.0.1';
  const port = Number(env.PORT || 4319);
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('PORT must be an integer from 0 to 65535.');
  const extra = (env.ALLOWED_HOSTS ?? '').split(',').map(item => item.trim().toLowerCase()).filter(Boolean);
  if (!LOOPBACK.has(host) && !extra.length) throw new Error(`HOST=${host} exposes the server beyond this machine. Set ALLOWED_HOSTS to the public host name(s) you serve, for example ALLOWED_HOSTS=icarus.example.com.`);
  for (const legacy of ['ALLOW_LIVE_API', 'ALLOW_CLAUDE_CLI', 'CLI_PROFILE_ACKNOWLEDGED', 'CLI_ALLOW_WINDOWS', 'APP_MODE']) if (env[legacy] !== undefined) warnings.push(`${legacy} is no longer used: a provider turns on when its key or CLI path is set.`);
  const limit = Number(env.AI_REQUESTS_PER_10_MIN || 40);
  return {
    root, host, port,
    allowedHosts: [...new Set(extra)],
    trustProxy: env.TRUST_PROXY === '1',
    openai: { key: env.OPENAI_API_KEY?.trim() ?? '', model: model(env.OPENAI_MODEL, DEFAULT_MODELS.openai, 'OPENAI_MODEL') },
    anthropic: { key: env.ANTHROPIC_API_KEY?.trim() ?? '', model: model(env.ANTHROPIC_MODEL, DEFAULT_MODELS.anthropic, 'ANTHROPIC_MODEL') },
    claude: { binary: cliPath(env.CLAUDE_CLI_PATH, 'CLAUDE_CLI_PATH', warnings), model: model(env.CLAUDE_MODEL, '', 'CLAUDE_MODEL'), timeoutMs: 90_000 },
    codex: { binary: cliPath(env.CODEX_CLI_PATH, 'CODEX_CLI_PATH', warnings), model: model(env.CODEX_MODEL, '', 'CODEX_MODEL'), timeoutMs: 120_000 },
    aiRequestsPer10Min: Number.isInteger(limit) && limit > 0 ? limit : 40,
    testFaults: env.ICARUS_TEST_FAULTS === '1',
    warnings,
    dataDir: env.DATA_DIR?.trim() || join(root, 'data/runtime'),
    retentionDays: positive(env.REQUEST_RETENTION_DAYS, 90),
    webhookUrl: httpsUrl(env.REQUEST_WEBHOOK_URL, 'REQUEST_WEBHOOK_URL', warnings),
    map: (() => { const url = httpsUrl(env.MAP_TILE_URL, 'MAP_TILE_URL', warnings, true); return url ? { tileUrl: url, attribution: (env.MAP_ATTRIBUTION ?? '').slice(0, 200) || 'Map data © its providers' } : null; })(),
    supportEmail: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(env.SUPPORT_EMAIL ?? '') ? env.SUPPORT_EMAIL!.trim() : null,
  };
}

export function providerStatuses(config: Config): ProviderStatus[] {
  return [
    { id: 'offline', label: 'Icarus Offline', enabled: true, model: 'rule-based', detail: 'Built-in coach. Runs on this server with no AI model and no account. Great for workouts, splits, swaps and technique basics.' },
    { id: 'anthropic-api', label: 'Claude API', enabled: Boolean(config.anthropic.key), model: config.anthropic.model,
      detail: config.anthropic.key ? 'Uses your Anthropic API key. Requests are billed to that account.' : 'Add ANTHROPIC_API_KEY to .env and restart the server.' },
    { id: 'openai-api', label: 'OpenAI API', enabled: Boolean(config.openai.key), model: config.openai.model,
      detail: config.openai.key ? 'Uses your OpenAI API key. Requests are billed to that account.' : 'Add OPENAI_API_KEY to .env and restart the server.' },
    { id: 'claude-cli', label: 'Claude Code CLI', enabled: Boolean(config.claude.binary), model: config.claude.model || 'CLI default',
      detail: config.claude.binary ? 'Uses your local Claude Code login. Tools are switched off for every request.' : 'Set CLAUDE_CLI_PATH to the absolute path of the claude executable, then restart.' },
    { id: 'codex-cli', label: 'Codex CLI', enabled: Boolean(config.codex.binary), model: config.codex.model || 'CLI default',
      detail: config.codex.binary ? 'Uses your local Codex login. Shell, apps and plugins are switched off for every request.' : 'Set CODEX_CLI_PATH to the absolute path of the codex executable, then restart.' },
  ];
}

/** The first configured AI provider, so a fresh browser starts with the best available coach. */
export function defaultProvider(config: Config): ProviderId {
  return providerStatuses(config).find(item => item.id !== 'offline' && item.enabled)?.id ?? 'offline';
}
