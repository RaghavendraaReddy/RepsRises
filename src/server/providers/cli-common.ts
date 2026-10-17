import { access, lstat, realpath } from 'node:fs/promises';
import { constants } from 'node:fs';
import { basename, delimiter, dirname, join } from 'node:path';
import { PublicError } from '../errors.js';

/**
 * The environment handed to a CLI child process: enough to find its own login under HOME, nothing
 * else. API keys, tokens, proxies and SSH agents from the server's environment are never passed on.
 */
export function cliEnvironment(env: NodeJS.ProcessEnv, binary: string, extra: string[] = []): NodeJS.ProcessEnv {
  if (process.platform === 'win32') {
    const root = env.SystemRoot || 'C:\\Windows';
    const clean: NodeJS.ProcessEnv = { PATH: [...new Set([dirname(binary), dirname(process.execPath), join(root, 'System32'), root])].join(delimiter) };
    for (const name of ['HOME', 'USERPROFILE', 'APPDATA', 'LOCALAPPDATA', 'SystemRoot', 'SystemDrive', 'TEMP', 'TMP', 'HOMEDRIVE', 'HOMEPATH', 'USERNAME', 'PATHEXT', 'ComSpec', ...extra]) if (env[name]) clean[name] = env[name];
    return clean;
  }
  const clean: NodeJS.ProcessEnv = { PATH: [...new Set([dirname(binary), dirname(process.execPath), '/usr/bin', '/bin', '/usr/sbin', '/sbin'])].join(':') };
  for (const name of ['HOME', 'USER', 'LOGNAME', 'LANG', 'LC_ALL', 'TMPDIR', ...extra]) if (env[name]) clean[name] = env[name];
  return clean;
}

/** Resolves the configured executable and refuses anything other users could have modified. */
export async function resolveBinary(path: string, names: string[], label: string): Promise<string> {
  const allowed = names.flatMap(name => [name, `${name}.exe`, `${name}.cmd`]);
  if (!allowed.includes(basename(path).toLowerCase())) throw new PublicError('CLI_PATH', `The ${label} path must point to the ${names[0]} executable.`, 400);
  try {
    const resolved = await realpath(path);
    const info = await lstat(resolved);
    if (!info.isFile() || (process.platform !== 'win32' && (info.mode & 0o022) !== 0)) throw new Error('unsafe');
    await access(resolved, constants.X_OK);
    return resolved;
  } catch {
    throw new PublicError('CLI_MISSING', `${label} was not found at the configured path, is not executable, or is writable by other users.`, 503);
  }
}

export type JsonRecord = Record<string, unknown>;
export const isRecord = (value: unknown): value is JsonRecord => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

export function parseLine(line: string, code: string, label: string): JsonRecord {
  let data: unknown;
  try { data = JSON.parse(line); } catch { throw new PublicError(code, `${label} returned malformed output. Try again.`); }
  if (!isRecord(data)) throw new PublicError(code, `${label} returned an unexpected event.`);
  return data;
}
