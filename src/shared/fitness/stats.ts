import type { CompletedWorkout, Units } from './types.js';

// All date math uses the device's local calendar, so a workout at 23:30 counts for that day.

export function dayKey(ms: number): string {
  const date = new Date(ms);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/** Local midnight of the Monday that starts the week containing `ms`. */
export function weekStart(ms: number): number {
  const date = new Date(ms);
  date.setHours(0, 0, 0, 0);
  const offset = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - offset);
  return date.getTime();
}

export function addDays(ms: number, days: number): number {
  const date = new Date(ms);
  date.setDate(date.getDate() + days);
  return date.getTime();
}

/** 0 = Monday ... 6 = Sunday. */
export function weekday(ms: number): number {
  return (new Date(ms).getDay() + 6) % 7;
}

/**
 * Consecutive weeks with at least one workout. The current week keeps the streak alive even before
 * the first session, so a rest day never breaks it; a full week without training does.
 */
export function weeklyStreak(history: CompletedWorkout[], now: number): number {
  const weeks = new Set(history.map(workout => weekStart(workout.finishedAt)));
  let cursor = weekStart(now);
  if (!weeks.has(cursor)) cursor = addDays(cursor, -7);
  let streak = 0;
  while (weeks.has(cursor)) { streak++; cursor = addDays(cursor, -7); }
  return streak;
}

export function thisWeek(history: CompletedWorkout[], now: number) {
  const start = weekStart(now);
  const end = addDays(start, 7);
  return history.filter(workout => workout.finishedAt >= start && workout.finishedAt < end);
}

export type WeekSummary = { start: number; workouts: number; volumeKg: number; minutes: number };

export function weeklySummary(history: CompletedWorkout[], now: number, count = 12): WeekSummary[] {
  const current = weekStart(now);
  return Array.from({ length: count }, (_, index) => {
    const start = addDays(current, -7 * (count - 1 - index));
    const end = addDays(start, 7);
    const items = history.filter(workout => workout.finishedAt >= start && workout.finishedAt < end);
    return { start, workouts: items.length, volumeKg: items.reduce((sum, item) => sum + item.volumeKg, 0), minutes: Math.round(items.reduce((sum, item) => sum + item.activeSec, 0) / 60) };
  });
}

/** Calendar cells for the month containing `ms`, Monday-first, with leading/trailing nulls. */
export function monthGrid(history: CompletedWorkout[], ms: number, now = Date.now()): ({ key: string; day: number; count: number; future: boolean } | null)[] {
  const first = new Date(ms);
  first.setDate(1);
  first.setHours(0, 0, 0, 0);
  const days = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const counts = new Map<string, number>();
  for (const workout of history) counts.set(dayKey(workout.finishedAt), (counts.get(dayKey(workout.finishedAt)) ?? 0) + 1);
  const today = dayKey(now);
  const cells: ({ key: string; day: number; count: number; future: boolean } | null)[] = Array.from({ length: weekday(first.getTime()) }, () => null);
  for (let day = 1; day <= days; day++) {
    const key = dayKey(new Date(first.getFullYear(), first.getMonth(), day).getTime());
    cells.push({ key, day, count: counts.get(key) ?? 0, future: key > today });
  }
  while (cells.length % 7) cells.push(null);
  return cells;
}

export function monthSummary(history: CompletedWorkout[], ms: number) {
  const date = new Date(ms);
  const items = history.filter(workout => {
    const finished = new Date(workout.finishedAt);
    return finished.getFullYear() === date.getFullYear() && finished.getMonth() === date.getMonth();
  });
  return {
    workouts: items.length,
    activeDays: new Set(items.map(item => dayKey(item.finishedAt))).size,
    volumeKg: items.reduce((sum, item) => sum + item.volumeKg, 0),
    minutes: Math.round(items.reduce((sum, item) => sum + item.activeSec, 0) / 60),
    sets: items.reduce((sum, item) => sum + item.totalSets, 0),
  };
}

/** Epley estimate. Only meaningful for loaded sets of 1–12 reps. */
export function estimatedMax(loadKg: number, reps: number): number {
  if (reps <= 0 || loadKg <= 0) return 0;
  return reps === 1 ? loadKg : loadKg * (1 + reps / 30);
}

export type Best = { exerciseId: string; name: string; kind: 'load' | 'reps' | 'time'; value: number; loadKg: number | null; reps: number | null; seconds: number | null; at: number; workoutId: string };

function bestOf(workout: CompletedWorkout): Best[] {
  const results: Best[] = [];
  for (const exercise of workout.exercises) {
    let best: Best | null = null;
    for (const set of exercise.sets) {
      let candidate: Best | null = null;
      if (exercise.loaded && set.loadKg && set.reps && set.reps <= 12) {
        candidate = { exerciseId: exercise.exerciseId, name: exercise.name, kind: 'load', value: estimatedMax(set.loadKg, set.reps), loadKg: set.loadKg, reps: set.reps, seconds: null, at: workout.finishedAt, workoutId: workout.id };
      } else if (exercise.kind === 'time' && set.seconds) {
        candidate = { exerciseId: exercise.exerciseId, name: exercise.name, kind: 'time', value: set.seconds, loadKg: set.loadKg, reps: null, seconds: set.seconds, at: workout.finishedAt, workoutId: workout.id };
      } else if (!exercise.loaded && set.reps) {
        candidate = { exerciseId: exercise.exerciseId, name: exercise.name, kind: 'reps', value: set.reps, loadKg: null, reps: set.reps, seconds: null, at: workout.finishedAt, workoutId: workout.id };
      }
      if (candidate && (!best || candidate.value > best.value)) best = candidate;
    }
    if (best) results.push(best);
  }
  return results;
}

/** Best result per exercise across the whole history. */
export function personalBests(history: CompletedWorkout[]): Best[] {
  const map = new Map<string, Best>();
  for (const workout of [...history].sort((a, b) => a.finishedAt - b.finishedAt)) {
    for (const best of bestOf(workout)) {
      const key = `${best.exerciseId}:${best.kind}`;
      const current = map.get(key);
      if (!current || best.value > current.value + 1e-9) map.set(key, best);
    }
  }
  return [...map.values()].sort((a, b) => b.at - a.at);
}

/** Records a workout set compared with everything logged before it. A first-ever result is not a record. */
export function recordsIn(workout: CompletedWorkout, history: CompletedWorkout[]): Best[] {
  const before = personalBests(history.filter(item => item.id !== workout.id && item.finishedAt < workout.finishedAt));
  return bestOf(workout).filter(best => {
    const previous = before.find(item => item.exerciseId === best.exerciseId && item.kind === best.kind);
    return previous !== undefined && best.value > previous.value + 1e-9;
  });
}

/** Sets from the most recent workout that included this exercise. */
export function lastPerformance(history: CompletedWorkout[], exerciseId: string) {
  const workout = [...history].sort((a, b) => b.finishedAt - a.finishedAt).find(item => item.exercises.some(exercise => exercise.exerciseId === exerciseId));
  const exercise = workout?.exercises.find(item => item.exerciseId === exerciseId);
  return workout && exercise ? { at: workout.finishedAt, sets: exercise.sets } : undefined;
}

export function totals(history: CompletedWorkout[]) {
  return {
    workouts: history.length,
    minutes: Math.round(history.reduce((sum, item) => sum + item.activeSec, 0) / 60),
    volumeKg: history.reduce((sum, item) => sum + item.volumeKg, 0),
    sets: history.reduce((sum, item) => sum + item.totalSets, 0),
  };
}

// Units: loads are stored in kilograms.
export const KG_PER_LB = 0.45359237;
export function toDisplay(kg: number, units: Units): number {
  const value = units === 'kg' ? kg : kg / KG_PER_LB;
  return Math.round(value * 2) / 2;
}
export function fromDisplay(value: number, units: Units): number {
  return units === 'kg' ? value : Math.round(value * KG_PER_LB * 1000) / 1000;
}
export function formatLoad(kg: number | null, units: Units): string {
  return kg === null ? '—' : `${toDisplay(kg, units)} ${units}`;
}
export function formatVolume(kg: number, units: Units): string {
  const value = units === 'kg' ? kg : kg / KG_PER_LB;
  return value >= 10000 ? `${(value / 1000).toFixed(1)}k ${units}` : `${Math.round(value).toLocaleString('en-US')} ${units}`;
}
export function formatDuration(totalSec: number): string {
  const sec = Math.max(0, Math.round(totalSec));
  const hours = Math.floor(sec / 3600);
  const minutes = Math.floor((sec % 3600) / 60);
  const seconds = sec % 60;
  return hours ? `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}` : `${minutes}:${String(seconds).padStart(2, '0')}`;
}
export function formatClock(ms: number): string {
  return formatDuration(Math.ceil(ms / 1000));
}
