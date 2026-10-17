import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { checkReply, replySchema, type CoachReply, type CoachRequest } from '../../shared/coach/contracts.js';
import { wireSchema } from '../../shared/schema.js';
import type { CliConfig } from '../config.js';
import { PublicError } from '../errors.js';
import { contextBlock } from '../prompt.js';
import { runProcess, type Invocation, type ProcessTransport } from '../subprocess.js';
import { cliEnvironment, isRecord, parseLine, resolveBinary } from './cli-common.js';

export const CODEX_PROFILE = 'codex-no-tools-v1';

// Every tool family `codex features list` reports, switched off. Verified against codex-cli 0.163.
export const CODEX_DISABLED_FEATURES = [
  'shell_tool', 'unified_exec', 'apps', 'plugins', 'remote_plugin', 'multi_agent', 'browser_use', 'browser_use_external', 'in_app_browser', 'computer_use',
  'image_generation', 'view_image', 'hooks', 'skill_search', 'skill_mcp_dependency_install', 'tool_suggest', 'memories', 'goals', 'sleep_tool', 'workspace_dependencies', 'code_mode_host',
];

// The only stream items a text-only answer produces. Anything else (commands, file changes, MCP or web calls) stops the run.
const ALLOWED_ITEMS = new Set(['agent_message', 'reasoning', 'error', 'todo_list']);

export function codexError(text: string): PublicError {
  if (/not logged|login|log in|sign in|unauth|401|api key/i.test(text)) return new PublicError('CLI_AUTH', 'Codex is not logged in. Run `codex login` in a terminal, then try again.', 401);
  if (/quota|rate.limit|usage.limit|429|limit reached/i.test(text)) return new PublicError('CLI_QUOTA', 'Your Codex usage limit was reached. Wait for it to reset or switch coach.', 429);
  if (/unexpected argument|unknown feature|unrecognized|invalid value/i.test(text)) return new PublicError('CLI_VERSION', 'This Codex version does not support the options Icarus needs. Update Codex and try again.', 503);
  return new PublicError('CLI_FAILED', 'Codex could not complete the request. Check that `codex exec` works in a terminal, then try again.');
}

export function buildCodexInvocation(binary: string, cwd: string, schemaPath: string, config: CliConfig, request: CoachRequest, instructions: string, env: NodeJS.ProcessEnv): Invocation {
  const conversation = request.messages.map(message => `${message.role === 'user' ? 'User' : 'Coach'}: ${message.content}`).join('\n\n');
  return {
    binary, cwd, env: cliEnvironment(env, binary, ['CODEX_HOME']), timeoutMs: config.timeoutMs,
    args: ['exec', '--json', '--ephemeral', '--skip-git-repo-check', '--ignore-user-config', '--ignore-rules', '--sandbox', 'read-only', '--cd', join(cwd, 'empty'),
      '--output-schema', schemaPath, ...CODEX_DISABLED_FEATURES.flatMap(feature => ['--disable', feature]), ...(config.model ? ['--model', config.model] : []), '-'],
    input: `${instructions}\n\nDo not run commands or read files: answer from the conversation only, as the structured reply.\n\n${contextBlock(request)}\n\nConversation so far:\n${conversation}\n`,
  };
}

/** Stream tripwire. Combined with the disabled features above; it is a safeguard, not an OS sandbox. */
export function inspectCodexLine(line: string) {
  if (!line.trim().startsWith('{')) return;
  const data = parseLine(line, 'CLI_SCHEMA', 'Codex');
  if (typeof data.type === 'string' && data.type.startsWith('item.') && isRecord(data.item) && !ALLOWED_ITEMS.has(String(data.item.type)))
    throw new PublicError('CLI_PROFILE', `Codex tried to use a tool (${String(data.item.type)}), so the request was stopped.`, 503);
}

export function parseCodexOutput(stdout: string): CoachReply {
  const events = stdout.split('\n').filter(line => line.trim().startsWith('{')).map(line => { inspectCodexLine(line); return parseLine(line, 'CLI_SCHEMA', 'Codex'); });
  const failed = events.find(event => event.type === 'turn.failed');
  if (failed) throw codexError(JSON.stringify(failed));
  if (!events.some(event => event.type === 'turn.completed')) throw new PublicError('CLI_SCHEMA', 'Codex did not finish its answer. Try again.');
  const message = [...events].reverse().find(event => event.type === 'item.completed' && isRecord(event.item) && event.item.type === 'agent_message');
  const text = message && isRecord(message.item) && typeof message.item.text === 'string' ? message.item.text : '';
  try { return checkReply(JSON.parse(text)); } catch { throw new PublicError('CLI_SCHEMA', 'Codex returned an answer in the wrong format. Try again.'); }
}

export async function codexTurn(request: CoachRequest, instructions: string, config: CliConfig, signal: AbortSignal,
  transport: ProcessTransport = runProcess, resolve: (path: string) => Promise<string> = path => resolveBinary(path, ['codex'], 'Codex'), env: NodeJS.ProcessEnv = process.env) {
  if (!config.binary) throw new PublicError('CLI_SETUP', 'Set CODEX_CLI_PATH in .env to use Codex.', 403);
  if (signal.aborted) throw new PublicError('CANCELLED', 'Cancelled.', 408);
  const binary = await resolve(config.binary);
  const cwd = await mkdtemp(join(tmpdir(), 'icarus-codex-'));
  try {
    await mkdir(join(cwd, 'empty'));
    const schemaPath = join(cwd, 'schema.json');
    await writeFile(schemaPath, JSON.stringify(wireSchema(replySchema)));
    const base = { binary, cwd, env: cliEnvironment(env, binary, ['CODEX_HOME']), input: '', timeoutMs: 15_000 };
    const version = await transport({ ...base, args: ['--version'] }, signal);
    if (version.exitCode !== 0) throw codexError(version.stderr);
    const login = await transport({ ...base, args: ['login', 'status'] }, signal);
    if (login.exitCode !== 0 || /not logged in/i.test(login.stdout + login.stderr)) throw new PublicError('CLI_AUTH', 'Codex is not logged in. Run `codex login` in a terminal, then try again.', 401);
    const output = await transport(buildCodexInvocation(binary, cwd, schemaPath, config, request, instructions, env), signal, inspectCodexLine);
    if (signal.aborted) throw new PublicError('CANCELLED', 'Cancelled.', 408);
    if (output.exitCode !== 0) throw codexError(output.stderr + output.stdout);
    return { reply: parseCodexOutput(output.stdout), returnedModel: null, runtimeVersion: version.stdout.trim().match(/\d+\.\d+\.\d+/)?.[0] ?? 'unknown', profile: CODEX_PROFILE };
  } finally { await rm(cwd, { recursive: true, force: true }); }
}
