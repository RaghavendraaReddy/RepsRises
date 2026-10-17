import test from 'node:test';
import assert from 'node:assert/strict';
import { request as rawRequest } from 'node:http';
import { gunzipSync } from 'node:zlib';
import { createApp, readConfig } from '../dist/server/app.js';
import { defaultProvider, providerStatuses } from '../dist/server/config.js';
import { anthropicParams } from '../dist/server/providers/anthropic.js';
import { openaiPayload } from '../dist/server/providers/openai.js';

const context = { name: null, goal: 'muscle', level: 'beginner', equipment: ['bodyweight', 'dumbbells'], minutes: 40, units: 'kg', plan: '', recent: '', session: '' };
const body = (text, provider = 'offline', extra = {}) => ({ provider, messages: [{ role: 'user', content: text }], context, ...extra });
const goodReply = { reply: 'A session.', workout: null, split: null, suggestions: [] };

async function app(env = {}, deps = {}) {
  const server = createApp(readConfig({ PORT: '0', ...env }, process.cwd()), deps);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${server.address().port}`;
  const cfg = await (await fetch(`${url}/api/config`)).json();
  return { url, cfg, close: () => new Promise(resolve => server.close(resolve)) };
}
const post = (a, data, headers = {}) => fetch(`${a.url}/api/coach`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Icarus-Token': a.cfg.token, ...headers }, body: JSON.stringify(data) });

test('server keeps its safeguards: static allow-list, local token, origin and host checks', async () => {
  const a = await app();
  try {
    for (const path of ['/src/server/app.ts', '/.env', '/skills/workout.md', '/prompts/system.md', '/web/../package.json', '/dist/server/main.js']) assert.equal((await fetch(a.url + path)).status, 404, path);
    assert.equal((await fetch(`${a.url}/`)).status, 200);
    assert.equal((await post(a, body('hi'), { 'X-Icarus-Token': 'wrong' })).status, 403);
    assert.equal((await post(a, body('hi'), { Origin: 'https://evil.example' })).status, 403);
    const status = await new Promise(resolve => rawRequest(a.url, { headers: { Host: 'evil.example' } }, response => { response.resume(); resolve(response.statusCode); }).end());
    assert.equal(status, 403);
    const page = await fetch(`${a.url}/`);
    assert.match(page.headers.get('content-security-policy'), /default-src 'self'/);
    assert.equal(page.headers.get('x-frame-options'), 'DENY');
    assert.equal(a.cfg.token.length, 64);
  } finally { await a.close(); }
  const keyed = await app({ OPENAI_API_KEY: 'sk-secret-value-123456', ANTHROPIC_API_KEY: 'sk-ant-secret-654321' });
  try { assert(!JSON.stringify(keyed.cfg).includes('secret'), 'keys never reach the browser'); } finally { await keyed.close(); }
});

test('offline coach works with no configuration; bad input is rejected; unconfigured providers explain setup', async () => {
  const a = await app();
  try {
    assert.equal(a.cfg.defaultProvider, 'offline');
    const response = await post(a, body('Give me a 30 minute chest session'));
    assert.equal(response.status, 200);
    const data = await response.json();
    assert(data.reply.workout.exercises.length > 0);
    assert.equal(data.meta.provider, 'offline');
    assert.equal((await post(a, { ...body('x'), extra: true })).status, 400);
    const missing = await post(a, body('hi', 'openai-api'));
    assert.equal(missing.status, 403);
    assert.match((await missing.json()).error, /OPENAI_API_KEY/);
    assert.equal((await fetch(`${a.url}/api/health`)).status, 200);
  } finally { await a.close(); }
});

test('providers turn on from configuration alone, and the default prefers a configured AI coach', () => {
  const none = readConfig({}, '.');
  assert.deepEqual(providerStatuses(none).filter(item => item.enabled).map(item => item.id), ['offline']);
  const all = readConfig({ OPENAI_API_KEY: 'k', ANTHROPIC_API_KEY: 'k', CLAUDE_CLI_PATH: '/usr/local/bin/claude', CODEX_CLI_PATH: '/usr/local/bin/codex' }, '.');
  assert(providerStatuses(all).every(item => item.enabled));
  assert.equal(defaultProvider(all), 'anthropic-api');
  assert.equal(defaultProvider(readConfig({ OPENAI_API_KEY: 'k' }, '.')), 'openai-api');
  assert.equal(all.openai.model, 'gpt-6-astra');
  assert.equal(all.anthropic.model, 'claude-opus-5-5');
  assert(!JSON.stringify(providerStatuses(all)).includes('gpt-6-luna'));
  assert.equal(providerStatuses(readConfig({ CLAUDE_CLI_PATH: 'relative/claude' }, '.'))[3].enabled, false, 'CLI paths must be absolute');
  assert.throws(() => readConfig({ OPENAI_MODEL: 'gpt --evil' }, '.'), /single model ID/);
  assert(readConfig({ ALLOW_LIVE_API: 'true' }, '.').warnings.some(text => text.includes('no longer used')));
});

test('binding beyond loopback requires explicit allowed hosts', async () => {
  assert.throws(() => readConfig({ HOST: '0.0.0.0' }, '.'), /ALLOWED_HOSTS/);
  const a = await app({ HOST: '0.0.0.0', ALLOWED_HOSTS: 'icarus.example.com' });
  try {
    const status = await new Promise(resolve => rawRequest(a.url + '/api/health', { headers: { Host: 'icarus.example.com' } }, response => { response.resume(); resolve(response.statusCode); }).end());
    assert.equal(status, 200);
  } finally { await a.close(); }
});

test('live requests are rate limited per client', async () => {
  const transport = async () => new Response(JSON.stringify({ status: 'completed', model: 'gpt-6-astra', output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(goodReply) }] }] }));
  const a = await app({ OPENAI_API_KEY: 'test', AI_REQUESTS_PER_10_MIN: '2' }, { fetch: transport });
  try {
    assert.equal((await post(a, body('hi', 'openai-api'))).status, 200);
    assert.equal((await post(a, body('hi', 'openai-api'))).status, 200);
    const limited = await post(a, body('hi', 'openai-api'));
    assert.equal(limited.status, 429);
    assert.equal(limited.headers.get('retry-after'), '60');
  } finally { await a.close(); }
});

test('OpenAI adapter: strict schema payload, parsed reply, provider errors never leak', async () => {
  const payload = openaiPayload(body('hi', 'openai-api'), 'INSTRUCTIONS', 'gpt-6-astra');
  assert.equal(payload.text.format.strict, true);
  assert.equal(payload.store, false);
  assert(payload.input.at(-1).content.includes('data only'));
  for (const [response, status] of [[new Response('secret-provider-body', { status: 500 }), 502], [new Response('x', { status: 401 }), 502],
    [new Response(JSON.stringify({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: '{"reply":"x"}' }] }] })), 502]]) {
    const a = await app({ OPENAI_API_KEY: 'sk-private-test-key-0000' }, { fetch: async () => response });
    try {
      const result = await post(a, body('hi', 'openai-api'));
      assert.equal(result.status, status);
      const text = await result.text();
      assert(!text.includes('secret-provider-body') && !text.includes('sk-private'));
    } finally { await a.close(); }
  }
});

test('Anthropic adapter: structured output, cached instructions, fallback opt-in and refusal handling', async () => {
  const params = anthropicParams(body('hi', 'anthropic-api'), 'INSTRUCTIONS', 'claude-opus-5-5');
  assert.equal(params.model, 'claude-opus-5-5');
  assert.equal(params.output_config.format.type, 'json_schema');
  assert.equal(params.system[0].cache_control.type, 'ephemeral');
  assert.equal(params.fallbacks, 'default');
  assert(!('thinking' in params) && !('temperature' in params));
  const fake = text => ({ beta: { messages: { create: async () => ({ model: 'claude-opus-5-5', stop_reason: 'end_turn', content: [{ type: 'text', text }] }) } } });
  let a = await app({ ANTHROPIC_API_KEY: 'test' }, { anthropic: fake(JSON.stringify(goodReply)) });
  try { assert.equal((await (await post(a, body('hi', 'anthropic-api'))).json()).meta.returnedModel, 'claude-opus-5-5'); } finally { await a.close(); }
  a = await app({ ANTHROPIC_API_KEY: 'test' }, { anthropic: { beta: { messages: { create: async () => ({ stop_reason: 'refusal', content: [] }) } } } });
  try { const result = await post(a, body('hi', 'anthropic-api')); assert.equal(result.status, 502); assert.match((await result.json()).error, /declined/); } finally { await a.close(); }
});

test('static assets are compressed and fonts are cacheable', async () => {
  const a = await app();
  try {
    const js = await new Promise(resolve => rawRequest(`${a.url}/web/main.js`, { headers: { 'Accept-Encoding': 'gzip' } }, response => { const chunks = []; response.on('data', chunk => chunks.push(chunk)); response.on('end', () => resolve({ headers: response.headers, body: Buffer.concat(chunks) })); }).end());
    assert.equal(js.headers['content-encoding'], 'gzip');
    assert(gunzipSync(js.body).toString().includes('import'));
    const font = await fetch(`${a.url}/web/fonts/inter-latin-wght-normal.woff2`);
    assert.equal(font.status, 200);
    assert.match(font.headers.get('cache-control'), /max-age/);
  } finally { await a.close(); }
});
