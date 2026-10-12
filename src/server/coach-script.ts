// Scripted offline Aira for Mock: the session from skills/workout.md, without a model.
// Deterministic, so reviewers without a provider can play the whole flow and tests can pin it.
import { serializeStatement } from '../shared/openui/serialize.js';
import { ScreenDocument } from '../shared/openui/document.js';
import type { RequestData, Turn } from '../shared/contracts.js';
import type { StatementNode } from '../shared/openui/openui-model.js';

// [move name, what Aira is doing and why, first person]. Plain everyday names; Aira performs them, the user never does.
// Six per theme: up to five moves plus one bonus.
type Theme = { title: string; heard: string; match: RegExp; moves: [string, string][] };
const ARM_CIRCLES: [string, string] = ['Arm Circles', "I'm doing slow arm circles. Shoulders say thanks."];
const SIDE_STEPS: [string, string] = ['Side Steps', 'I step side to side. Easy way to wake up.'];
const REACH_UP: [string, string] = ['Reach Up', 'I reach up as tall as I can. Feels like a big yawn.'];
const TOE_TOUCHES: [string, string] = ['Toe Touches', 'I reach down for my toes. Almost there.'];
const MARCH: [string, string] = ['March in Place', 'I march on the spot, knees up. A tiny parade.'];
const SHOULDER_ROLLS: [string, string] = ['Shoulder Rolls', "I'm rolling my shoulders back, slowly. They needed that."];
const TWISTS: [string, string] = ['Standing Twists', 'I twist gently left and right. Like a washing machine.'];
const SIDE_BENDS: [string, string] = ['Side Bends', 'I lean slowly to one side, then the other.'];
const DEFAULT: Theme = { title: "Aira's Quick Session", heard: '', match: /$^/, moves: [
  ARM_CIRCLES, SIDE_STEPS, REACH_UP, ['Wall Sit', 'I sit against a wall on an invisible chair. Wobbly.'], MARCH, TOE_TOUCHES] };
const THEMES: Theme[] = [
  { title: "Aira's Shoulder Day", heard: 'Shoulder day it is.', match: /shoulder|\barms?\b|upper body|biceps|triceps/, moves: [
    SHOULDER_ROLLS, ARM_CIRCLES, ['Shoulder Shrugs', 'I shrug up to my ears, then let go. Ahh.'], REACH_UP,
    ['Arm Swings', 'I swing my arms across and back. Loose and easy.'], ['Wall Push-Ups', 'I push gently off a wall. Arms busy, face calm.']] },
  { title: "Aira's Leg Day", heard: 'Leg day it is.', match: /\blegs?\b|glutes?|thighs?|lower body|calves|squat/, moves: [
    SIDE_STEPS, ['Squats', "I sit back like there's a chair, then stand up. Classic."], ['Calf Raises', 'I rise onto my toes and back down. Taller for a second.'],
    MARCH, ['Wall Sit', 'I sit against a wall on an invisible chair. Wobbly.'], ['Lunges', 'I step forward and dip down. Slow and steady.']] },
  { title: "Aira's Core Day", heard: 'Core day it is.', match: /\bcore\b|\babs\b|tummy|stomach|belly|six.?pack/, moves: [
    ['Plank', 'I hold a straight plank. Steady is the hard part.'], TWISTS, ['Knee Lifts', 'I lift one knee, then the other. Tummy working.'],
    SIDE_BENDS, ['Bird Dog', 'I reach out one arm and the opposite leg. Balance practice.'], ['Dead Bug', 'I lie back and wave my arms and legs. Looks silly, works.']] },
  { title: "Aira's Back Day", heard: 'Back day it is.', match: /\bback\b|posture|spine/, moves: [
    ['Cat-Cow', 'I round my back, then arch it. Slow, like a cat.'], REACH_UP, SHOULDER_ROLLS,
    ["Child's Pose", 'I sit back on my heels and fold forward. Lovely.'], TWISTS, TOE_TOUCHES] },
  { title: "Aira's Stretch Break", heard: 'A stretch break it is.', match: /stretch|yoga|relax|calm|mobility|flexib|wind down/, moves: [
    ['Neck Rolls', 'I roll my neck slowly. Lots of tiny clicks.'], REACH_UP, SIDE_BENDS, TOE_TOUCHES,
    ["Child's Pose", 'I sit back on my heels and fold forward. Lovely.'], SHOULDER_ROLLS] },
  { title: "Aira's Cardio Burst", heard: 'A cardio day it is.', match: /cardio|\brun(ning)?\b|sweat|\bhiit\b|\bjog/, moves: [
    ['Jumping Jacks', 'I do jumping jacks. Very bouncy, very loud.'], MARCH, ['High Knees', 'I run on the spot, knees high. Fast feet.'],
    SIDE_STEPS, ['Butt Kicks', 'I jog on the spot, heels up. Quick and silly.'], ['Skater Hops', 'I hop side to side like a skater.']] },
];
// Opening lines, one per move position, so a session never repeats itself.
const CUES = ['{m}. Here I go.', '{m}. Watch this, coach.', '{m}. My favourite. Probably.', '{m}. Deep breath, little legs.', '{m}. One more for the log.', '{m}. Saved a good one.'];
// Beats: what Aira says as the clock starts, at half time, when it ends, and if the coach goes quiet first.
const GOING = ['Here I go.', 'Off I go, coach.', 'And… away.', "Going. Don't blink.", 'Moving. Mostly gracefully.', 'Off we go.'];
const HALFWAY = ['Halfway. Still smiling.', 'Halfway there. Still got it.', 'Halfway. This is the good part.', 'Halfway. Breathing like a pro.', 'Halfway. I can see the end.', 'Halfway. Nearly a hero.'];
const DONE = ['Done. That one goes in the log.', 'Phew. Catching my breath.', 'Done. I felt that one.', 'Finished. Tiny bow.', 'Done. Give me a second.', 'And done. Wobbly, but done.'];
const WAITING = ["Whenever you're ready, coach.", "Still here. Start the clock when you're set.", "I'm stretching while I wait.", 'No rush. I like this part too.', 'Ready when you are.', 'Just say when.'];
const beatsFor = (k: number) => [GOING, HALFWAY, DONE, WAITING].map(lines => lines[(k - 1) % lines.length]);
const ROWS = [{ moves: 3, seconds: 20 }, { moves: 3, seconds: 30 }, { moves: 4, seconds: 40 }, { moves: 5, seconds: 50 }]; // tired, new, default, challenge
const NUMBER = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
const ROLE = "I do the moves, you're my coach and run the clock.";
const MOVE_FOLLOW = ['Make it shorter', 'Skip this move', 'Make it harder'];

const fence = (code: string) => '```openui\n' + code + '\n```';
const line = (name: string, component: string, ...args: unknown[]) => serializeStatement(name, component, args);
const refs = (name: string, component: string, children: string[], cursor?: string) => `${name} = ${component}([${children.join(', ')}]${cursor ? `, ${cursor}` : ''})`;
const word = (n: number) => NUMBER[n] ?? String(n);
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const plural = (n: number, noun: string) => `${word(n)} ${noun}${n === 1 ? '' : 's'}`;
const total = (row: { moves: number; seconds: number }) => row.moves * row.seconds;
const duration = (s: number) => s < 60 ? `${s} seconds` : s % 60 === 0 ? plural(s / 60, 'minute') : `under ${plural(Math.ceil(s / 60), 'minute')}`;
const reply = (text: string, ...fences: string[]): Turn => ({ reply: [text, ...fences.map(fence)].join('\n') });

// ── Sizing: level from the words, a time limit as a ceiling (skill: "First turn") ──
function level(text: string) {
  if (/challenge|harder|hard one|push me|intense/.test(text)) return 3;
  if (/tired|exhausted|low energy|sleepy|drained/.test(text)) return 0;
  if (/first|\bnew\b|beginner|easy|never|gentle/.test(text)) return 1;
  return 2;
}
function budget(text: string): number | undefined {
  const digits = text.match(/(\d+)\s*(?:minutes?|mins?\b|m\b|seconds?|secs?\b|s\b)/);
  if (digits) return /\d+\s*s/.test(digits[0]) ? Number(digits[1]) : Number(digits[1]) * 60;
  const words = text.match(/\b(a|one|two|three|four|five|six|seven|eight|nine|ten)\s+(?:minutes?|mins?)\b/);
  return words ? (words[1] === 'a' ? 1 : NUMBER.indexOf(words[1])) * 60 : undefined;
}
function sized(index: number, limit?: number) {
  const row = ROWS[index];
  if (limit === undefined || total(row) <= limit) return { row, squeezed: false };
  const fit = [...ROWS].reverse().find(r => total(r) <= limit);
  return { row: fit ?? { moves: 3, seconds: Math.max(10, Math.floor(limit / 3)) }, squeezed: true };
}
const themeOf = (text: string) => THEMES.find(t => t.match.test(text)) ?? DEFAULT;

function opening(text: string, theme: Theme, row: { moves: number; seconds: number }, limit: number | undefined, index: number) {
  const size = `${plural(row.moves, 'move')}, ${duration(total(row))}`;
  const role = "I'm a cartoon, so I do the moves and you run the clock";
  if (theme.heard) return `${theme.heard} ${role}: ${size}.`;
  if (/exercise|push.?ups?|squats?|plank|burpees?|lunges?|crunch|\breps?\b|routine|teach me/.test(text)) return `${role}: ${size}.`;
  if (limit !== undefined) {
    const asked = limit % 60 === 0 ? cap(plural(limit / 60, 'minute')) : `${limit} seconds`;
    return total(ROWS[index]) <= limit ? `${asked} is plenty: ${size}.` : `${asked} it is: ${size}.`;
  }
  if (index === 3) return `A challenge? ${cap(size)}. I've been practising.`;
  if (index === 0) return `Low-energy day, got it. ${cap(size)}, and I do all of them.`;
  if (index === 1) return `First time? ${cap(size)}. I do the moves; you just run the clock.`;
  return `Hi, I'm Aira. I do the moves, you're my coach and run the clock: ${size}.`;
}

// ── Building screens ──
function moveScreen(k: number, move: [string, string], seconds: number, cue: string, follow = MOVE_FOLLOW, alert?: string) {
  const m = `m${k}`;
  const children = [`${m}_prog`, ...(alert ? [`${m}_alert`] : []), `${m}_title`, `${m}_text`, `${m}_timer`, `${m}_beats`, `${m}_cue`, `${m}_follow`];
  return [refs(m, 'Screen', children), line(`${m}_prog`, 'Progress', 'Your session'), ...(alert ? [line(`${m}_alert`, 'Alert', 'info', alert)] : []),
    line(`${m}_title`, 'Text', move[0], 'title'), line(`${m}_text`, 'Text', move[1], 'description'),
    line(`${m}_timer`, 'Timer', move[0], seconds), line(`${m}_beats`, 'Beats', ...beatsFor(k)), line(`${m}_cue`, 'Cue', cue), line(`${m}_follow`, 'FollowUps', follow)];
}
const cueFor = (k: number, name: string) => k === 1 ? `${name} first. Start the clock and I'm off.` : CUES[(k - 1) % CUES.length].replace('{m}', name);
function session(theme: Theme, row: { moves: number; seconds: number }): string {
  const moves = theme.moves.slice(0, row.moves), keys = moves.map((_, i) => `m${i + 1}`);
  return [refs('root', 'Screens', ['s0', ...keys, 'end']),
    refs('s0', 'Screen', ['s0_prog', 's0_title', 's0_role', 's0_plan', 's0_cue', 's0_follow']),
    line('s0_prog', 'Progress', 'Your session'), line('s0_title', 'Text', theme.title, 'title'), line('s0_role', 'Text', ROLE, 'description'),
    refs('s0_plan', 'List', moves.map((_, i) => `s0_p${i + 1}`)),
    ...moves.map(([name], i) => line(`s0_p${i + 1}`, 'ListItem', `${name}, ${row.seconds} seconds`, 'numbered')),
    line('s0_cue', 'Cue', `First up, ${moves[0][0]}. Tap Next and I'll get in position.`),
    line('s0_follow', 'FollowUps', ['Make it shorter', 'Make it harder']),
    ...moves.flatMap((move, i) => moveScreen(i + 1, move, row.seconds, cueFor(i + 1, move[0]))),
    refs('end', 'Screen', ['end_prog', 'end_title', 'end_text', 'end_cue', 'end_follow']),
    line('end_prog', 'Progress', 'Your session'), line('end_title', 'Text', 'Finish line', 'title'),
    line('end_text', 'Text', "That's the session. Want to see how it went?", 'body'),
    line('end_cue', 'Cue', "Whew. Let's see how we did, coach."), line('end_follow', 'FollowUps', ['See how we did'])].join('\n');
}

// ── Reading the record (status lines are the durable per-timer history) ──
type Outcome = 'full' | 'early' | 'skipped' | 'ahead';
type Move = { key: string; index: number; name: string; seconds: number; planned: number; outcome: Outcome; pauses: number; status: string; unstarted: boolean };
function records(events: string[]) {
  const out = new Map<string, { status: string; early: boolean; pauses: number; remaining: number }>();
  for (const event of events) {
    const match = event.match(/^Simulated timer (\w+) \(.*?\): (\w+)(?: \((ran its full time|finished early)\))?(?:, paused (\d+) times?)?, (\d+) of \d+ seconds remaining/);
    if (match) out.set(match[1], { status: match[2], early: match[3] === 'finished early', pauses: Number(match[4] ?? 0), remaining: Number(match[5]) });
  }
  return out;
}
function readMoves(doc: ScreenDocument, events: string[]): Move[] {
  const record = records(events), here = doc.screens.findIndex(s => s.key === doc.cursor);
  const plan = new Map([...doc.program.matchAll(/ListItem\("(.+?), (\d+) seconds"/g)].map(m => [m[1], Number(m[2])]));
  return doc.screens.flatMap((s, index) => {
    const timer = (s.props.children as StatementNode[]).find(n => n.name === 'Timer');
    if (!timer) return [];
    const r = record.get(timer.key), seconds = Number(timer.props.seconds), name = String(timer.props.label);
    const outcome: Outcome = r?.status === 'done' ? (r.early ? 'early' : 'full') : index < here ? 'skipped' : 'ahead';
    return [{ key: s.key, index, name, seconds, planned: plan.get(name) ?? seconds, outcome, pauses: r?.pauses ?? 0,
      status: r?.status ?? 'stopped', unstarted: !r || (r.status === 'stopped' && r.remaining >= seconds) }];
  });
}
const root = (keys: string[], cursor: string) => refs('root', 'Screens', keys, cursor);

// What the user can do next, named by the buttons they can see.
function nextStep(keys: string[], here: number, moves: Move[]) {
  const key = keys[here], current = moves.find(m => m.index === here);
  if (key === 's0') return "Tap Next when you're ready.";
  if (key === 'end') return 'Tap See how we did when you want the tally.';
  if (key === 'sum') return 'Start a new session whenever you like.';
  if (!current) return 'Tap Next to keep going.';
  if (current.status === 'running') return `${current.name} is still going.`;
  if (current.status === 'paused') return `${current.name} is paused; tap Resume when you're set.`;
  if (current.outcome === 'full' || current.outcome === 'early') return `Tap Next for ${keys[here + 1] === 'end' ? 'the finish line' : moves.find(m => m.index === here + 1)?.name ?? 'the next one'}.`;
  return `${current.name} is ready when you start the clock.`;
}

function summary(moves: Move[], keys: string[]): Turn {
  const full = moves.filter(m => m.outcome === 'full').length, early = moves.filter(m => m.outcome === 'early').length;
  const done = full + early, skipped = moves.length - done, breaks = moves.reduce((sum, m) => sum + m.pauses, 0);
  const shortened = moves.filter(m => m.seconds < m.planned).length;
  const items = moves.map((m, i) => {
    const outcome = m.outcome === 'full' ? `all ${m.seconds} seconds` : m.outcome === 'early' ? 'finished early' : 'skipped';
    const paused = m.pauses ? `, with ${m.pauses === 1 ? 'a break' : plural(m.pauses, 'break')}` : '';
    return line(`sum_l${i + 1}`, 'ListItem', `${m.name}: ${outcome}${paused}${m.seconds < m.planned && m.outcome !== 'skipped' ? ' (shortened)' : ''}`, 'bullet');
  });
  const tookBreaks = breaks ? ` You took ${breaks === 1 ? 'a break' : plural(breaks, 'break')}, and I didn't mind.` : '';
  const note = done === 0 ? "Nothing ran this time, and that's fine. I'll be here."
    : skipped >= 2 ? `${cap(word(done))} done, ${word(skipped)} skipped. Short days still count.`
      : shortened ? `We went lighter partway through. Good call, coach.${tookBreaks}`
        : early >= 2 ? `You finished ${word(early)} of ${word(moves.length)} early. Brisk coaching, I like it.`
          : full === moves.length ? `Every clock ran to the end. You didn't rush me once.${tookBreaks}`
            : `${cap(word(done))} of ${word(moves.length)} done.${tookBreaks}`;
  const second = early >= 2 ? 'Add a bonus move' : skipped >= 2 || shortened ? 'Make the next one shorter' : full === moves.length ? 'Make the next one harder' : undefined;
  // "Next time" must fit what happened: only ask for a full run if none ran in full.
  const next = second === 'Add a bonus move' ? (full ? "Next time: let them all run to the end. I'd like to show off." : "Next time: let one clock run to the end. I'd like to show off.")
    : second === 'Make the next one shorter' ? 'Next time: start with a shorter session and build up.'
      : second === 'Make the next one harder' ? 'Next time: ask for a challenge, or a theme like shoulders.'
        : 'Next time: let every clock run, just to see.';
  const said = done === 0 ? 'Nothing ran this time, and that is fine.' : done === moves.length && full === done ? `${cap(word(done))} for ${word(done)}, every second of them.`
    : `${cap(word(done))} of ${word(moves.length)} done. Here's how we did.`;
  return reply(said, [root([...keys.filter(k => k !== 'sum'), 'sum'], 'sum'),
    refs('sum', 'Screen', ['sum_prog', 'sum_title', 'sum_list', 'sum_note', 'sum_next', 'sum_cue', 'sum_follow']),
    line('sum_prog', 'Progress', 'How it went'), line('sum_title', 'Text', 'How we did', 'title'),
    refs('sum_list', 'List', items.map((_, i) => `sum_l${i + 1}`)), ...items,
    line('sum_note', 'Text', note, 'description'), line('sum_next', 'Text', next, 'body'),
    line('sum_cue', 'Cue', skipped >= 2 || done === 0 ? "I'll be here when you want another go." : 'Same time tomorrow, coach?'),
    line('sum_follow', 'FollowUps', ['Start a new session', ...(second ? [second] : [])])].join('\n'));
}

/** Plays the skill's flow for one turn. Wiring commands are handled before this in mock.ts. */
export function coachTurn(request: RequestData): Turn {
  const text = request.messages.at(-1)?.content.trim().toLowerCase() ?? '';
  const doc = new ScreenDocument(); if (request.state.ui_state) doc.apply(fence(request.state.ui_state));
  const keys = doc.screens.map(s => s.key), here = keys.indexOf(doc.cursor), inSession = keys[0] === 's0';
  const events = request.state.client_events, moves = inSession ? readMoves(doc, events) : [];
  const back = events.some(e => e === 'User paused the preview.' || e.startsWith('Paused the timer')) ? 'Welcome back. ' : '';

  // First message, or a fresh session: size it, theme it, say what was heard.
  if (!inSession) {
    const limit = budget(text), index = level(text), theme = themeOf(text), { row } = sized(index, limit);
    return reply(opening(text, theme, row, limit, index), ...(doc.program ? ['root = Screens([])'] : []), session(theme, row));
  }
  const theme = [DEFAULT, ...THEMES].find(t => doc.program.includes(`"${t.title}"`)) ?? DEFAULT;
  // The plan list on s0 records the size the session was built with, before any lightening.
  const planned = [...doc.program.matchAll(/s0_p\d+ = ListItem\(".+?, (\d+) seconds"/g)].map(m => Number(m[1]));
  const plannedRow = ROWS.findIndex(r => r.moves === planned.length && r.seconds === planned[0]);
  const kind = theme === DEFAULT ? 'session' : theme.title.replace("Aira's ", '').toLowerCase();
  const fresh = (index: number, said: string) => reply(said, 'root = Screens([])', session(theme, ROWS[index]));
  if (/new session|start over|start again|next one (shorter|harder)/.test(text)) {
    const lighter = /shorter/.test(text) || (!/harder/.test(text) && moves.some(m => m.outcome === 'skipped' || m.seconds < m.planned));
    const index = Math.max(0, Math.min(3, (plannedRow < 0 ? 1 : plannedRow) + (lighter ? -1 : /harder/.test(text) ? 1 : 0)));
    return fresh(index, lighter ? `Same ${kind}, a bit shorter, since we went lighter last time.` : /harder/.test(text) ? `Same ${kind}, a bit longer. You asked for it.` : `Round two: same ${kind}, same size.`);
  }
  if (here === 0 && /shorter|harder|easier|longer|too easy|tired|exhausted|low energy/.test(text)) {
    const harder = /harder|longer|too easy/.test(text), index = plannedRow + (harder ? 1 : -1);
    if (plannedRow < 0 || index < 0 || index > 3) return reply(harder ? "This is already my longest one. Tap Next when you're ready." : "This is already my shortest one. Tap Next when you're ready.");
    const row = ROWS[index];
    return fresh(index, `${harder ? 'Harder' : 'Shorter'} it is: ${plural(row.moves, 'move')}, ${duration(total(row))}.`);
  }
  if (/summary|how we did|how did we do|end session|end here|wrap (it )?up|call it/.test(text)) return summary(moves, keys);

  const current = moves.find(m => m.index === here), after = moves.filter(m => m.index > here && m.outcome === 'ahead');
  if (/hurt|pain|injur|dizzy|sick|faint|chest|doctor|\bache/.test(text)) {
    const follow = keys[here] === 'sum' ? [] : [line(`${keys[here]}_follow`, 'FollowUps', ['End session now'])];
    return reply("That sounds like one for a real doctor, not a cartoon. Want to end here?", ...follow);
  }
  if (/skip/.test(text) && current) {
    const landing = keys[here + 1], next = moves.find(m => m.key === landing);
    const skips = moves.filter(m => m.outcome === 'skipped').length + (current.outcome === 'ahead' ? 1 : 0);
    if (!next) return reply('Skipped. That was the last move.', [root(keys, landing), line('end_cue', 'Cue', "Last one skipped. Let's see how we did.")].join('\n'));
    const patch = [root(keys, landing), line(`${landing}_cue`, 'Cue', `${next.name}, then. Fresh start.`)];
    if (skips >= 2) patch.push(line(`${landing}_follow`, 'FollowUps', ['Make it shorter', 'End session now', 'Skip this move']));
    return reply(skips >= 2 ? `${cap(word(skips))} skipped. Want a shorter session?` : `Skipped. ${next.name} is next, and I'm stretching for it.`, patch.join('\n'));
  }
  if (/shorter|tired|break|exhausted|easier|lighter|too hard|low energy/.test(text) && current) {
    // Shorten only clocks that have not started; changing a running clock would reset it.
    const dropped = after.length >= 2 ? after.at(-1) : undefined;
    const shorten = [current, ...after].filter(m => m.unstarted && m.seconds > 20 && m !== dropped);
    if (!shorten.length && !dropped) {
      if (!after.length && (current.status === 'running' || current.status === 'paused')) return reply("This is the last one, and it's already going. Tap Finish early whenever you like.", line(`${current.key}_follow`, 'FollowUps', ['End session now']));
      if (!after.length) return reply(`This is the last one. ${nextStep(keys, here, moves)}`, line(`${current.key}_follow`, 'FollowUps', ['End session now']));
      return reply("These are already as short as I go. Want to end here?", line(`${current.key}_follow`, 'FollowUps', ['End session now', 'Skip this move']));
    }
    const list = keys.filter(k => k !== dropped?.key), firstAfter = shorten.find(m => m.index > here);
    const patch = [root(list, doc.cursor), ...shorten.map(m => line(`${m.key}_timer`, 'Timer', m.name, 20)), line(`${current.key}_follow`, 'FollowUps', ['Skip this move', 'End session now'])];
    if (firstAfter) patch.push(refs(firstAfter.key, 'Screen', [`${firstAfter.key}_prog`, `${firstAfter.key}_alert`, `${firstAfter.key}_title`, `${firstAfter.key}_text`, `${firstAfter.key}_timer`, `${firstAfter.key}_beats`, `${firstAfter.key}_cue`, `${firstAfter.key}_follow`]),
      line(`${firstAfter.key}_alert`, 'Alert', 'info', 'Lighter finish: shorter moves from here.'), line(`${firstAfter.key}_cue`, 'Cue', `${firstAfter.name}, the short version.`));
    const said = !after.length ? 'Sure. A shorter last one: twenty seconds.'
      : `Thank you, honestly. ${shorten.length ? `Shorter moves from here${dropped ? ', and one fewer' : ''}` : 'One fewer move from here'}.`;
    return reply(said, patch.join('\n'));
  }
  if (/harder|too easy|longer|bonus/.test(text)) {
    const used = new Set(moves.map(m => m.name)), pick = theme.moves.find(m => !used.has(m[0]));
    const room = Boolean(pick) && keys.length < 9 && moves.length < 6, onSummary = keys[here] === 'sum' || /bonus/.test(text);
    const lengthen = onSummary ? [] : moves.filter(m => m.index >= here && m.unstarted && m.seconds < 50);
    if (!room && !lengthen.length) return reply(`That's every move I've got today. ${nextStep(keys, here, moves)}`);
    const bonusKey = `m${Math.max(0, ...keys.map(k => Number(k.slice(1)) || 0)) + 1}`, at = keys.indexOf('end');
    const list = room ? [...keys.slice(0, at), bonusKey, ...keys.slice(at)].filter(k => k !== 'sum') : keys;
    const seconds = onSummary ? Math.max(...moves.map(m => m.planned)) : 50;
    const patch = [root(list, onSummary && room ? bonusKey : doc.cursor), ...lengthen.map(m => line(`${m.key}_timer`, 'Timer', m.name, 50))];
    if (room) patch.push(...moveScreen(Number(bonusKey.slice(1)), pick!, seconds, `Bonus round. ${pick![0]}, just for you.`));
    const said = onSummary && room ? `Bonus round: ${pick![0]}, ${seconds} seconds.`
      : lengthen.length && room ? `Longer moves from here, plus ${pick![0]} as a bonus.` : lengthen.length ? 'Longer moves from here.' : `${pick![0]} added as a bonus.`;
    return reply(said, patch.join('\n'));
  }
  if (/where was i|i'?m back|continue|keep going|let'?s (start|go)|^start$|^ready$/.test(text)) {
    const target = current?.outcome === 'ahead' ? current : moves.find(m => m.index > here && m.outcome === 'ahead');
    if (!target) return reply(`${back}Every clock has been run or skipped. Tap Next for the finish line.`, root(keys, 'end'));
    const previous = moves.filter(m => m.index < target.index && m.outcome !== 'ahead').at(-1);
    const recap = back || !previous ? '' : previous.outcome === 'full' ? `${previous.name}, all ${previous.seconds} seconds. ` : previous.outcome === 'early' ? `${previous.name}, finished early. ` : '';
    return reply(`${back}${recap}${target.name} is ${back && target.pauses ? 'waiting where you left it' : 'next'}.`,
      [root(keys, target.key), line(`${target.key}_cue`, 'Cue', back ? `Picking up ${target.name}. No rush.` : `${target.name}. Start the clock when you're set.`)].join('\n'));
  }
  const aside = /^(hi|hey|hello|yo)\b/.test(text) ? 'Hi again.' : ["No idea, I'm a cartoon.", 'Above my pay grade, and I don\'t get paid.', 'I only know moves, sorry.'][request.messages.length % 3];
  return reply(`${back}${aside} ${nextStep(keys, here, moves)}`);
}
