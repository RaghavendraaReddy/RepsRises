import test from 'node:test';
import assert from 'node:assert/strict';
import { EXERCISES, exerciseById, findExercise, substitutes, available } from '../dist/shared/fitness/exercises.js';
import { describeTarget, estimateMinutes, fitToTime, generatePlan, generateSession, recommendedSplit, SPLITS } from '../dist/shared/fitness/programs.js';
import * as S from '../dist/shared/fitness/session.js';
import { dayKey, estimatedMax, fromDisplay, monthGrid, personalBests, recordsIn, thisWeek, toDisplay, weeklyStreak, weeklySummary, weekStart } from '../dist/shared/fitness/stats.js';
import { isPlan, isSession, isWorkout, MemoryStore, Repository } from '../dist/shared/fitness/storage.js';
import { checkReply, isCoachRequest, replySchema } from '../dist/shared/coach/contracts.js';
import { offlineCoach } from '../dist/shared/coach/offline.js';
import { wireSchema, valid } from '../dist/shared/schema.js';

const GYM = ['bodyweight', 'dumbbells', 'barbell', 'kettlebell', 'bench', 'pullup-bar', 'bands', 'cable', 'machines'];
const HOME = ['bodyweight', 'dumbbells', 'bench', 'bands'];
const BODY = ['bodyweight'];
const T0 = new Date(2026, 9, 14, 18, 0, 0).getTime(); // Wednesday 14 Oct 2026, 18:00 local

test('exercise catalog is complete and consistent', () => {
  const ids = new Set();
  for (const exercise of EXERCISES) {
    assert(!ids.has(exercise.id), `duplicate ${exercise.id}`); ids.add(exercise.id);
    assert(exercise.cues.length >= 3 && exercise.mistakes.length >= 2, exercise.id);
    assert(exercise.primary.length >= 1 && exercise.summary.length > 10, exercise.id);
  }
  assert(EXERCISES.length >= 50);
  assert.equal(findExercise('romanian deadlift')?.id, 'romanian-deadlift');
  assert.equal(findExercise('Goblet Squats')?.id, 'goblet-squat');
  assert(substitutes('barbell-row', HOME).every(item => available(item, HOME)));
  assert(substitutes('barbell-row', HOME).length >= 1);
});

test('every split builds valid plans for every level and equipment set, within the time limit', () => {
  for (const split of SPLITS.map(item => item.id)) for (const level of ['beginner', 'intermediate', 'advanced']) for (const equipment of [GYM, HOME, BODY]) {
    const plan = generatePlan({ split, level, goal: 'muscle', equipment, minutes: 45, now: T0 });
    assert(isPlan(plan), `${split}/${level}`);
    assert.equal(plan.days.length, SPLITS.find(item => item.id === split).days);
    for (const day of plan.days) {
      assert(day.exercises.length >= 1, `${split}/${level}/${equipment.length}/${day.name} empty`);
      assert(day.exercises.every(item => available(exerciseById(item.exerciseId), equipment)), 'equipment respected');
      assert.equal(new Set(day.exercises.map(item => item.exerciseId)).size, day.exercises.length, 'no duplicates in a day');
    }
  }
  const beginner = generatePlan({ split: 'upper-lower-4', level: 'beginner', goal: 'strength', equipment: GYM, minutes: 60 });
  assert(!beginner.days.flatMap(day => day.exercises).some(item => exerciseById(item.exerciseId).level === 'advanced'), 'level respected');
  assert.equal(recommendedSplit(3, 'beginner'), 'full-body-3');
  assert.equal(recommendedSplit(4, 'advanced'), 'upper-lower-4');
  assert.equal(recommendedSplit(7, 'advanced'), 'full-week-7');
});

test('fitting to time trims accessories first and keeps main lifts', () => {
  const day = generatePlan({ split: 'full-body-3', level: 'advanced', goal: 'strength', equipment: GYM, minutes: 120 }).days[0].exercises;
  const short = fitToTime(day, 25);
  assert(short.length < day.length || estimateMinutes(short) <= 25);
  assert.equal(short[0].exerciseId, day[0].exerciseId);
  assert.equal(describeTarget({ sets: 3, reps: 8, repsMax: 12, seconds: null }), '3 × 8–12');
  assert.equal(describeTarget({ sets: 2, reps: null, repsMax: null, seconds: 30 }), '2 × 30s');
});

const input = () => ({ title: 'Test', source: 'quick', exercises: [
  { uid: 'a', exerciseId: 'goblet-squat', sets: 2, reps: 10, repsMax: 12, seconds: null, restSec: 60, note: '' },
  { uid: 'b', exerciseId: 'plank', sets: 1, reps: null, repsMax: null, seconds: 30, restSec: 30, note: '' },
] });

test('workout engine: logging sets starts rest; pause freezes the clock and timers; resume continues', () => {
  let s = S.startSession(input(), T0);
  assert(isSession(s));
  s = S.updateSet(s, 0, 0, { loadKg: 20, reps: 11 });
  s = S.completeSet(s, 0, 0, {}, T0 + 30_000);
  assert.equal(s.exercises[0].sets[0].done, true);
  assert.equal(s.rest.endsAt, T0 + 90_000);
  s = S.pause(s, T0 + 40_000);
  assert.equal(S.remainingMs(s.rest, T0 + 999_999), 50_000, 'paused rest does not count down');
  assert.equal(S.elapsedMs(s, T0 + 100_000), 40_000, 'paused clock does not move');
  s = S.resume(s, T0 + 100_000);
  assert.equal(S.elapsedMs(s, T0 + 110_000), 50_000);
  assert.equal(s.rest.endsAt, T0 + 150_000);
  s = S.adjustRest(s, 15, T0 + 100_000);
  assert.equal(s.rest.endsAt, T0 + 165_000);
  s = S.skipRest(s);
  assert.equal(s.rest, null);
});

test('workout engine: timers that ended while away settle on return; finishing is idempotent data', () => {
  let s = S.startSession(input(), T0);
  s = S.completeSet(s, 0, 0, { reps: 10, loadKg: 20 }, T0);
  s = S.completeSet(s, 0, 1, { reps: 9, loadKg: 20 }, T0 + 120_000);
  assert.equal(s.index, 1, 'moves to the next exercise once all sets are done');
  // Simulate the tab sleeping through the rest timer.
  let settled = S.settle(s, T0 + 10 * 60_000);
  assert.deepEqual(settled.events, ['rest-done']);
  s = S.startHold(settled.session, 1, 0, T0 + 11 * 60_000);
  settled = S.settle(s, T0 + 12 * 60_000);
  assert(settled.events.includes('hold-done'));
  s = settled.session;
  assert(S.isComplete(s));
  const done = S.finish(s, T0 + 13 * 60_000);
  assert(isWorkout(done));
  assert.equal(done.totalSets, 3);
  assert.equal(done.volumeKg, 380);
  assert.equal(done.partial, false);
  assert.equal(done.exercises[1].sets[0].seconds, 30);
});

test('workout engine: undo, add and remove sets; partial finish keeps only logged sets', () => {
  let s = S.startSession(input(), T0);
  s = S.completeSet(s, 0, 0, { reps: 10 }, T0);
  s = S.undoSet(s, 0, 0);
  assert.equal(s.exercises[0].sets[0].done, false);
  s = S.addSet(s, 0);
  assert.equal(s.exercises[0].sets.length, 3);
  s = S.removeSet(s, 0);
  assert.equal(s.exercises[0].sets.length, 2);
  assert.throws(() => S.completeSet(s, 0, 0, { reps: -1 }, T0), /Check the reps/);
  s = S.completeSet(s, 0, 0, { reps: 8 }, T0);
  const partial = S.finish(s, T0 + 60_000);
  assert.equal(partial.partial, true);
  assert.equal(partial.totalSets, 1);
  assert.equal(partial.exercises.length, 1);
});

const workout = (id, finishedAt, sets, exerciseId = 'goblet-squat') => ({ version: 1, id, title: 'W', planId: null, dayId: null, startedAt: finishedAt - 3_000_000, finishedAt, activeSec: 3000,
  exercises: [{ exerciseId, name: exerciseById(exerciseId).name, kind: 'reps', loaded: exerciseById(exerciseId).loaded, sets }], totalSets: sets.length, totalReps: sets.reduce((a, b) => a + b.reps, 0),
  volumeKg: sets.reduce((a, b) => a + b.reps * (b.loadKg ?? 0), 0), partial: false });

test('stats: weekly streak survives rest days, breaks after an empty week, and uses local dates', () => {
  const week = 7 * 86400000;
  const history = [workout('a', T0, [{ reps: 10, loadKg: 20, seconds: null }]), workout('b', T0 - week, [{ reps: 10, loadKg: 20, seconds: null }]), workout('c', T0 - 3 * week, [{ reps: 10, loadKg: 20, seconds: null }])];
  assert.equal(weeklyStreak(history, T0), 2);
  assert.equal(weeklyStreak(history, T0 + week), 2, 'a new week without training yet keeps the streak');
  assert.equal(weeklyStreak(history, T0 + 2 * week), 0);
  const late = new Date(2026, 9, 18, 23, 30).getTime(); // Sunday 23:30 belongs to the same week
  assert.equal(weekStart(late), weekStart(T0));
  assert.equal(dayKey(late), '2026-10-18');
  assert.equal(thisWeek([...history, workout('d', late, [])], T0).length, 2);
  assert.equal(weeklySummary(history, T0, 4).at(-1).workouts, 1);
  const grid = monthGrid(history, T0, T0);
  assert.equal(grid.length % 7, 0);
  assert.equal(grid.find(cell => cell?.day === 14).count, 1);
  assert.equal(grid.find(cell => cell?.day === 20).future, true);
});

test('stats: personal bests and new records; a first attempt is not a record', () => {
  const first = workout('a', T0 - 86400000, [{ reps: 8, loadKg: 20, seconds: null }]);
  const second = workout('b', T0, [{ reps: 8, loadKg: 22.5, seconds: null }, { reps: 5, loadKg: 20, seconds: null }]);
  assert.deepEqual(recordsIn(first, [first]), []);
  const records = recordsIn(second, [first, second]);
  assert.equal(records.length, 1);
  assert.equal(records[0].loadKg, 22.5);
  assert.equal(personalBests([first, second])[0].loadKg, 22.5);
  assert.equal(Math.round(estimatedMax(100, 5)), 117);
  assert.equal(toDisplay(fromDisplay(45, 'lb'), 'lb'), 45);
  assert.equal(toDisplay(20, 'lb'), 44);
});

test('storage validates on read and write, de-duplicates workouts, and round-trips an export', () => {
  const kv = new MemoryStore();
  const repo = new Repository(kv);
  const plan = generatePlan({ split: 'ppl-3', level: 'beginner', goal: 'general', equipment: HOME, minutes: 30 });
  repo.savePlans([plan]);
  const w = workout('w1', T0, [{ reps: 10, loadKg: 20, seconds: null }]);
  assert.equal(repo.addWorkout(w).added, true);
  assert.equal(repo.addWorkout(w).added, false, 'double submit is ignored');
  assert.equal(repo.history().length, 1);
  assert.throws(() => repo.savePlans([{ ...plan, days: [{ ...plan.days[0], exercises: [{ ...plan.days[0].exercises[0], sets: 99 }] }] }]), /invalid/);
  kv.write('icarus.v1.history', '{broken');
  assert.deepEqual(repo.history(), []);
  assert(repo.report.dropped.includes('history'));
  kv.write('icarus.v1.prefs', JSON.stringify({ version: 1, provider: 'offline', sound: false, vibration: true, motion: 'system', autoRest: true }));
  assert.equal(repo.preferences().sound, false, 'older preferences gain new defaults');
  assert.equal(repo.preferences().theme, 'system');
  repo.addWorkout(w);
  const data = repo.exportAll();
  const fresh = new Repository(new MemoryStore());
  assert.deepEqual(fresh.importAll(JSON.parse(JSON.stringify(data))), { plans: 1, workouts: 1 });
  assert.throws(() => fresh.importAll({ format: 'other' }), /not an Icarus export/);
  assert.throws(() => fresh.importAll({ ...data, history: [{ id: 'bad' }] }), /invalid/);
  assert.equal(fresh.history().length, 1, 'a rejected import changes nothing');
});

const context = { name: 'Sam', goal: 'muscle', level: 'intermediate', equipment: HOME, minutes: 40, units: 'kg', plan: '', recent: '', session: '' };
const ask = text => offlineCoach([{ role: 'user', content: text }], context);

test('offline coach builds real sessions that respect equipment and time', () => {
  const legs = ask('A 30 minute leg session');
  assert(legs.workout && legs.workout.exercises.length >= 2);
  assert(legs.workout.minutes <= 32);
  assert(legs.workout.exercises.every(item => available(exerciseById(item.exerciseId), HOME)));
  const body = ask('full body workout, no equipment');
  assert(body.workout.exercises.every(item => exerciseById(item.exerciseId).equipment.length === 0));
  const harder = offlineCoach([{ role: 'user', content: 'chest workout' }, { role: 'assistant', content: 'ok' }, { role: 'user', content: 'Make it harder' }], context);
  assert(harder.workout && harder.reply.includes('advanced'));
  assert(checkReply(legs));
});

test('offline coach explains technique, swaps, splits and training concepts', () => {
  const how = ask('How do I do a Romanian deadlift?');
  assert(how.reply.includes('Common mistakes') && !how.workout);
  const swap = ask('Replace barbell row');
  assert(/One-arm Dumbbell Row|Band Row/.test(swap.reply));
  assert.equal(ask('Recommend a 4 day split').split, 'upper-lower-4');
  assert(/rep/i.test(ask('What are sets and reps?').reply));
  assert(/2–3 minutes/.test(ask('How long should I rest between sets?').reply));
});

test('offline coach stops at warning symptoms and does not program through them', () => {
  for (const text of ['my knee hurts when I squat', 'I feel dizzy', 'chest pain during cardio']) {
    const result = ask(text);
    assert.equal(result.workout, null);
    assert(/stop/i.test(result.reply) && /medical|doctor|physiotherapist/i.test(result.reply), text);
  }
});

test('coach contracts: replies are validated and normalised; provider schema has no length limits', () => {
  const base = { reply: 'ok', split: null, suggestions: [], workout: { title: 'X', focus: '', minutes: 20, exercises: [{ name: 'Goblet squats', exerciseId: 'not-real', sets: 3, reps: 10, repsMax: 8, seconds: null, restSec: 60, cue: '' }] } };
  const checked = checkReply(base);
  assert.equal(checked.workout.exercises[0].exerciseId, 'goblet-squat');
  assert.equal(checked.workout.exercises[0].repsMax, 10);
  assert.throws(() => checkReply({ ...base, workout: { ...base.workout, exercises: [{ ...base.workout.exercises[0], reps: null }] } }), /no reps or duration/);
  assert.throws(() => checkReply({ ...base, workout: { ...base.workout, exercises: [{ ...base.workout.exercises[0], sets: 50 }] } }));
  assert.throws(() => checkReply({ ...base, extra: true }));
  const wire = JSON.stringify(wireSchema(replySchema));
  assert(!/maxLength|minLength|maximum|minimum|maxItems/.test(wire) && wire.includes('additionalProperties'));
  assert(valid(replySchema, base));
  assert(isCoachRequest({ provider: 'offline', messages: [{ role: 'user', content: 'hi' }], context }));
  assert(!isCoachRequest({ provider: 'offline', messages: [{ role: 'assistant', content: 'hi' }], context }), 'last message must be the user');
  assert(!isCoachRequest({ provider: 'offline', messages: [{ role: 'user', content: 'x'.repeat(5000) }], context }));
  assert(!isCoachRequest({ provider: 'shell', messages: [{ role: 'user', content: 'hi' }], context }));
});

test('quick sessions cover mobility and cardio without equipment', () => {
  for (const muscles of [['mobility'], ['cardio'], ['core']]) {
    const items = generateSession({ muscles, level: 'beginner', goal: 'general', equipment: BODY, minutes: 20 });
    assert(items.length >= 2, muscles[0]);
  }
});
