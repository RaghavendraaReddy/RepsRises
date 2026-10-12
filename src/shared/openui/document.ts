import { callArgsOf, linesById, reachableStatements, statementCallOf, statementIdOf } from './parse-document.js';
import { propValidators, validateProgram } from './validate.js';
import { OPENUI_LIBRARY } from './openui-library.js';
import type { StatementNode } from './openui-model.js';

export function splitReply(reply: string): { prose: string; fences: string[] } {
  const lines = reply.split('\n'), fences: string[] = [], prose: string[] = []; let inside = false, block: string[] = [];
  for (const line of lines) {
    if (line.trim() === '```openui' && !inside) { inside = true; block = []; }
    else if (line.trim() === '```' && inside) { inside = false; fences.push(block.join('\n')); }
    else if (line.includes('```')) throw new Error('Only complete openui fences are supported.');
    else if (inside) block.push(line); else prose.push(line);
  }
  if (inside) throw new Error('The screen fence was incomplete. Retry this turn.');
  return { prose: prose.join('\n').trim(), fences };
}
function validBeats(line: string) {
  const call = callArgsOf(line), spec = OPENUI_LIBRARY.Beats;
  if (!call || call.name !== 'Beats' || call.args.length < spec.required || call.args.length > spec.args.length) return false;
  if (!call.args.every(arg => arg?.k === 'str' || arg?.k === 'null')) return false;
  return propValidators.Beats(Object.fromEntries(spec.args.map((name, i) => { const arg = call.args[i]; return [name, arg?.k === 'str' ? arg.v : undefined]; })));
}
/**
 * Beats are optional timing lines, so they never cost the user a screen. A malformed Beats statement (or one
 * named `*_beats` that does not parse), and any reference to Beats that was never written, is dropped from the
 * fence; everything else still goes through full validation. Returns the names it dropped.
 */
export function tolerateBeats(fence: string, program: string): { fence: string; dropped: string[] } {
  const dropped: string[] = [];
  const kept = fence.split('\n').filter(line => {
    const id = statementIdOf(line) ?? line.match(/^\s*([A-Za-z_]\w*)\s*=/)?.[1] ?? null;
    const beats = statementCallOf(line) === 'Beats' || /=\s*Beats\s*\(/.test(line) || (id !== null && /_beats$/.test(id));
    if (!beats || validBeats(line)) return true;
    dropped.push(id ?? '(unnamed)'); return false;
  });
  const defined = new Set([...linesById(program).keys(), ...linesById(kept.join('\n')).keys()]);
  const strip = (name: string) => !defined.has(name) && (/_beats$/.test(name) || dropped.includes(name));
  const out = kept.map(line => {
    const call = statementCallOf(line) === 'Screen' ? callArgsOf(line) : null, list = call?.args[0];
    if (!call || list?.k !== 'list' || !list.v.every(arg => arg?.k === 'ref')) return line;
    const names = list.v.map(arg => (arg as { v: string }).v);
    if (!names.some(strip)) return line;
    for (const name of names) if (strip(name) && !dropped.includes(name)) dropped.push(name);
    const seen = call.args[1];
    if (seen && !(seen.k === 'list' && seen.v.every(arg => arg?.k === 'str'))) return line;
    const extra = seen?.k === 'list' ? `, ${JSON.stringify(seen.v.map(arg => (arg as { v: string }).v))}` : '';
    return `${statementIdOf(line)} = Screen([${names.filter(name => !strip(name)).join(', ')}]${extra})`;
  });
  return { fence: out.join('\n'), dropped };
}
export class ScreenDocument {
  program = ''; cursor = ''; prose = ''; clearVersion = 0;
  /** Beats names the last apply() dropped as malformed or unwritten. */
  dropped: string[] = [];
  apply(reply: string) {
    const parsed = splitReply(reply); let program = this.program, cursor = this.cursor, clears = 0; const dropped: string[] = [];
    for (const raw of parsed.fences) {
      const rawLines = raw.split('\n').filter(l => l.trim());
      if (rawLines.length === 1 && /^root\s*=\s*Screens\(\[\]\)\s*$/.test(rawLines[0].trim())) { program = ''; cursor = ''; clears++; continue; }
      const tolerated = tolerateBeats(raw, program), fence = tolerated.fence, lines = fence.split('\n').filter(l => l.trim());
      const next = [program, fence].filter(Boolean).join('\n');
      const root = validateProgram(next); const screens = root.props.screens as StatementNode[];
      const rootLine = lines.find(l => /^root\s*=/.test(l.trim()));
      const requested = rootLine ? callArgsOf(rootLine)?.args[1] : undefined;
      if (requested?.k === 'ref') cursor = requested.v;
      if (!screens.some(s => s.key === cursor)) cursor = screens[0]?.key ?? '';
      program = next; dropped.push(...tolerated.dropped);
    }
    this.program = program; this.cursor = cursor; this.prose = parsed.prose; this.clearVersion += clears; this.dropped = dropped;
  }
  get screens(): StatementNode[] { return this.program ? validateProgram(this.program).props.screens as StatementNode[] : []; }
  get current(): StatementNode | undefined { return this.screens.find(s => s.key === this.cursor); }
  move(index: number) { const target = this.screens[index]; if (target) this.cursor = target.key; }
  echo(): string {
    if (!this.program) return '';
    const reached = reachableStatements(this.program); const bindings = [...linesById(this.program)].filter(([id]) => reached?.has(id));
    const root = `root = Screens([${this.screens.map(s => s.key).join(', ')}]${this.cursor ? `, ${this.cursor}` : ''})`;
    return bindings.map(([id,line]) => id === 'root' ? root : line).join('\n');
  }
  reset() { this.program = ''; this.cursor = ''; this.prose = ''; this.clearVersion++; }
}
