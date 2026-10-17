// Core domain types shared by the browser app, the offline coach and the tests.
// Loads are always stored in kilograms; the UI converts for display.

export const EQUIPMENT = ['bodyweight', 'dumbbells', 'barbell', 'kettlebell', 'bench', 'pullup-bar', 'bands', 'cable', 'machines'] as const;
export type Equipment = typeof EQUIPMENT[number];

export const MUSCLES = ['chest', 'back', 'shoulders', 'biceps', 'triceps', 'quads', 'hamstrings', 'glutes', 'calves', 'core', 'cardio'] as const;
export type Muscle = typeof MUSCLES[number];

export const LEVELS = ['beginner', 'intermediate', 'advanced'] as const;
export type Level = typeof LEVELS[number];

export const GOALS = ['strength', 'muscle', 'endurance', 'general'] as const;
export type Goal = typeof GOALS[number];

export type Units = 'kg' | 'lb';

/** Movement families. Each one has a drawn demonstration in the web app. */
export type Pattern =
  | 'squat' | 'hinge' | 'lunge' | 'push-floor' | 'press-bench' | 'press-overhead' | 'pull-vertical' | 'row'
  | 'curl' | 'raise' | 'extension' | 'plank' | 'crunch' | 'bridge' | 'calf' | 'cardio' | 'carry' | 'mobility';

export type ExerciseKind = 'reps' | 'time';

export type Exercise = {
  id: string;
  name: string;
  pattern: Pattern;
  primary: Muscle[];
  secondary: Muscle[];
  /** Every item is required. An empty list means bodyweight only. */
  equipment: Equipment[];
  level: Level;
  kind: ExerciseKind;
  /** True when a load is tracked (dumbbells, barbell...). */
  loaded: boolean;
  compound: boolean;
  summary: string;
  cues: string[];
  mistakes: string[];
};

export type Profile = {
  version: 1;
  name: string;
  goal: Goal;
  level: Level;
  equipment: Equipment[];
  daysPerWeek: number;
  /** 0 = Monday ... 6 = Sunday. */
  trainingDays: number[];
  minutes: number;
  units: Units;
  createdAt: number;
};

export type PlanExercise = {
  uid: string;
  exerciseId: string;
  sets: number;
  reps: number | null;
  repsMax: number | null;
  seconds: number | null;
  restSec: number;
  note: string;
};

export type PlanDay = { id: string; name: string; focus: string; exercises: PlanExercise[] };

export type SplitId = 'full-body-3' | 'upper-lower-4' | 'ppl-3' | 'ppl-6' | 'hybrid-5' | 'full-week-7' | 'custom';

export type Plan = {
  version: 1;
  id: string;
  name: string;
  split: SplitId;
  level: Level;
  goal: Goal;
  days: PlanDay[];
  createdAt: number;
  updatedAt: number;
};

export type SetLog = {
  reps: number | null;
  loadKg: number | null;
  seconds: number | null;
  done: boolean;
  completedAt: number | null;
};

export type SessionExercise = {
  uid: string;
  exerciseId: string;
  name: string;
  kind: ExerciseKind;
  loaded: boolean;
  targetReps: number | null;
  targetRepsMax: number | null;
  targetSeconds: number | null;
  restSec: number;
  note: string;
  sets: SetLog[];
};

export type Countdown = {
  exerciseIndex: number;
  setIndex: number;
  durationSec: number;
  /** Epoch ms when it ends. Null while paused. */
  endsAt: number | null;
  /** Remaining ms while paused. */
  remainingMs: number | null;
};

export type ActiveSession = {
  version: 1;
  id: string;
  title: string;
  source: 'plan' | 'coach' | 'quick';
  planId: string | null;
  dayId: string | null;
  startedAt: number;
  pausedAt: number | null;
  pausedMs: number;
  index: number;
  rest: Countdown | null;
  hold: Countdown | null;
  exercises: SessionExercise[];
};

export type CompletedExercise = {
  exerciseId: string;
  name: string;
  kind: ExerciseKind;
  loaded: boolean;
  sets: { reps: number | null; loadKg: number | null; seconds: number | null }[];
};

export type CompletedWorkout = {
  version: 1;
  id: string;
  title: string;
  planId: string | null;
  dayId: string | null;
  startedAt: number;
  finishedAt: number;
  activeSec: number;
  exercises: CompletedExercise[];
  totalSets: number;
  totalReps: number;
  volumeKg: number;
  /** Set to true when the user ended early with sets left. */
  partial: boolean;
};

export type Preferences = {
  version: 1;
  provider: string | null;
  sound: boolean;
  vibration: boolean;
  motion: 'system' | 'reduced';
  theme: 'system' | 'light' | 'dark';
  autoRest: boolean;
};
