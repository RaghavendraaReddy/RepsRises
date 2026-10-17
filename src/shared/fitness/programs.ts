import { available, exerciseById, levelAllows } from './exercises.js';
import type { Audience, Equipment, Exercise, Goal, Level, Plan, PlanDay, PlanExercise, SplitId } from './types.js';

export function uid(prefix = 'id'): string {
  const random = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID().replace(/-/g, '').slice(0, 12)
    : Math.random().toString(36).slice(2, 14);
  return `${prefix}_${random}`;
}

// Ordered preferences per movement slot. The first available, level-appropriate option wins;
// variants (A/B days) start further down the list for variety.
const SLOTS = {
  squat: ['back-squat', 'front-squat', 'goblet-squat', 'leg-press', 'split-squat', 'bodyweight-squat'],
  hinge: ['deadlift', 'barbell-rdl', 'romanian-deadlift', 'kettlebell-swing', 'hip-thrust', 'good-morning', 'glute-bridge', 'superman'],
  lunge: ['dumbbell-lunge', 'split-squat', 'dumbbell-step-up', 'walking-lunge', 'step-up-knee-raise'],
  hpush: ['bench-press', 'dumbbell-bench-press', 'dumbbell-floor-press', 'push-up', 'incline-push-up'],
  vpush: ['barbell-press', 'overhead-press', 'kettlebell-press', 'arnold-press', 'push-up'],
  vpull: ['pull-up', 'chin-up', 'lat-pulldown', 'inverted-row', 'band-back-fly'],
  hpull: ['barbell-row', 'dumbbell-row', 'cable-row', 'inverted-row', 'band-back-fly'],
  chest: ['cable-fly', 'dumbbell-bench-press', 'dumbbell-floor-press', 'incline-push-up', 'push-up', 'close-grip-push-up'],
  delts: ['lateral-raise', 'face-pull', 'rear-delt-raise', 'band-pull-apart', 'arm-circles'],
  biceps: ['dumbbell-curl', 'hammer-curl', 'chin-up', 'inverted-row'],
  triceps: ['cable-pushdown', 'triceps-extension', 'dip', 'close-grip-push-up', 'push-up'],
  glutes: ['hip-thrust', 'single-leg-glute-bridge', 'glute-bridge', 'glute-kickback'],
  hamstrings: ['barbell-rdl', 'romanian-deadlift', 'single-leg-rdl', 'good-morning', 'glute-bridge', 'superman'],
  calves: ['calf-raise', 'dumbbell-calf-raise', 'band-calf-raise'],
  core: ['hanging-leg-raise', 'cable-crunch', 'dead-bug', 'crunch', 'flutter-kicks', 'plank'],
  hold: ['plank', 'side-plank', 'dead-bug', 'superman'],
  conditioning: ['kettlebell-swing', 'treadmill-jog', 'mountain-climber', 'jump-squat', 'fast-skipping', 'treadmill-walk'],
  carry: ['farmer-carry', 'plank'],
  mobility: ['cat-cow', 'hip-circles', 'arm-circles', 'calf-stretch', 'ankle-circles', 'chair-back-stretch'],
  play: ['fast-skipping', 'lateral-cone-hops', 'butt-kicks', 'mountain-climber', 'jump-squat'],
  balance: ['step-up-knee-raise', 'split-squat', 'hip-circles', 'ankle-circles'],
} satisfies Record<string, string[]>;

type Slot = keyof typeof SLOTS;
type Role = 'main' | 'accessory' | 'core' | 'recovery';
type SlotUse = [slot: Slot, role: Role, variant?: number];
type DayTemplate = { name: string; focus: string; slots: SlotUse[] };

const UPPER_A: DayTemplate = { name: 'Upper A', focus: 'Chest, back and shoulders', slots: [['hpush', 'main'], ['hpull', 'main'], ['vpush', 'main', 1], ['vpull', 'accessory'], ['biceps', 'accessory'], ['triceps', 'accessory']] };
const UPPER_B: DayTemplate = { name: 'Upper B', focus: 'Shoulders, back and arms', slots: [['vpush', 'main'], ['vpull', 'main'], ['hpush', 'main', 1], ['hpull', 'accessory', 1], ['delts', 'accessory'], ['biceps', 'accessory', 1]] };
const LOWER_A: DayTemplate = { name: 'Lower A', focus: 'Quads, glutes and core', slots: [['squat', 'main'], ['hamstrings', 'main'], ['lunge', 'accessory'], ['calves', 'accessory'], ['core', 'core']] };
const LOWER_B: DayTemplate = { name: 'Lower B', focus: 'Hinge, glutes and core', slots: [['hinge', 'main'], ['squat', 'main', 2], ['glutes', 'accessory'], ['calves', 'accessory'], ['hold', 'core']] };
const PUSH: DayTemplate = { name: 'Push', focus: 'Chest, shoulders and triceps', slots: [['hpush', 'main'], ['vpush', 'main'], ['chest', 'accessory'], ['delts', 'accessory'], ['triceps', 'accessory']] };
const PULL: DayTemplate = { name: 'Pull', focus: 'Back, rear delts and biceps', slots: [['vpull', 'main'], ['hpull', 'main'], ['hpull', 'accessory', 2], ['delts', 'accessory', 1], ['biceps', 'accessory'], ['core', 'core']] };
const LEGS: DayTemplate = { name: 'Legs', focus: 'Quads, hamstrings, glutes and calves', slots: [['squat', 'main'], ['hinge', 'main', 1], ['lunge', 'accessory'], ['calves', 'accessory'], ['hold', 'core']] };
const variant = (day: DayTemplate, name: string, shift: number): DayTemplate =>
  ({ name, focus: day.focus, slots: day.slots.map(([slot, role, offset]) => [slot, role, (offset ?? 0) + shift] as SlotUse) });

const SPLIT_AUDIENCES: Record<Exclude<SplitId, 'custom'>, Audience[]> = {
  'full-body-3': ['adults', 'older'], 'upper-lower-4': ['adults'], 'ppl-3': ['adults'], 'ppl-6': ['adults'], 'hybrid-5': ['adults'], 'full-week-7': ['adults'], 'play-move-3': ['kids'], 'active-ageing-3': ['older'],
};

const TEMPLATES: Record<Exclude<SplitId, 'custom'>, { name: string; summary: string; days: DayTemplate[] }> = {
  'full-body-3': {
    name: 'Full Body · 3 days', summary: 'Every major muscle three times a week. The most efficient start for most people.',
    days: [
      { name: 'Full Body A', focus: 'Squat, press and row', slots: [['squat', 'main'], ['hpush', 'main'], ['hpull', 'main'], ['hamstrings', 'accessory'], ['delts', 'accessory'], ['core', 'core']] },
      { name: 'Full Body B', focus: 'Hinge, overhead and pull', slots: [['hinge', 'main'], ['vpush', 'main'], ['vpull', 'main'], ['lunge', 'accessory'], ['biceps', 'accessory'], ['hold', 'core']] },
      { name: 'Full Body C', focus: 'Squat variation and arms', slots: [['squat', 'main', 2], ['hpush', 'main', 1], ['hpull', 'main', 1], ['glutes', 'accessory'], ['triceps', 'accessory'], ['core', 'core', 2]] },
    ],
  },
  'upper-lower-4': { name: 'Upper / Lower · 4 days', summary: 'Two upper and two lower sessions. More volume per muscle with built-in recovery.', days: [UPPER_A, LOWER_A, UPPER_B, LOWER_B] },
  'ppl-3': { name: 'Push / Pull / Legs · 3 days', summary: 'Each session owns one movement family. Simple to follow, easy to progress.', days: [PUSH, PULL, LEGS] },
  'ppl-6': { name: 'Push / Pull / Legs · 6 days', summary: 'The classic high-frequency split for experienced lifters with time to train.', days: [PUSH, PULL, LEGS, variant(PUSH, 'Push B', 1), variant(PULL, 'Pull B', 1), variant(LEGS, 'Legs B', 1)] },
  'hybrid-5': { name: 'Hybrid · 5 days', summary: 'Upper and lower early in the week, push, pull and legs to finish.', days: [UPPER_A, LOWER_A, PUSH, PULL, LEGS] },
  'play-move-3': {
    name: 'Play & Move · 3 days', summary: 'Short, game-like sessions for kids: running, hopping, balance and bodyweight strength. Always supervised by an adult.',
    days: [
      { name: 'Jump & Balance', focus: 'Coordination, hopping and balance', slots: [['mobility', 'recovery', 2], ['play', 'recovery'], ['squat', 'recovery', 5], ['play', 'recovery', 1], ['hold', 'recovery'], ['mobility', 'recovery']] },
      { name: 'Animal Strength', focus: 'Bodyweight strength through play', slots: [['mobility', 'recovery', 2], ['hpush', 'recovery', 4], ['glutes', 'recovery', 2], ['lunge', 'recovery', 3], ['play', 'recovery', 3], ['hold', 'recovery', 1]] },
      { name: 'Run & Stretch', focus: 'Running games and gentle stretching', slots: [['play', 'recovery'], ['play', 'recovery', 2], ['hinge', 'recovery', 7], ['mobility', 'recovery'], ['mobility', 'recovery', 4]] },
    ],
  },
  'active-ageing-3': {
    name: 'Active Ageing · 3 days', summary: 'Strength, balance and mobility for older adults, with supported options for every exercise. Check with a health professional if you have medical concerns.',
    days: [
      { name: 'Strength & Balance A', focus: 'Legs, balance and posture', slots: [['mobility', 'recovery', 2], ['squat', 'accessory', 3], ['balance', 'accessory'], ['hpull', 'accessory', 2], ['hold', 'core', 2], ['calves', 'accessory', 2]] },
      { name: 'Walk & Mobility', focus: 'Steady cardio and joint mobility', slots: [['conditioning', 'recovery', 5], ['mobility', 'recovery'], ['mobility', 'recovery', 1], ['mobility', 'recovery', 3], ['glutes', 'recovery', 2]] },
      { name: 'Strength & Balance B', focus: 'Upper body, hips and balance', slots: [['mobility', 'recovery', 1], ['hpush', 'accessory', 2], ['vpull', 'accessory', 2], ['balance', 'accessory', 1], ['hamstrings', 'accessory', 1], ['delts', 'accessory', 3]] },
    ],
  },
  'full-week-7': {
    name: 'Full Week · 7 days', summary: 'Five training days plus two lighter recovery days for conditioning and mobility.',
    days: [UPPER_A, LOWER_A,
      { name: 'Conditioning', focus: 'Heart rate, carries and mobility', slots: [['conditioning', 'recovery'], ['carry', 'recovery'], ['conditioning', 'recovery', 2], ['mobility', 'recovery']] },
      PUSH, PULL, LEGS,
      { name: 'Recovery', focus: 'Mobility and easy core', slots: [['mobility', 'recovery'], ['mobility', 'recovery', 1], ['hold', 'recovery'], ['glutes', 'recovery', 1]] }],
  },
};

export const SPLITS = Object.entries(TEMPLATES).map(([id, template]) => ({ id: id as Exclude<SplitId, 'custom'>, name: template.name, summary: template.summary, days: template.days.length, audiences: SPLIT_AUDIENCES[id as Exclude<SplitId, 'custom'>] }));

/** Which audiences each programme is offered to. Kids only see the supervised play programme. */
export function splitsFor(audience: Audience) { return SPLITS.filter(split => split.audiences.includes(audience)); }

export function recommendedSplit(daysPerWeek: number, level: Level, audience: Audience = 'adults'): Exclude<SplitId, 'custom'> {
  if (audience === 'kids') return 'play-move-3';
  if (audience === 'older') return daysPerWeek >= 3 ? 'active-ageing-3' : 'full-body-3';
  if (daysPerWeek <= 3) return level === 'beginner' ? 'full-body-3' : daysPerWeek === 3 ? 'ppl-3' : 'full-body-3';
  if (daysPerWeek === 4) return 'upper-lower-4';
  if (daysPerWeek === 5) return 'hybrid-5';
  if (daysPerWeek === 6) return level === 'beginner' ? 'hybrid-5' : 'ppl-6';
  return 'full-week-7';
}

type Prescription = { sets: number; reps: number | null; repsMax: number | null; seconds: number | null; restSec: number };

/** Sensible starting points, not guarantees. Users adjust everything in the plan builder. */
export function prescribe(exercise: Exercise, role: Role, level: Level, goal: Goal, audience: Audience = 'adults'): Prescription {
  // Kids: short, playful bouts. Older adults: moderate reps and generous rest. No heavy low-rep work for either.
  if (audience === 'kids') return exercise.kind === 'time' ? { sets: 2, reps: null, repsMax: null, seconds: 20, restSec: 45 } : { sets: 2, reps: 6, repsMax: 10, seconds: null, restSec: 45 };
  if (audience === 'older') return exercise.kind === 'time' ? { sets: 2, reps: null, repsMax: null, seconds: exercise.pattern === 'cardio' ? 300 : 30, restSec: 60 } : { sets: role === 'main' ? 3 : 2, reps: 8, repsMax: 12, seconds: null, restSec: 90 };
  const tier = level === 'beginner' ? 0 : level === 'intermediate' ? 1 : 2;
  if (role === 'recovery') return exercise.kind === 'time'
    ? { sets: 2, reps: null, repsMax: null, seconds: exercise.pattern === 'mobility' ? 45 : [30, 40, 45][tier], restSec: 30 }
    : { sets: 2, reps: 12, repsMax: 15, seconds: null, restSec: 45 };
  if (exercise.kind === 'time') {
    const seconds = exercise.pattern === 'carry' ? 40 : [30, 40, 45][tier];
    return { sets: role === 'core' ? [2, 3, 3][tier] : 3, reps: null, repsMax: null, seconds, restSec: 45 };
  }
  const main = role === 'main';
  const sets = main ? [3, 4, 4][tier] + (goal === 'strength' && tier === 2 ? 1 : 0) : role === 'core' ? [2, 3, 3][tier] : [2, 3, 3][tier];
  let [reps, repsMax]: [number, number] = main ? [...({ strength: [5, 6], muscle: [8, 10], endurance: [12, 15], general: [8, 12] } as const)[goal]] : [...({ strength: [8, 10], muscle: [10, 12], endurance: [15, 20], general: [10, 12] } as const)[goal]];
  if (main && goal === 'strength' && tier === 0) [reps, repsMax] = [6, 8];
  if (!exercise.loaded && exercise.compound && goal === 'strength') [reps, repsMax] = [6, 10];
  let restSec = main ? [90, 120, 150][tier] : 60 + tier * 15;
  if (goal === 'strength' && main) restSec += 30;
  if (goal === 'endurance') restSec = main ? 60 : 45;
  return { sets, reps, repsMax, seconds: null, restSec };
}

function choose(slot: Slot, shift: number, equipment: readonly Equipment[], level: Level, used: Set<string>, audience: Audience = 'adults'): Exercise | undefined {
  const candidates = SLOTS[slot].map(id => exerciseById(id)).filter((exercise): exercise is Exercise =>
    Boolean(exercise) && available(exercise!, equipment) && levelAllows(level, exercise!.level) && exercise!.audiences.includes(audience));
  const fresh = candidates.filter(exercise => !used.has(exercise.id));
  const pool = fresh.length ? fresh : candidates;
  return pool.length ? pool[shift % pool.length] : undefined;
}

export function planExercise(exercise: Exercise, prescription: Prescription, note = ''): PlanExercise {
  return { uid: uid('px'), exerciseId: exercise.id, ...prescription, note };
}

/** Rough session length in minutes: work time, rest between sets and a minute of setup per exercise. */
export function estimateMinutes(exercises: Pick<PlanExercise, 'sets' | 'reps' | 'repsMax' | 'seconds' | 'restSec'>[]): number {
  let seconds = 0;
  exercises.forEach((item, index) => {
    const work = item.seconds ?? Math.round(((item.reps ?? 10) + (item.repsMax ?? item.reps ?? 10)) / 2 * 3.5);
    const restCount = index === exercises.length - 1 ? item.sets - 1 : item.sets;
    seconds += item.sets * work + Math.max(0, restCount) * item.restSec + 60;
  });
  return Math.max(1, Math.round(seconds / 60));
}

/** Trim accessories, then accessory sets, until the day fits the user's time. Main lifts stay. */
export function fitToTime(exercises: PlanExercise[], minutes: number): PlanExercise[] {
  const result = exercises.map(item => ({ ...item }));
  const isMain = (item: PlanExercise) => Boolean(exerciseById(item.exerciseId)?.compound) && item.sets >= 3 && item.restSec >= 90;
  while (estimateMinutes(result) > minutes && result.length > 3) {
    const removable = [...result].reverse().findIndex((item, index) => index > 0 && !isMain(item));
    if (removable < 0) break;
    result.splice(result.length - 1 - removable, 1);
  }
  for (const item of [...result].reverse()) {
    while (estimateMinutes(result) > minutes && !isMain(item) && item.sets > 2) item.sets--;
  }
  return result;
}

export type GenerateOptions = { split: Exclude<SplitId, 'custom'>; level: Level; goal: Goal; equipment: readonly Equipment[]; minutes: number; now?: number; audience?: Audience };

export function generatePlan(options: GenerateOptions): Plan {
  const template = TEMPLATES[options.split];
  const equipment = options.equipment.length ? options.equipment : ['bodyweight' as Equipment];
  const days: PlanDay[] = template.days.map(day => {
    const used = new Set<string>();
    const exercises: PlanExercise[] = [];
    for (const [slot, role, shift = 0] of day.slots) {
      const exercise = choose(slot, shift, equipment, options.level, used, options.audience);
      if (!exercise || used.has(exercise.id)) continue;
      used.add(exercise.id);
      exercises.push(planExercise(exercise, prescribe(exercise, role, options.level, options.goal, options.audience)));
    }
    return { id: uid('day'), name: day.name, focus: day.focus, exercises: fitToTime(exercises, options.minutes) };
  });
  const now = options.now ?? Date.now();
  return { version: 1, id: uid('plan'), name: template.name.split(' · ')[0], split: options.split, level: options.level, goal: options.goal, days, createdAt: now, updatedAt: now };
}

/** A focused single session (used by the offline coach and quick start). */
export function generateSession(options: { muscles: string[]; level: Level; goal: Goal; equipment: readonly Equipment[]; minutes: number; audience?: Audience }): PlanExercise[] {
  const wanted = new Set(options.muscles);
  const pick: SlotUse[] = [];
  const add = (...uses: SlotUse[]) => pick.push(...uses);
  const full = wanted.has('full') || wanted.size === 0;
  if (full) add(['squat', 'main'], ['hpush', 'main'], ['hpull', 'main'], ['hinge', 'main', 1], ['delts', 'accessory'], ['core', 'core']);
  if (wanted.has('chest')) add(['hpush', 'main'], ['hpush', 'main', 1], ['chest', 'accessory'], ['triceps', 'accessory']);
  if (wanted.has('back')) add(['vpull', 'main'], ['hpull', 'main'], ['hpull', 'accessory', 1], ['biceps', 'accessory']);
  if (wanted.has('shoulders')) add(['vpush', 'main'], ['delts', 'accessory'], ['delts', 'accessory', 1], ['hpull', 'accessory', 2]);
  if (wanted.has('arms') || wanted.has('biceps') || wanted.has('triceps')) add(['biceps', 'accessory'], ['triceps', 'accessory'], ['biceps', 'accessory', 1], ['triceps', 'accessory', 1]);
  if (wanted.has('legs') || wanted.has('quads')) add(['squat', 'main'], ['lunge', 'accessory'], ['hamstrings', 'accessory'], ['calves', 'accessory']);
  if (wanted.has('glutes') || wanted.has('hamstrings')) add(['hinge', 'main'], ['glutes', 'accessory'], ['lunge', 'accessory'], ['hamstrings', 'accessory', 1]);
  if (wanted.has('core')) add(['core', 'core'], ['hold', 'core'], ['core', 'core', 2], ['carry', 'core']);
  if (wanted.has('cardio')) add(['conditioning', 'recovery'], ['conditioning', 'recovery', 1], ['conditioning', 'recovery', 2], ['carry', 'recovery'], ['mobility', 'recovery']);
  if (wanted.has('mobility')) add(['mobility', 'recovery'], ['mobility', 'recovery', 1], ['hold', 'recovery'], ['glutes', 'recovery', 1]);
  const used = new Set<string>();
  const exercises: PlanExercise[] = [];
  for (const [slot, role, shift = 0] of pick) {
    const exercise = choose(slot, shift, options.equipment.length ? options.equipment : ['bodyweight'], options.level, used, options.audience);
    if (!exercise || used.has(exercise.id)) continue;
    used.add(exercise.id);
    exercises.push(planExercise(exercise, prescribe(exercise, role, options.level, options.goal, options.audience)));
  }
  return fitToTime(exercises.slice(0, 8), options.minutes);
}

export function emptyPlan(name = 'My plan', level: Level = 'intermediate', goal: Goal = 'general'): Plan {
  const now = Date.now();
  return { version: 1, id: uid('plan'), name, split: 'custom', level, goal, days: [{ id: uid('day'), name: 'Day 1', focus: 'Custom session', exercises: [] }], createdAt: now, updatedAt: now };
}

export function describeTarget(item: Pick<PlanExercise, 'sets' | 'reps' | 'repsMax' | 'seconds'>): string {
  const per = item.seconds ? `${item.seconds}s` : item.repsMax && item.repsMax !== item.reps ? `${item.reps}–${item.repsMax}` : `${item.reps ?? '—'}`;
  return `${item.sets} × ${per}`;
}
