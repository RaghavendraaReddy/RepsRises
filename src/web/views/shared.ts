import { exerciseById } from '../../shared/fitness/exercises.js';
import { describeTarget, estimateMinutes } from '../../shared/fitness/programs.js';
import type { SessionInput } from '../../shared/fitness/session.js';
import type { Plan, PlanDay, PlanExercise } from '../../shared/fitness/types.js';
import { h } from '../core/dom.js';
import { primeAudio } from '../core/feedback.js';
import { store } from '../core/store.js';
import { confirmDialog, toast } from '../ui/components.js';
import { thumb } from '../ui/photo.js';

export function startWorkout(input: SessionInput, navigate: (hash: string) => void): boolean {
  primeAudio();
  if (store.session) {
    toast('Finish or end your current workout before starting another.', { kind: 'error', action: { label: 'Resume', run: () => navigate('#/workout') } });
    return false;
  }
  if (!input.exercises.length) { toast('This session has no exercises yet. Add some in the plan builder.', { kind: 'error' }); return false; }
  try {
    store.startWorkout(input);
    navigate('#/workout');
    return true;
  } catch (error) {
    toast(error instanceof Error ? error.message : 'Could not start the workout.', { kind: 'error' });
    return false;
  }
}

export function startDay(plan: Plan, day: PlanDay, navigate: (hash: string) => void) {
  return startWorkout({ title: day.name, source: 'plan', planId: plan.id, dayId: day.id, exercises: day.exercises }, navigate);
}

export function exerciseRow(item: PlanExercise, options: { href?: boolean } = {}) {
  const exercise = exerciseById(item.exerciseId);
  const content = [
    thumb(item.exerciseId),
    h('span', { class: 'stack', style: { '--stack': '2px' } }, h('span', { class: 'list-title' }, exercise?.name ?? item.exerciseId), h('span', { class: 'list-meta' }, exercise ? exercise.primary.map(muscle => muscle[0].toUpperCase() + muscle.slice(1)).join(' · ') : '')),
    h('span', { class: 'target tabular' }, describeTarget(item)),
  ];
  return options.href && exercise ? h('a', { class: 'list-row exercise-row', href: `#/library/${exercise.id}` }, content) : h('div', { class: 'list-row exercise-row' }, content);
}

export function dayMeta(day: PlanDay) {
  const sets = day.exercises.reduce((sum, item) => sum + item.sets, 0);
  return `${day.exercises.length} exercises · ${sets} sets · about ${estimateMinutes(day.exercises)} min`;
}

export async function confirmLeave(text: string) {
  return confirmDialog({ title: 'Discard changes?', text, confirm: 'Discard', danger: true });
}

export const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;

export function relativeDay(ms: number, now = Date.now()) {
  const day = (value: number) => { const date = new Date(value); date.setHours(0, 0, 0, 0); return date.getTime(); };
  const diff = Math.round((day(now) - day(ms)) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  if (diff < 7) return new Date(ms).toLocaleDateString(undefined, { weekday: 'long' });
  return new Date(ms).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: new Date(ms).getFullYear() === new Date(now).getFullYear() ? undefined : 'numeric' });
}
