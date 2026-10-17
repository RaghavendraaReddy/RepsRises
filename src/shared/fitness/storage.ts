import { readLocal, type LocalState } from '../marketplace/local.js';
import { EQUIPMENT, GOALS, LEVELS, type ActiveSession, type CompletedWorkout, type Equipment, type Plan, type Preferences, type Profile } from './types.js';

// Persistence sits behind two small interfaces so a server-backed store can replace browser storage
// later without touching screens. Everything read back is validated: storage can be edited, truncated
// or written by an older version, and bad records must never crash the app.

export interface KeyValueStore {
  read(key: string): string | null;
  write(key: string, value: string): void;
  remove(key: string): void;
}

export class MemoryStore implements KeyValueStore {
  private data = new Map<string, string>();
  read(key: string) { return this.data.get(key) ?? null; }
  write(key: string, value: string) { this.data.set(key, value); }
  remove(key: string) { this.data.delete(key); }
}

export class StorageError extends Error {}

const PREFIX = 'icarus.v1.';
export const KEYS = { profile: 'profile', plans: 'plans', activePlan: 'active-plan', history: 'history', session: 'session', prefs: 'prefs', coach: 'coach', local: 'marketplace' } as const;

const isObject = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const isString = (value: unknown, max = 200): value is string => typeof value === 'string' && value.length <= max;
const isInt = (value: unknown, min: number, max: number): value is number => typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;
const isNum = (value: unknown, min: number, max: number): value is number => typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
const isNullable = <T>(check: (value: unknown) => value is T) => (value: unknown): value is T | null => value === null || check(value);
const nInt = (min: number, max: number) => isNullable((value: unknown): value is number => isInt(value, min, max));
const nNum = (min: number, max: number) => isNullable((value: unknown): value is number => isNum(value, min, max));
const TIME = (value: unknown): value is number => isNum(value, 0, 8.64e15);

export function isProfile(value: unknown): value is Profile {
  return isObject(value) && value.version === 1 && isString(value.name, 60) && GOALS.includes(value.goal as never) && LEVELS.includes(value.level as never) &&
    Array.isArray(value.equipment) && value.equipment.every(item => EQUIPMENT.includes(item as Equipment)) &&
    isInt(value.daysPerWeek, 1, 7) && Array.isArray(value.trainingDays) && value.trainingDays.every(day => isInt(day, 0, 6)) &&
    isInt(value.minutes, 10, 180) && (value.units === 'kg' || value.units === 'lb') && TIME(value.createdAt);
}

function isPlanExercise(value: unknown) {
  return isObject(value) && isString(value.uid, 80) && isString(value.exerciseId, 80) && isInt(value.sets, 1, 20) && nInt(1, 1000)(value.reps) &&
    nInt(1, 1000)(value.repsMax) && nInt(1, 3600)(value.seconds) && isInt(value.restSec, 0, 900) && isString(value.note, 500);
}

export function isPlan(value: unknown): value is Plan {
  return isObject(value) && value.version === 1 && isString(value.id, 80) && isString(value.name, 80) && isString(value.split, 40) &&
    LEVELS.includes(value.level as never) && GOALS.includes(value.goal as never) && TIME(value.createdAt) && TIME(value.updatedAt) &&
    Array.isArray(value.days) && value.days.length <= 7 && value.days.every(day => isObject(day) && isString(day.id, 80) && isString(day.name, 60) &&
      isString(day.focus, 120) && Array.isArray(day.exercises) && day.exercises.length <= 30 && day.exercises.every(isPlanExercise));
}

function isSetLog(value: unknown) {
  return isObject(value) && nInt(0, 1000)(value.reps) && nNum(0, 1000)(value.loadKg) && nInt(0, 3600)(value.seconds) && typeof value.done === 'boolean' && isNullable(TIME)(value.completedAt);
}
function isCountdown(value: unknown) {
  return value === null || (isObject(value) && isInt(value.exerciseIndex, 0, 100) && isInt(value.setIndex, 0, 100) && isInt(value.durationSec, 0, 3600) && isNullable(TIME)(value.endsAt) && nNum(0, 3.6e6)(value.remainingMs));
}

export function isSession(value: unknown): value is ActiveSession {
  return isObject(value) && value.version === 1 && isString(value.id, 80) && isString(value.title, 120) && ['plan', 'coach', 'quick'].includes(value.source as string) &&
    isNullable((item: unknown): item is string => isString(item, 80))(value.planId) && isNullable((item: unknown): item is string => isString(item, 80))(value.dayId) &&
    TIME(value.startedAt) && isNullable(TIME)(value.pausedAt) && isNum(value.pausedMs, 0, 8.64e9) && isInt(value.index, 0, 100) && isCountdown(value.rest) && isCountdown(value.hold) &&
    Array.isArray(value.exercises) && value.exercises.length > 0 && value.exercises.length <= 40 && value.index < value.exercises.length &&
    value.exercises.every(item => isObject(item) && isString(item.uid, 80) && isString(item.exerciseId, 80) && isString(item.name, 80) && (item.kind === 'reps' || item.kind === 'time') &&
      typeof item.loaded === 'boolean' && nInt(1, 1000)(item.targetReps) && nInt(1, 1000)(item.targetRepsMax) && nInt(1, 3600)(item.targetSeconds) && isInt(item.restSec, 0, 900) &&
      isString(item.note, 500) && Array.isArray(item.sets) && item.sets.length > 0 && item.sets.length <= 20 && item.sets.every(isSetLog));
}

export function isWorkout(value: unknown): value is CompletedWorkout {
  return isObject(value) && value.version === 1 && isString(value.id, 80) && isString(value.title, 120) && TIME(value.startedAt) && TIME(value.finishedAt) &&
    isInt(value.activeSec, 0, 86400) && isInt(value.totalSets, 0, 1000) && isInt(value.totalReps, 0, 100000) && isNum(value.volumeKg, 0, 1e7) && typeof value.partial === 'boolean' &&
    Array.isArray(value.exercises) && value.exercises.every(item => isObject(item) && isString(item.exerciseId, 80) && isString(item.name, 80) && Array.isArray(item.sets) &&
      item.sets.every(set => isObject(set) && nInt(0, 1000)(set.reps) && nNum(0, 1000)(set.loadKg) && nInt(0, 3600)(set.seconds)));
}

export function isPreferences(value: unknown): value is Preferences {
  return isObject(value) && value.version === 1 && (value.provider === null || isString(value.provider, 40)) && typeof value.sound === 'boolean' &&
    typeof value.vibration === 'boolean' && (value.motion === 'system' || value.motion === 'reduced') && ['system', 'light', 'dark'].includes(value.theme as string) && typeof value.autoRest === 'boolean';
}

export const DEFAULT_PREFERENCES: Preferences = { version: 1, provider: null, sound: true, vibration: true, motion: 'system', theme: 'system', autoRest: true };

export type LoadReport = { dropped: string[] };

/**
 * The single place that reads and writes training data. Invalid records are skipped and reported
 * (never silently "fixed"), and every write is validated first so bugs cannot persist bad state.
 */
export class Repository {
  readonly report: LoadReport = { dropped: [] };
  constructor(private store: KeyValueStore) {}

  private get(key: string): unknown {
    const raw = this.store.read(PREFIX + key);
    if (raw === null) return undefined;
    try { return JSON.parse(raw); } catch { this.report.dropped.push(key); return undefined; }
  }
  private put(key: string, value: unknown) {
    try { this.store.write(PREFIX + key, JSON.stringify(value)); }
    catch { throw new StorageError('Your browser refused to save. Storage may be full or blocked in this window.'); }
  }

  profile(): Profile | null {
    const value = this.get(KEYS.profile);
    if (value === undefined) return null;
    if (isProfile(value)) return value;
    this.report.dropped.push('profile');
    return null;
  }
  saveProfile(profile: Profile) {
    if (!isProfile(profile)) throw new StorageError('Profile is incomplete.');
    this.put(KEYS.profile, profile);
  }

  plans(): Plan[] {
    const value = this.get(KEYS.plans);
    if (!Array.isArray(value)) return [];
    const plans = value.filter(isPlan);
    if (plans.length !== value.length) this.report.dropped.push(`${value.length - plans.length} plan(s)`);
    return plans;
  }
  savePlans(plans: Plan[]) {
    if (!plans.every(isPlan)) throw new StorageError('A plan has invalid values. Check sets, reps and rest.');
    this.put(KEYS.plans, plans);
  }
  activePlanId(): string | null {
    const value = this.get(KEYS.activePlan);
    return typeof value === 'string' ? value : null;
  }
  saveActivePlanId(id: string | null) {
    if (id === null) this.store.remove(PREFIX + KEYS.activePlan); else this.put(KEYS.activePlan, id);
  }

  history(): CompletedWorkout[] {
    const value = this.get(KEYS.history);
    if (!Array.isArray(value)) return [];
    const items = value.filter(isWorkout);
    if (items.length !== value.length) this.report.dropped.push(`${value.length - items.length} workout(s)`);
    // De-duplicate by id: a double submit or two tabs finishing together must not count twice.
    const unique = new Map(items.map(item => [item.id, item]));
    return [...unique.values()].sort((a, b) => b.finishedAt - a.finishedAt);
  }
  addWorkout(workout: CompletedWorkout): { added: boolean; history: CompletedWorkout[] } {
    if (!isWorkout(workout)) throw new StorageError('This workout could not be saved: some values are invalid.');
    const history = this.history();
    if (history.some(item => item.id === workout.id)) return { added: false, history };
    const next = [workout, ...history].sort((a, b) => b.finishedAt - a.finishedAt);
    this.put(KEYS.history, next);
    return { added: true, history: next };
  }
  deleteWorkout(id: string) {
    this.put(KEYS.history, this.history().filter(item => item.id !== id));
  }

  session(): ActiveSession | null {
    const value = this.get(KEYS.session);
    if (value === undefined) return null;
    if (isSession(value)) return value;
    this.report.dropped.push('active workout');
    return null;
  }
  saveSession(session: ActiveSession | null) {
    if (session === null) { this.store.remove(PREFIX + KEYS.session); return; }
    if (!isSession(session)) throw new StorageError('The workout state is invalid and was not saved.');
    this.put(KEYS.session, session);
  }

  preferences(): Preferences {
    const value = this.get(KEYS.prefs);
    // Older saves lack newer fields: fill defaults, then validate the merged result.
    const merged = value && typeof value === 'object' ? { ...DEFAULT_PREFERENCES, ...value } : value;
    return isPreferences(merged) ? merged : { ...DEFAULT_PREFERENCES };
  }
  savePreferences(prefs: Preferences) {
    if (!isPreferences(prefs)) throw new StorageError('Preferences are invalid.');
    this.put(KEYS.prefs, prefs);
  }

  /** The coach conversation, kept so a reload does not lose it. Plain text only. */
  coach(): { role: 'user' | 'assistant'; content: string; workout?: unknown; split?: unknown; suggestions?: unknown }[] {
    const value = this.get(KEYS.coach);
    if (!Array.isArray(value)) return [];
    return value.filter(item => isObject(item) && (item.role === 'user' || item.role === 'assistant') && isString(item.content, 12000)).slice(-40) as never;
  }
  saveCoach(messages: unknown[]) {
    if (!messages.length) { this.store.remove(PREFIX + KEYS.coach); return; }
    this.put(KEYS.coach, messages.slice(-40));
  }

  /** Audience, location, saved items, comparison, submitted requests and meal notes. */
  local(): LocalState { return readLocal(this.get(KEYS.local)); }
  saveLocal(state: LocalState) {
    const checked = readLocal(state);
    if (JSON.stringify(checked) !== JSON.stringify(state)) throw new StorageError('Some details are invalid and were not saved.');
    this.put(KEYS.local, state);
  }

  exportAll() {
    return { format: 'icarus-export', version: 1, exportedAt: new Date().toISOString(), profile: this.profile(), plans: this.plans(), activePlanId: this.activePlanId(), history: this.history(), preferences: this.preferences(), local: this.local() };
  }

  /** Replaces local data with a previous export. Validates everything before writing anything. */
  importAll(data: unknown): { plans: number; workouts: number } {
    if (!isObject(data) || data.format !== 'icarus-export' || data.version !== 1) throw new StorageError('This file is not an Icarus export.');
    const plans = Array.isArray(data.plans) ? data.plans : [];
    const history = Array.isArray(data.history) ? data.history : [];
    if (data.profile !== null && !isProfile(data.profile)) throw new StorageError('The profile in this file is invalid.');
    if (!plans.every(isPlan)) throw new StorageError('A plan in this file is invalid.');
    if (!history.every(isWorkout)) throw new StorageError('A workout in this file is invalid.');
    if (data.profile) this.put(KEYS.profile, data.profile); else this.store.remove(PREFIX + KEYS.profile);
    this.put(KEYS.plans, plans);
    this.put(KEYS.history, history);
    this.saveActivePlanId(typeof data.activePlanId === 'string' && plans.some(plan => (plan as Plan).id === data.activePlanId) ? data.activePlanId : null);
    if (isPreferences(data.preferences)) this.put(KEYS.prefs, data.preferences);
    if (isObject(data.local)) this.put(KEYS.local, readLocal(data.local));
    return { plans: plans.length, workouts: history.length };
  }

  clearAll() {
    for (const key of Object.values(KEYS)) this.store.remove(PREFIX + key);
  }
}
