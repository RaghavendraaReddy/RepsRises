import type { ProviderId, ProviderStatus } from '../../shared/coach/contracts.js';
import { generatePlan, recommendedSplit } from '../../shared/fitness/programs.js';
import { finish, seedFromHistory, settle, startSession, type SessionInput } from '../../shared/fitness/session.js';
import { lastPerformance, weekday } from '../../shared/fitness/stats.js';
import { MemoryStore, Repository, StorageError, type KeyValueStore } from '../../shared/fitness/storage.js';
import { coarseLocation, readLocal, toggleCompare, toggleSaved, type CompareItem, type LocalRequest, type LocalState, type SavedKind } from '../../shared/marketplace/local.js';
import type { UserLocation } from '../../shared/marketplace/types.js';
import type { Audience } from '../../shared/fitness/types.js';
import type { ActiveSession, CompletedWorkout, Plan, PlanDay, Preferences, Profile } from '../../shared/fitness/types.js';

class BrowserStore implements KeyValueStore {
  read(key: string) { return localStorage.getItem(key); }
  write(key: string, value: string) { localStorage.setItem(key, value); }
  remove(key: string) { localStorage.removeItem(key); }
}

function pickStore(): { store: KeyValueStore; persistent: boolean } {
  try {
    const probe = '__icarus_probe__';
    localStorage.setItem(probe, '1');
    localStorage.removeItem(probe);
    return { store: new BrowserStore(), persistent: true };
  } catch {
    return { store: new MemoryStore(), persistent: false };
  }
}

export type ServerConfig = { appVersion: string; token: string; providers: ProviderStatus[]; defaultProvider: ProviderId; testFaults: boolean;
  map: { tileUrl: string; attribution: string } | null; supportEmail: string | null; marketplace: { name: string; demo: boolean }; requestsForwarded: boolean; retentionDays: number };
export type StoredMessage = { role: 'user' | 'assistant'; content: string; workout?: unknown; split?: unknown; suggestions?: unknown; error?: boolean };

type Listener = (reason: string) => void;

/**
 * Single source of truth for the browser app. Screens read from it and call its actions; every
 * action validates and persists through the Repository, then notifies subscribers.
 */
export class AppStore {
  readonly repo: Repository;
  readonly persistent: boolean;
  profile: Profile | null;
  plans: Plan[];
  activePlanId: string | null;
  history: CompletedWorkout[];
  session: ActiveSession | null;
  prefs: Preferences;
  local: LocalState;
  config: ServerConfig | null = null;
  configError = '';
  private listeners = new Set<Listener>();
  private finishing = false;

  constructor() {
    const { store, persistent } = pickStore();
    this.persistent = persistent;
    this.repo = new Repository(store);
    this.profile = this.repo.profile();
    this.plans = this.repo.plans();
    this.activePlanId = this.repo.activePlanId();
    this.history = this.repo.history();
    this.session = this.repo.session();
    this.prefs = this.repo.preferences();
    this.local = this.repo.local();
    if (this.activePlanId && !this.plans.some(plan => plan.id === this.activePlanId)) this.activePlanId = this.plans[0]?.id ?? null;
    // Another tab changed the data: reload so both stay consistent.
    window.addEventListener('storage', event => { if (event.key?.startsWith('icarus.v1.')) { this.reload(); this.emit('external'); } });
  }

  reload() {
    this.profile = this.repo.profile();
    this.plans = this.repo.plans();
    this.activePlanId = this.repo.activePlanId();
    this.history = this.repo.history();
    this.session = this.repo.session();
    this.prefs = this.repo.preferences();
    this.local = this.repo.local();
  }

  subscribe(listener: Listener) { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  emit(reason = 'change') { for (const listener of [...this.listeners]) listener(reason); }

  private guard<T>(work: () => T): T {
    try { return work(); }
    catch (error) {
      if (error instanceof StorageError) throw error;
      throw new StorageError(error instanceof Error ? error.message : 'Could not save.');
    }
  }

  // Profile & preferences
  saveProfile(profile: Profile) { this.guard(() => this.repo.saveProfile(profile)); this.profile = profile; this.emit('profile'); }
  savePrefs(prefs: Preferences) { this.guard(() => this.repo.savePreferences(prefs)); this.prefs = prefs; this.applyAppearance(); this.emit('prefs'); }
  applyAppearance() {
    const root = document.documentElement;
    if (this.prefs.theme === 'system') delete root.dataset.theme; else root.dataset.theme = this.prefs.theme;
    if (this.prefs.motion === 'reduced') root.dataset.motion = 'reduced'; else delete root.dataset.motion;
  }

  // Plans
  activePlan(): Plan | undefined { return this.plans.find(plan => plan.id === this.activePlanId) ?? this.plans[0]; }
  upsertPlan(plan: Plan, makeActive = false) {
    const next = { ...plan, updatedAt: Date.now() };
    const plans = this.plans.some(item => item.id === plan.id) ? this.plans.map(item => item.id === plan.id ? next : item) : [...this.plans, next];
    this.guard(() => this.repo.savePlans(plans));
    this.plans = plans;
    if (makeActive || !this.activePlanId) this.setActivePlan(plan.id, false);
    this.emit('plans');
    return next;
  }
  deletePlan(id: string) {
    const plans = this.plans.filter(plan => plan.id !== id);
    this.guard(() => this.repo.savePlans(plans));
    this.plans = plans;
    if (this.activePlanId === id) this.setActivePlan(plans[0]?.id ?? null, false);
    this.emit('plans');
  }
  setActivePlan(id: string | null, notify = true) {
    this.guard(() => this.repo.saveActivePlanId(id));
    this.activePlanId = id;
    if (notify) this.emit('plans');
  }
  /** Creates the recommended plan for a profile (used at the end of onboarding). */
  createRecommendedPlan(profile: Profile): Plan {
    const audience = this.audience();
    const plan = generatePlan({ split: recommendedSplit(profile.daysPerWeek, profile.level, audience), level: profile.level, goal: profile.goal, equipment: profile.equipment, minutes: profile.minutes, audience });
    return this.upsertPlan(plan, true);
  }

  /** The next day in the plan's rotation: the one after the last day completed from this plan. */
  nextDay(plan: Plan | undefined = this.activePlan()): PlanDay | undefined {
    if (!plan?.days.length) return undefined;
    const last = this.history.find(workout => workout.planId === plan.id && workout.dayId);
    const index = last ? plan.days.findIndex(day => day.id === last.dayId) : -1;
    return plan.days[(index + 1) % plan.days.length];
  }
  isTrainingDay(ms = Date.now()) { return !this.profile || this.profile.trainingDays.length === 0 || this.profile.trainingDays.includes(weekday(ms)); }

  // Workout session
  startWorkout(input: SessionInput): ActiveSession {
    if (this.session) throw new StorageError('A workout is already in progress. Finish or end it first.');
    const session = seedFromHistory(startSession(input, Date.now()), id => lastPerformance(this.history, id)?.sets);
    this.guard(() => this.repo.saveSession(session));
    this.session = session;
    this.emit('session');
    return session;
  }
  updateSession(change: (session: ActiveSession) => ActiveSession) {
    if (!this.session) return;
    const next = change(this.session);
    if (next === this.session) return;
    this.guard(() => this.repo.saveSession(next));
    this.session = next;
    this.emit('session');
  }
  /** Applies timers that ended while the tab was hidden or closed. Returns what happened. */
  settleSession(now = Date.now()) {
    if (!this.session) return [];
    const { session, events } = settle(this.session, now, this.prefs.autoRest);
    if (events.length) { this.guard(() => this.repo.saveSession(session)); this.session = session; this.emit('session'); }
    return events;
  }
  /** Saves the workout to history exactly once, even on double taps or two tabs. */
  finishWorkout(): CompletedWorkout | null {
    if (!this.session || this.finishing) return null;
    this.finishing = true;
    try {
      const workout = finish(this.session, Date.now());
      if (!workout.totalSets) { this.discardWorkout(); return null; }
      const { history } = this.guard(() => this.repo.addWorkout(workout));
      this.guard(() => this.repo.saveSession(null));
      this.history = history;
      this.session = null;
      this.emit('history');
      return workout;
    } finally { this.finishing = false; }
  }
  discardWorkout() {
    this.guard(() => this.repo.saveSession(null));
    this.session = null;
    this.emit('session');
  }
  deleteWorkout(id: string) {
    this.guard(() => this.repo.deleteWorkout(id));
    this.history = this.repo.history();
    this.emit('history');
  }

  // Coach conversation
  coachMessages(): StoredMessage[] { return this.repo.coach() as StoredMessage[]; }
  saveCoachMessages(messages: StoredMessage[]) { try { this.repo.saveCoach(messages); } catch { /* the conversation is a convenience; failing to keep it is not fatal */ } }

  // Marketplace and audience (kept on this device)
  /** The chosen audience; adults until the visitor chooses. */
  audience(): Audience { return this.local.audience ?? 'adults'; }
  private saveLocal(next: LocalState, reason: string) {
    const clean = readLocal(next);
    this.guard(() => this.repo.saveLocal(clean));
    this.local = clean;
    this.emit(reason);
  }
  setAudience(audience: Audience) { this.saveLocal({ ...this.local, audience }, 'audience'); }
  setLocation(location: UserLocation | null) { this.saveLocal({ ...this.local, location: location ? coarseLocation(location) : null }, 'location'); }
  isSaved(kind: SavedKind, id: string) { return this.local.saved[kind].includes(id); }
  toggleSaved(kind: SavedKind, id: string) { this.saveLocal(toggleSaved(this.local, kind, id), 'saved'); return this.isSaved(kind, id); }
  inCompare(item: CompareItem) { return this.local.compare.some(entry => entry.gymId === item.gymId && entry.planId === item.planId); }
  /** Returns false when the comparison is full. */
  toggleCompare(item: CompareItem) { const next = toggleCompare(this.local, item); if (!next) return false; this.saveLocal(next, 'compare'); return true; }
  clearCompare() { this.saveLocal({ ...this.local, compare: [] }, 'compare'); }
  addRequest(request: LocalRequest) { this.saveLocal({ ...this.local, requests: [request, ...this.local.requests.filter(item => item.ref !== request.ref)].slice(0, 50) }, 'requests'); }
  updateRequest(ref: string, change: Partial<LocalRequest>) { this.saveLocal({ ...this.local, requests: this.local.requests.map(item => item.ref === ref ? { ...item, ...change } : item) }, 'requests'); }
  forgetRequest(ref: string) { this.saveLocal({ ...this.local, requests: this.local.requests.filter(item => item.ref !== ref) }, 'requests'); }
  saveNutrition(nutrition: LocalState['nutrition']) { this.saveLocal({ ...this.local, nutrition }, 'nutrition'); }

  // Data management
  importData(data: unknown) {
    const result = this.guard(() => this.repo.importAll(data));
    this.reload();
    this.applyAppearance();
    this.emit('import');
    return result;
  }
  clearAll() {
    this.repo.clearAll();
    this.reload();
    this.applyAppearance();
    this.emit('reset');
  }

  // Coach provider preference: restore the saved one when it is still available on this server.
  provider(): ProviderId {
    const providers = this.config?.providers ?? [];
    const saved = providers.find(item => item.id === this.prefs.provider && item.enabled);
    return saved?.id ?? this.config?.defaultProvider ?? 'offline';
  }
}

export const store = new AppStore();
