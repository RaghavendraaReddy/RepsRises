import type { CoachContext, CoachMessage, CoachRequest, CoachResult, ProviderId } from '../../shared/coach/contracts.js';
import { exerciseById } from '../../shared/fitness/exercises.js';
import { describeTarget } from '../../shared/fitness/programs.js';
import { formatLoad } from '../../shared/fitness/stats.js';
import { store, type ServerConfig } from './store.js';

export async function loadConfig(): Promise<ServerConfig> {
  const response = await fetch('/api/config', { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error('The server did not answer.');
  return await response.json() as ServerConfig;
}

export class CoachError extends Error {
  constructor(message: string, public code: string, public retryable: boolean) { super(message); }
}

export async function askCoach(provider: ProviderId, messages: CoachMessage[], signal: AbortSignal, fault?: CoachRequest['fault']): Promise<CoachResult> {
  if (!store.config) throw new CoachError('Not connected to the Icarus server. Check it is running, then reload.', 'OFFLINE', true);
  const body: CoachRequest = { provider, messages, context: coachContext(), ...(fault ? { fault } : {}) };
  let response: Response;
  try {
    response = await fetch('/api/coach', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Icarus-Token': store.config.token }, body: JSON.stringify(body), signal });
  } catch (error) {
    if (signal.aborted) throw new CoachError('Cancelled.', 'CANCELLED', true);
    throw new CoachError('Could not reach the Icarus server. Check your connection.', 'NETWORK', true);
  }
  let data: { error?: string; code?: string } & Partial<CoachResult>;
  try { data = await response.json(); } catch { throw new CoachError('The server sent an unreadable answer.', 'SCHEMA', true); }
  if (!response.ok || !data.reply) throw new CoachError(data.error ?? 'The coach could not answer.', data.code ?? 'ERROR', response.status !== 403);
  return data as CoachResult;
}

/** A compact, bounded summary of what the coach needs to know. Sent as data, never as instructions. */
export function coachContext(): CoachContext {
  const profile = store.profile;
  const units = profile?.units ?? 'kg';
  const plan = store.activePlan();
  const planText = plan ? `${plan.name} (${plan.days.length} days, ${plan.level}, goal ${plan.goal}):\n` + plan.days.map(day => `- ${day.name}: ${day.exercises.map(item => `${exerciseById(item.exerciseId)?.name ?? item.exerciseId} ${describeTarget(item)}`).join(', ')}`).join('\n') : '';
  const recent = store.history.slice(0, 5).map(workout => `- ${new Date(workout.finishedAt).toDateString()}: ${workout.title}, ${workout.totalSets} sets, ${Math.round(workout.activeSec / 60)} min. ` +
    workout.exercises.slice(0, 6).map(exercise => `${exercise.name} ${exercise.sets.map(set => set.seconds && !set.reps ? `${set.seconds}s` : `${set.reps ?? '?'}${set.loadKg ? '@' + formatLoad(set.loadKg, units) : ''}`).join('/')}`).join('; ')).join('\n');
  const session = store.session ? `In progress: ${store.session.title}, on ${store.session.exercises[store.session.index]?.name}.` : '';
  return {
    name: profile?.name || null, goal: profile?.goal ?? null, level: profile?.level ?? null, equipment: profile?.equipment ?? [], minutes: profile?.minutes ?? null, units,
    plan: planText.slice(0, 4000), recent: recent.slice(0, 4000), session: session.slice(0, 3000), audience: store.audience(),
  };
}
