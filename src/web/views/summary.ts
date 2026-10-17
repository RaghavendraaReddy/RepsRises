import { formatDuration, formatLoad, formatVolume, recordsIn } from '../../shared/fitness/stats.js';
import { h } from '../core/dom.js';
import type { View, ViewContext } from '../core/router.js';
import { store } from '../core/store.js';
import { button, confirmDialog, eyebrow, linkButton, stat, toast } from '../ui/components.js';
import { icon } from '../ui/icons.js';
import { notFoundView } from './not-found.js';

export function summaryView(context: ViewContext): View {
  const workout = store.history.find(item => item.id === context.params.id);
  if (!workout) return notFoundView();
  const units = store.profile?.units ?? 'kg';
  const records = recordsIn(workout, store.history);
  const fresh = Date.now() - workout.finishedAt < 10 * 60_000;
  const date = new Date(workout.finishedAt).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });

  const remove = async () => {
    const sure = await confirmDialog({ title: 'Delete this workout?', text: 'It will be removed from your history, streaks and records. This cannot be undone.', confirm: 'Delete workout', danger: true });
    if (sure !== true) return;
    store.deleteWorkout(workout.id);
    toast('Workout deleted.');
    context.navigate('#/progress');
  };

  const el = h('div', { class: 'summary surface-dark' },
    h('section', { class: 'container section summary-head' },
      h('div', { class: 'stack', style: { '--stack': '18px' } },
        eyebrow(fresh ? 'Session complete' : date),
        h('h1', { class: 'display' }, fresh ? h('span', null, workout.title, h('br'), h('em', null, 'complete.')) : workout.title),
        h('p', { class: 'lead' }, fresh ? `${date}. ${workout.partial ? 'You ended early and saved what you did; that still counts.' : 'Every planned set logged.'}` : workout.partial ? 'Ended early. Logged sets were saved.' : 'All planned sets logged.')),
      h('div', { class: 'stats summary-stats' },
        stat('Time', formatDuration(workout.activeSec)), stat('Sets', String(workout.totalSets)), stat('Reps', String(workout.totalReps)),
        workout.volumeKg > 0 ? stat('Volume', formatVolume(workout.volumeKg, units).replace(` ${units}`, ''), units) : stat('Exercises', String(workout.exercises.length)))),
    records.length ? h('section', { class: 'container records-band', 'aria-labelledby': 'records-title' },
      h('h2', { class: 'tag signal', id: 'records-title' }, icon('trophy'), records.length === 1 ? 'New personal best' : `${records.length} new personal bests`),
      h('ul', { class: 'records-list', role: 'list' }, records.map(best => h('li', null,
        h('span', { class: 'title' }, best.name),
        h('span', { class: 'numeral' }, best.kind === 'load' ? `${formatLoad(best.loadKg, units)} × ${best.reps}` : best.kind === 'time' ? `${best.seconds}s` : `${best.reps} reps`))))) : null,
    h('section', { class: 'container section-tight', 'aria-labelledby': 'breakdown-title' },
      h('h2', { class: 'eyebrow', id: 'breakdown-title' }, 'Breakdown'),
      h('ol', { class: 'breakdown', role: 'list' }, workout.exercises.map(exercise => h('li', null,
        h('a', { class: 'title breakdown-name', href: `#/library/${exercise.exerciseId}` }, exercise.name),
        h('span', { class: 'breakdown-sets' }, exercise.sets.map(set => h('span', { class: 'set-chip' },
          exercise.kind === 'time' && !set.reps ? `${set.seconds ?? 0}s` : set.loadKg ? `${formatLoad(set.loadKg, units)} × ${set.reps ?? 0}` : `${set.reps ?? 0} reps`))))))),
    h('section', { class: 'container section-tight row' },
      linkButton('Back to today', '#/today', { variant: 'primary', iconAfter: 'arrow' }),
      linkButton('View progress', '#/progress', { variant: 'ghost' }),
      button('Delete workout', () => void remove(), { variant: 'danger', size: 'small', icon: 'trash' })));

  return { el, title: `${workout.title} summary`, surface: 'dark', nav: 'progress' };
}
