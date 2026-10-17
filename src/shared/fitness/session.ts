import { exerciseById } from './exercises.js';
import { uid } from './programs.js';
import type { ActiveSession, CompletedWorkout, Countdown, PlanExercise, SessionExercise, SetLog } from './types.js';

// Pure, timestamp-based workout engine. Every function takes `now` and returns a new session, so
// timers survive reloads, backgrounded tabs and screen changes, and the logic is easy to test.

export type SessionInput = { title: string; source: ActiveSession['source']; planId?: string | null; dayId?: string | null; exercises: (PlanExercise & { name?: string })[] };

export function startSession(input: SessionInput, now: number): ActiveSession {
  const exercises: SessionExercise[] = input.exercises.map(item => {
    const exercise = exerciseById(item.exerciseId);
    const kind = exercise?.kind ?? (item.seconds ? 'time' : 'reps');
    return {
      uid: item.uid || uid('sx'), exerciseId: item.exerciseId, name: exercise?.name ?? item.name ?? 'Exercise', kind,
      loaded: exercise?.loaded ?? false, targetReps: item.reps, targetRepsMax: item.repsMax, targetSeconds: item.seconds,
      restSec: item.restSec, note: item.note,
      sets: Array.from({ length: Math.max(1, item.sets) }, () => blankSet(kind === 'time' ? item.seconds : null, kind === 'reps' ? item.reps : null)),
    };
  });
  if (!exercises.length) throw new Error('A workout needs at least one exercise.');
  return { version: 1, id: uid('w'), title: input.title, source: input.source, planId: input.planId ?? null, dayId: input.dayId ?? null,
    startedAt: now, pausedAt: null, pausedMs: 0, index: 0, rest: null, hold: null, exercises };
}

function blankSet(seconds: number | null, reps: number | null): SetLog {
  return { reps, loadKg: null, seconds, done: false, completedAt: null };
}

const clone = (session: ActiveSession): ActiveSession => structuredClone(session);

export function elapsedMs(session: ActiveSession, now: number): number {
  const pausedNow = session.pausedAt ? now - session.pausedAt : 0;
  return Math.max(0, now - session.startedAt - session.pausedMs - pausedNow);
}

export function remainingMs(countdown: Countdown | null, now: number): number {
  if (!countdown) return 0;
  if (countdown.endsAt === null) return Math.max(0, countdown.remainingMs ?? 0);
  return Math.max(0, countdown.endsAt - now);
}

/** First exercise/set that still needs doing, or null when everything is logged. */
export function nextOpenSet(session: ActiveSession, from = session.index): { exerciseIndex: number; setIndex: number } | null {
  const order = [...session.exercises.keys()].map(offset => (from + offset) % session.exercises.length);
  for (const exerciseIndex of order) {
    const setIndex = session.exercises[exerciseIndex].sets.findIndex(set => !set.done);
    if (setIndex >= 0) return { exerciseIndex, setIndex };
  }
  return null;
}

export function isComplete(session: ActiveSession) {
  return session.exercises.every(exercise => exercise.sets.every(set => set.done));
}

export type SetValues = { reps?: number | null; loadKg?: number | null; seconds?: number | null };

function validValues(values: SetValues) {
  const ok = (value: number | null | undefined, max: number) => value === undefined || value === null || (Number.isFinite(value) && value >= 0 && value <= max);
  if (!ok(values.reps, 1000) || !ok(values.loadKg, 1000) || !ok(values.seconds, 3600)) throw new Error('Check the reps, load and time for this set.');
}

/** Log a set. Starts the rest timer unless it was the last open set. Idempotent for an already-done set. */
export function completeSet(session: ActiveSession, exerciseIndex: number, setIndex: number, values: SetValues, now: number, autoRest = true): ActiveSession {
  const set = session.exercises[exerciseIndex]?.sets[setIndex];
  if (!set) throw new Error('That set no longer exists.');
  validValues(values);
  const next = clone(session);
  const target = next.exercises[exerciseIndex].sets[setIndex];
  if (values.reps !== undefined) target.reps = values.reps;
  if (values.loadKg !== undefined) target.loadKg = values.loadKg;
  if (values.seconds !== undefined) target.seconds = values.seconds;
  if (target.done) return next;
  target.done = true;
  target.completedAt = now;
  next.hold = null;
  // A paused workout resumes when the user logs a set.
  if (next.pausedAt) { next.pausedMs += now - next.pausedAt; next.pausedAt = null; }
  const exercise = next.exercises[exerciseIndex];
  const open = nextOpenSet(next, exerciseIndex);
  if (open && autoRest && exercise.restSec > 0) {
    next.rest = { exerciseIndex: open.exerciseIndex, setIndex: open.setIndex, durationSec: exercise.restSec, endsAt: now + exercise.restSec * 1000, remainingMs: null };
  } else next.rest = null;
  // Move on automatically once every set of this exercise is done.
  if (exercise.sets.every(item => item.done) && open) next.index = open.exerciseIndex;
  return next;
}

export function undoSet(session: ActiveSession, exerciseIndex: number, setIndex: number): ActiveSession {
  const next = clone(session);
  const set = next.exercises[exerciseIndex]?.sets[setIndex];
  if (!set) return next;
  set.done = false;
  set.completedAt = null;
  next.rest = null;
  return next;
}

export function updateSet(session: ActiveSession, exerciseIndex: number, setIndex: number, values: SetValues): ActiveSession {
  validValues(values);
  const next = clone(session);
  const set = next.exercises[exerciseIndex]?.sets[setIndex];
  if (!set) return next;
  if (values.reps !== undefined) set.reps = values.reps;
  if (values.loadKg !== undefined) set.loadKg = values.loadKg;
  if (values.seconds !== undefined) set.seconds = values.seconds;
  return next;
}

export function addSet(session: ActiveSession, exerciseIndex: number): ActiveSession {
  const next = clone(session);
  const exercise = next.exercises[exerciseIndex];
  if (!exercise || exercise.sets.length >= 20) return next;
  const last = exercise.sets.at(-1);
  exercise.sets.push({ reps: last?.reps ?? exercise.targetReps, loadKg: last?.loadKg ?? null, seconds: last?.seconds ?? exercise.targetSeconds, done: false, completedAt: null });
  return next;
}

export function removeSet(session: ActiveSession, exerciseIndex: number): ActiveSession {
  const next = clone(session);
  const exercise = next.exercises[exerciseIndex];
  if (!exercise || exercise.sets.length <= 1) return next;
  const index = exercise.sets.map(set => set.done).lastIndexOf(false);
  if (index >= 0) exercise.sets.splice(index, 1);
  return next;
}

export function goTo(session: ActiveSession, index: number): ActiveSession {
  const next = clone(session);
  next.index = Math.max(0, Math.min(next.exercises.length - 1, index));
  next.hold = null;
  return next;
}

export function skipRest(session: ActiveSession): ActiveSession {
  const next = clone(session);
  next.rest = null;
  return next;
}

export function adjustRest(session: ActiveSession, deltaSec: number, now: number): ActiveSession {
  const next = clone(session);
  if (!next.rest) return next;
  if (next.rest.endsAt === null) next.rest.remainingMs = Math.max(0, (next.rest.remainingMs ?? 0) + deltaSec * 1000);
  else next.rest.endsAt = Math.max(now, next.rest.endsAt + deltaSec * 1000);
  next.rest.durationSec = Math.max(1, next.rest.durationSec + deltaSec);
  return next;
}

export function startHold(session: ActiveSession, exerciseIndex: number, setIndex: number, now: number): ActiveSession {
  const next = clone(session);
  const exercise = next.exercises[exerciseIndex];
  const set = exercise?.sets[setIndex];
  if (!set || set.done) return next;
  const seconds = set.seconds ?? exercise.targetSeconds ?? 30;
  next.rest = null;
  next.hold = { exerciseIndex, setIndex, durationSec: seconds, endsAt: now + seconds * 1000, remainingMs: null };
  if (next.pausedAt) { next.pausedMs += now - next.pausedAt; next.pausedAt = null; }
  return next;
}

export function cancelHold(session: ActiveSession): ActiveSession {
  const next = clone(session);
  next.hold = null;
  return next;
}

/** Pause freezes the workout clock and any running countdown. */
export function pause(session: ActiveSession, now: number): ActiveSession {
  if (session.pausedAt) return session;
  const next = clone(session);
  next.pausedAt = now;
  for (const countdown of [next.rest, next.hold]) if (countdown && countdown.endsAt !== null) {
    countdown.remainingMs = Math.max(0, countdown.endsAt - now);
    countdown.endsAt = null;
  }
  return next;
}

export function resume(session: ActiveSession, now: number): ActiveSession {
  if (!session.pausedAt) return session;
  const next = clone(session);
  next.pausedMs += Math.max(0, now - session.pausedAt);
  next.pausedAt = null;
  for (const countdown of [next.rest, next.hold]) if (countdown && countdown.endsAt === null) {
    countdown.endsAt = now + (countdown.remainingMs ?? 0);
    countdown.remainingMs = null;
  }
  return next;
}

/** Applies timers that finished while the app was away: an ended rest clears, an ended hold logs its set. */
export function settle(session: ActiveSession, now: number, autoRest = true): { session: ActiveSession; events: ('rest-done' | 'hold-done')[] } {
  let next = session;
  const events: ('rest-done' | 'hold-done')[] = [];
  if (next.hold && next.hold.endsAt !== null && next.hold.endsAt <= now) {
    const { exerciseIndex, setIndex, durationSec } = next.hold;
    next = completeSet(next, exerciseIndex, setIndex, { seconds: durationSec }, next.hold.endsAt, autoRest);
    events.push('hold-done');
  }
  if (next.rest && next.rest.endsAt !== null && next.rest.endsAt <= now) {
    next = { ...clone(next), rest: null };
    events.push('rest-done');
  }
  return { session: next, events };
}

export function finish(session: ActiveSession, now: number): CompletedWorkout {
  const exercises = session.exercises
    .map(exercise => ({ exerciseId: exercise.exerciseId, name: exercise.name, kind: exercise.kind, loaded: exercise.loaded,
      sets: exercise.sets.filter(set => set.done).map(set => ({ reps: set.reps, loadKg: exercise.loaded ? set.loadKg : null, seconds: set.seconds })) }))
    .filter(exercise => exercise.sets.length);
  const sets = exercises.flatMap(exercise => exercise.sets);
  return {
    version: 1, id: session.id, title: session.title, planId: session.planId, dayId: session.dayId,
    startedAt: session.startedAt, finishedAt: now, activeSec: Math.round(elapsedMs(session, now) / 1000), exercises,
    totalSets: sets.length, totalReps: sets.reduce((sum, set) => sum + (set.reps ?? 0), 0),
    volumeKg: Math.round(sets.reduce((sum, set) => sum + (set.reps ?? 0) * (set.loadKg ?? 0), 0) * 10) / 10,
    partial: !isComplete(session),
  };
}

export function progress(session: ActiveSession) {
  const sets = session.exercises.flatMap(exercise => exercise.sets);
  const done = sets.filter(set => set.done).length;
  return { done, total: sets.length, ratio: sets.length ? done / sets.length : 0 };
}

/** Carry last-used loads and reps forward so the user starts from their previous numbers. */
export function seedFromHistory(session: ActiveSession, lastSets: (exerciseId: string) => { reps: number | null; loadKg: number | null }[] | undefined): ActiveSession {
  const next = clone(session);
  for (const exercise of next.exercises) {
    const previous = lastSets(exercise.exerciseId);
    if (!previous?.length) continue;
    exercise.sets.forEach((set, index) => {
      const source = previous[Math.min(index, previous.length - 1)];
      if (exercise.loaded && source.loadKg !== null) set.loadKg = source.loadKg;
    });
  }
  return next;
}
