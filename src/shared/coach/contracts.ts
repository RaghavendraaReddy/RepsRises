import { exerciseById, findExercise } from '../fitness/exercises.js';
import { AUDIENCES, EQUIPMENT, GOALS, LEVELS } from '../fitness/types.js';
import { int, list, nullable, obj, oneOf, str, valid } from '../schema.js';

export const APP_VERSION = '4.0.0';

export const PROVIDERS = ['offline', 'anthropic-api', 'openai-api', 'claude-cli', 'codex-cli'] as const;
export type ProviderId = typeof PROVIDERS[number];
export type ProviderStatus = { id: ProviderId; label: string; enabled: boolean; model: string; detail: string };

export const SPLIT_IDS = ['full-body-3', 'upper-lower-4', 'ppl-3', 'ppl-6', 'hybrid-5', 'full-week-7', 'play-move-3', 'active-ageing-3'] as const;

// Product limits. They keep requests bounded and screens readable; they are not coaching rules.
export const LIMITS = { messages: 40, userChars: 4000, assistantChars: 12000, replyChars: 8000, draftExercises: 20, maxSets: 10, maxReps: 100, maxSeconds: 3600, maxRest: 600 } as const;

export type CoachMessage = { role: 'user' | 'assistant'; content: string };
export type CoachContext = {
  name: string | null; goal: typeof GOALS[number] | null; level: typeof LEVELS[number] | null; equipment: typeof EQUIPMENT[number][];
  minutes: number | null; units: 'kg' | 'lb'; plan: string; recent: string; session: string;
  /** Who is training: shapes exercise choice, volume and safety advice. */
  audience: typeof AUDIENCES[number];
};
export type CoachRequest = { provider: ProviderId; messages: CoachMessage[]; context: CoachContext; fault?: 'none' | 'error' | 'slow' };

export type DraftExercise = { name: string; exerciseId: string | null; sets: number; reps: number | null; repsMax: number | null; seconds: number | null; restSec: number; cue: string };
export type WorkoutDraft = { title: string; focus: string; minutes: number; exercises: DraftExercise[] };
export type CoachReply = { reply: string; workout: WorkoutDraft | null; split: typeof SPLIT_IDS[number] | null; suggestions: string[] };

export const contextSchema = obj({
  name: nullable(str(60)), goal: nullable(oneOf(GOALS)), level: nullable(oneOf(LEVELS)), equipment: list(oneOf(EQUIPMENT), EQUIPMENT.length),
  minutes: nullable(int(5, 240)), units: oneOf(['kg', 'lb']), plan: str(4000, 0), recent: str(4000, 0), session: str(3000, 0), audience: oneOf(AUDIENCES),
});

export const requestSchema = obj({
  provider: oneOf(PROVIDERS),
  messages: list({ anyOf: [obj({ role: oneOf(['user']), content: str(LIMITS.userChars) }), obj({ role: oneOf(['assistant']), content: str(LIMITS.assistantChars) })] }, LIMITS.messages),
  context: contextSchema,
});

export function isCoachRequest(value: unknown): value is CoachRequest {
  if (!value || typeof value !== 'object') return false;
  const { fault, ...rest } = value as Record<string, unknown>;
  if (fault !== undefined && !['none', 'error', 'slow'].includes(fault as string)) return false;
  return valid(requestSchema, rest) && (rest as CoachRequest).messages.at(-1)?.role === 'user';
}

export const draftExerciseSchema = obj({
  name: str(80), exerciseId: nullable(str(80)), sets: int(1, LIMITS.maxSets), reps: nullable(int(1, LIMITS.maxReps)), repsMax: nullable(int(1, LIMITS.maxReps)),
  seconds: nullable(int(5, LIMITS.maxSeconds)), restSec: int(0, LIMITS.maxRest), cue: str(240, 0),
});
export const workoutSchema = obj({ title: str(80), focus: str(160, 0), minutes: int(5, 240), exercises: list(draftExerciseSchema, LIMITS.draftExercises) });
export const replySchema = obj({
  reply: str(LIMITS.replyChars), workout: nullable(workoutSchema), split: nullable(oneOf(SPLIT_IDS)), suggestions: list(str(80), 4),
});

/**
 * Validates a provider reply and normalises it: catalog ids are checked, unknown ids are re-matched
 * by name, and every exercise must have either reps or a duration. Throws on anything unusable.
 */
export function checkReply(value: unknown): CoachReply {
  if (!valid(replySchema, value)) throw new Error('The coach reply did not match the expected format.');
  const reply = structuredClone(value) as CoachReply;
  if (reply.workout) {
    if (!reply.workout.exercises.length) reply.workout = null;
    else for (const exercise of reply.workout.exercises) {
      if (exercise.exerciseId && !exerciseById(exercise.exerciseId)) exercise.exerciseId = null;
      if (!exercise.exerciseId) exercise.exerciseId = findExercise(exercise.name)?.id ?? null;
      if (exercise.reps === null && exercise.seconds === null) throw new Error('A suggested exercise had no reps or duration.');
      if (exercise.reps !== null && exercise.repsMax !== null && exercise.repsMax < exercise.reps) exercise.repsMax = exercise.reps;
    }
  }
  return reply;
}

export type CoachResult = { reply: CoachReply; meta: { provider: ProviderId; model: string; returnedModel: string | null; ms: number } };
