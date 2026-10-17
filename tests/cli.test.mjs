import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { buildClaudeInvocation, checkClaudeSupport, claudeError, claudeTurn, inspectClaudeLine, parseClaudeOutput, CLAUDE_FLAGS } from '../dist/server/providers/claude-cli.js';
import { buildCodexInvocation, CODEX_DISABLED_FEATURES, codexTurn, inspectCodexLine, parseCodexOutput } from '../dist/server/providers/codex-cli.js';
import { cliEnvironment, resolveBinary } from '../dist/server/providers/cli-common.js';
import { subprocess } from '../dist/server/subprocess.js';
import { redact, redactValue } from '../dist/shared/redact.js';

const context = { name: null, goal: 'muscle', level: 'beginner', equipment: ['bodyweight', 'dumbbells'], minutes: 40, units: 'kg', plan: '', recent: '', session: '' };
const request = (provider, content = 'Build me a leg session') => ({ provider, messages: [{ role: 'user', content }], context });
const reply = { reply: 'Here is a session.', workout: { title: 'Legs', focus: 'Quads', minutes: 30, exercises: [{ name: 'Goblet Squat', exerciseId: 'goblet-squat', sets: 3, reps: 10, repsMax: 12, seconds: null, restSec: 90, cue: 'Chest up' }] }, split: null, suggestions: ['Make it shorter'] };
const cfg = { binary: '/trusted/claude', model: '', timeoutMs: 1000 };
const signal = () => new AbortController().signal;
const output = (stdout, exitCode = 0, stderr = '') => ({ stdout, exitCode, stderr });
const lines = (...events) => events.map(value => JSON.stringify(value)).join('\n') + '\n';
const help = CLAUDE_FLAGS.join(' ') + ' --safe-mode';
const init = { type: 'system', subtype: 'init', tools: [], mcp_servers: [] };
const success = { type: 'result', subtype: 'success', is_error: false, structured_output: reply, permission_denials: [], modelUsage: { 'claude-test-model': {} } };
const trusted = async () => '/trusted/bin';

function fakeClaude(overrides = {}) {
  const calls = [];
  const run = async (invocation, _signal, inspect) => {
    calls.push(invocation);
    if (invocation.args.includes('--version')) return output(overrides.version ?? '2.3.0 (Claude Code)');
    if (invocation.args.includes('--help')) return output(overrides.help ?? help);
    const response = overrides.result ?? output(lines(init, success));
    if (inspect) for (const line of response.stdout.split('\n').filter(Boolean)) inspect(line);
    return response;
  };
  return { calls, run };
}

test('Claude CLI runs when a path is configured: no consent flag, no version pin, no platform block', async () => {
  const fake = fakeClaude({ version: '9.0.0 (Claude Code)' });
  const result = await claudeTurn(request('claude-cli'), 'instructions', cfg, signal(), fake.run, trusted, { HOME: '/home/user' });
  assert.equal(result.reply.workout.exercises[0].exerciseId, 'goblet-squat');
  assert.equal(result.returnedModel, 'claude-test-model');
  assert.equal(result.runtimeVersion, '9.0.0');
  await assert.rejects(claudeTurn(request('claude-cli'), 'x', { ...cfg, binary: '' }, signal(), fake.run, trusted), error => error.code === 'CLI_SETUP');
});

test('Claude CLI invocation keeps tools, MCP, hooks and sessions off and the prompt off argv', () => {
  const text = '--dangerously-skip-permissions $(touch /tmp/never); cat ~/.ssh/id_rsa';
  const invocation = buildClaudeInvocation('/trusted/claude', '/tmp/fresh', { ...cfg, model: 'sonnet' }, request('claude-cli', text), 'instructions', {}, true);
  assert.equal(JSON.parse(invocation.input).conversation[0].content, text);
  assert(!invocation.args.some(arg => arg.includes(text)));
  assert.equal(invocation.args[invocation.args.indexOf('--tools') + 1], '');
  assert.equal(invocation.args[invocation.args.indexOf('--disallowedTools') + 1], 'mcp__*');
  assert(invocation.args.includes('--strict-mcp-config') && invocation.args.includes('--no-session-persistence') && invocation.args.includes('--safe-mode'));
  assert(JSON.parse(invocation.args[invocation.args.indexOf('--settings') + 1]).disableAllHooks);
  assert.equal(invocation.args[invocation.args.indexOf('--model') + 1], 'sonnet');
});

test('Claude CLI support is detected from --help; missing safety flags fail closed', () => {
  assert.equal(checkClaudeSupport('2.1.0 (Claude Code)', help), '2.1.0');
  assert.throws(() => checkClaudeSupport('3.0.0', help.replace('--strict-mcp-config', '')), /--strict-mcp-config/);
});

test('Claude CLI tripwire rejects tools, MCP servers, subagents and denials', () => {
  assert.throws(() => inspectClaudeLine(JSON.stringify({ ...init, tools: ['Bash'] })), error => error.code === 'CLI_PROFILE');
  assert.throws(() => inspectClaudeLine(JSON.stringify({ ...init, mcp_servers: [{ name: 'x' }] })), error => error.code === 'CLI_PROFILE');
  assert.throws(() => inspectClaudeLine(JSON.stringify({ type: 'assistant', message: { content: [{ type: 'tool_use', name: 'Read' }] } })), error => error.code === 'CLI_PROFILE');
  assert.throws(() => inspectClaudeLine(JSON.stringify({ type: 'user', parent_tool_use_id: 'x' })), error => error.code === 'CLI_PROFILE');
  assert.throws(() => parseClaudeOutput(lines(init, { ...success, permission_denials: [{}] })), error => error.code === 'CLI_PROFILE');
  assert.throws(() => parseClaudeOutput(lines(success)), error => error.code === 'CLI_PROFILE');
  assert.throws(() => parseClaudeOutput(lines(init, { ...success, structured_output: { reply: 'x' } })), error => error.code === 'CLI_SCHEMA');
  assert.throws(() => parseClaudeOutput('not json'), error => error.code === 'CLI_SCHEMA');
});

test('Claude CLI errors are classified without leaking raw output', async () => {
  const secret = 'sk-' + 's'.repeat(30);
  for (const [message, code] of [['not logged in', 'CLI_AUTH'], ['usage limit reached', 'CLI_QUOTA'], ['unknown option', 'CLI_VERSION'], ['private failure', 'CLI_FAILED']]) {
    const fake = fakeClaude({ result: output('', 1, `${message} ${secret}`) });
    await assert.rejects(claudeTurn(request('claude-cli'), 'x', cfg, signal(), fake.run, trusted, {}), error => error.code === code && !error.message.includes(secret));
  }
  assert(!claudeError('raw private message').message.includes('raw private'));
});

function fakeCodex(overrides = {}) {
  const calls = [];
  const run = async (invocation, _signal, inspect) => {
    calls.push(invocation);
    if (invocation.args.includes('--version')) return output('codex-cli 0.163.0');
    if (invocation.args.includes('login')) return overrides.login ?? output('Logged in using ChatGPT');
    const response = overrides.result ?? output(lines({ type: 'thread.started' }, { type: 'turn.started' }, { type: 'item.completed', item: { type: 'reasoning', text: '...' } },
      { type: 'item.completed', item: { type: 'agent_message', text: JSON.stringify(reply) } }, { type: 'turn.completed' }));
    if (inspect) for (const line of response.stdout.split('\n').filter(Boolean)) inspect(line);
    return response;
  };
  return { calls, run };
}

test('Codex CLI is no longer hard-disabled: it runs with tools switched off in a read-only, empty workspace', async () => {
  const fake = fakeCodex();
  const result = await codexTurn(request('codex-cli'), 'instructions', { ...cfg, binary: '/trusted/codex' }, signal(), fake.run, trusted, { HOME: '/home/user', OPENAI_API_KEY: 'private' });
  assert.equal(result.reply.workout.title, 'Legs');
  const main = fake.calls.find(call => call.args[0] === 'exec');
  for (const flag of ['--json', '--ephemeral', '--ignore-user-config', '--ignore-rules', '--skip-git-repo-check']) assert(main.args.includes(flag), flag);
  assert.equal(main.args[main.args.indexOf('--sandbox') + 1], 'read-only');
  for (const feature of ['shell_tool', 'unified_exec', 'apps', 'plugins', 'browser_use', 'computer_use']) assert(CODEX_DISABLED_FEATURES.includes(feature) && main.args.includes(feature), feature);
  assert(!main.args.includes('--dangerously-bypass-approvals-and-sandbox'));
  assert.equal(main.args.at(-1), '-');
  assert(!JSON.stringify(main.env).includes('private'));
});

test('Codex CLI refuses when logged out, and its tripwire stops any tool item', async () => {
  const loggedOut = fakeCodex({ login: output('Not logged in', 1) });
  await assert.rejects(codexTurn(request('codex-cli'), 'x', { ...cfg, binary: '/trusted/codex' }, signal(), loggedOut.run, trusted, {}), error => error.code === 'CLI_AUTH');
  for (const type of ['command_execution', 'file_change', 'mcp_tool_call', 'web_search']) assert.throws(() => inspectCodexLine(JSON.stringify({ type: 'item.started', item: { type } })), error => error.code === 'CLI_PROFILE');
  assert.doesNotThrow(() => inspectCodexLine('2026-01-01 WARN log line that is not JSON'));
  assert.throws(() => parseCodexOutput(lines({ type: 'turn.failed', error: { message: '401 unauthorized' } })), error => error.code === 'CLI_AUTH');
  assert.throws(() => parseCodexOutput(lines({ type: 'item.completed', item: { type: 'agent_message', text: '{}' } }, { type: 'turn.completed' })), error => error.code === 'CLI_SCHEMA');
  const invocation = buildCodexInvocation('/trusted/codex', '/tmp/fresh', '/tmp/fresh/schema.json', { ...cfg, model: 'gpt-6-astra' }, request('codex-cli', '$(rm -rf /)'), 'instructions', {});
  assert(!invocation.args.some(arg => arg.includes('rm -rf')) && invocation.input.includes('$(rm -rf /)'));
});

test('CLI child environment drops keys, proxies and runtime injection; paths are validated', async () => {
  const env = cliEnvironment({ HOME: '/home/u', OPENAI_API_KEY: 'private', ANTHROPIC_API_KEY: 'private', NODE_OPTIONS: '--require evil', SSH_AUTH_SOCK: '/private', PATH: '/evil', HTTP_PROXY: 'private' }, '/trusted/claude');
  assert.equal(env.HOME, '/home/u');
  assert(!JSON.stringify(env).includes('private') && !JSON.stringify(env).includes('/evil'));
  await assert.rejects(resolveBinary('/usr/bin/bash', ['claude'], 'Claude Code'), error => error.code === 'CLI_PATH');
  await assert.rejects(resolveBinary('/nonexistent/claude', ['claude'], 'Claude Code'), error => error.code === 'CLI_MISSING');
});

function processFixture(behavior) {
  let options, input = '', args;
  const killed = [];
  const spawn = (_binary, argv, opts) => {
    args = argv; options = opts;
    const child = new EventEmitter(); child.stdout = new PassThrough(); child.stderr = new PassThrough(); child.stdin = new PassThrough();
    child.kill = value => { killed.push(value); queueMicrotask(() => child.emit('close', null)); return true; };
    child.stdin.on('data', chunk => { input += chunk; });
    queueMicrotask(() => {
      if (behavior === 'success') { child.stdout.write('result'); child.emit('close', 0); }
      if (behavior === 'missing') child.emit('error', new Error('ENOENT private token'));
      if (behavior === 'overflow') child.stdout.write('x'.repeat(600_000));
      if (behavior === 'tool') child.stdout.write(lines({ ...init, tools: ['Bash'] }));
    });
    return child;
  };
  return { transport: subprocess(spawn), inspect: () => ({ options, input, args, killed }) };
}
const invocation = { binary: '/trusted/claude', args: ['--print'], cwd: '/tmp/fresh', env: {}, input: '$(touch never);\nprivate input', timeoutMs: 1000 };

test('subprocess passes argv directly, prompt only on stdin, never through a shell', async () => {
  const fixture = processFixture('success');
  const result = await fixture.transport(invocation, signal());
  assert.equal(result.stdout, 'result');
  const seen = fixture.inspect();
  assert.equal(seen.options.shell, false); assert.equal(seen.input, invocation.input); assert.deepEqual(seen.args, ['--print']);
});

test('subprocess missing binary, output cap and tool events fail safely; timeout and cancel stop the process', async () => {
  for (const [behavior, code] of [['missing', 'CLI_MISSING'], ['overflow', 'CLI_OUTPUT_LIMIT'], ['tool', 'CLI_PROFILE']]) {
    const fixture = processFixture(behavior);
    await assert.rejects(fixture.transport(invocation, signal(), behavior === 'tool' ? inspectClaudeLine : undefined), error => error.code === code && !error.message.includes('private token'));
  }
  const slow = processFixture('waiting');
  await assert.rejects(slow.transport({ ...invocation, timeoutMs: 5 }, signal()), error => error.code === 'CLI_TIMEOUT');
  assert.deepEqual(slow.inspect().killed, ['SIGTERM']);
  const cancel = processFixture('waiting'); const controller = new AbortController();
  const pending = cancel.transport(invocation, controller.signal); controller.abort();
  await assert.rejects(pending, error => error.code === 'CANCELLED');
});

test('redaction removes credential-shaped values from any text the server returns', () => {
  for (const name of ['ANTHROPIC_API_KEY', 'OPENAI_API_KEY', 'CODEX_ACCESS_TOKEN']) assert.equal(redact(`${name}=private-value`), `${name}=[REDACTED]`);
  assert.equal(JSON.stringify(redactValue({ reply: 'key sk-' + 'a'.repeat(20), refresh_token: 'private' })).includes('private'), false);
});
