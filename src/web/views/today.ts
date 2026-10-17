import { exerciseById, MUSCLE_LABEL } from '../../shared/fitness/exercises.js';
import { generateSession } from '../../shared/fitness/programs.js';
import { elapsedMs, progress } from '../../shared/fitness/session.js';
import { addDays, dayKey, formatClock, formatLoad, personalBests, thisWeek, weekday, weeklyStreak, weekStart } from '../../shared/fitness/stats.js';
import type { Muscle, PlanDay } from '../../shared/fitness/types.js';
import { h } from '../core/dom.js';
import type { View, ViewContext } from '../core/router.js';
import { store } from '../core/store.js';
import { button, empty, eyebrow, linkButton, openDialog, stat } from '../ui/components.js';
import { figure } from '../ui/figure.js';
import { icon } from '../ui/icons.js';
import { dayMeta, exerciseRow, plural, relativeDay, startDay, startWorkout } from './shared.js';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function greeting(name: string) {
  const hour = new Date().getHours();
  const part = hour < 5 ? 'Late night' : hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  return name ? `${part}, ${name}.` : `${part}.`;
}

/** Muscles with hard sets logged in the last 48 hours. A guideline from logged data, not a recovery measurement. */
function recentLoad(now: number) {
  const since = now - 48 * 3600_000;
  const sets = new Map<Muscle, { sets: number; at: number }>();
  for (const workout of store.history) {
    if (workout.finishedAt < since) break;
    for (const exercise of workout.exercises) for (const muscle of exerciseById(exercise.exerciseId)?.primary ?? []) {
      if (muscle === 'cardio') continue;
      const entry = sets.get(muscle) ?? { sets: 0, at: workout.finishedAt };
      entry.sets += exercise.sets.length;
      entry.at = Math.max(entry.at, workout.finishedAt);
      sets.set(muscle, entry);
    }
  }
  return [...sets.entries()].filter(([, entry]) => entry.sets >= 4).sort((a, b) => b[1].sets - a[1].sets);
}

export function todayView(context: ViewContext): View {
  const now = Date.now();
  const profile = store.profile!;
  const plan = store.activePlan();
  const session = store.session;
  const trainingDay = store.isTrainingDay(now);
  let day = store.nextDay(plan);

  const date = new Date(now).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
  const heroFigure = h('div', { class: 'today-figure' });
  const heroBody = h('div', { class: 'today-copy stack', style: { '--stack': '20px' } });

  const chooseDay = () => {
    if (!plan) return;
    const close = openDialog({ title: 'Choose a session', eyebrow: plan.name, surface: 'light', body: h('ul', { class: 'list', role: 'list' }, plan.days.map(item => h('li', null,
      h('button', { type: 'button', class: 'list-row', onclick: () => { close(); startDay(plan, item, context.navigate); } },
        h('span', { class: 'numeral day-index' }, String(plan.days.indexOf(item) + 1).padStart(2, '0')),
        h('span', { class: 'stack', style: { '--stack': '2px' } }, h('span', { class: 'list-title' }, item.name), h('span', { class: 'list-meta' }, `${item.focus} · ${dayMeta(item)}`)),
        icon('arrow'))))) });
  };

  if (session) {
    const done = progress(session);
    const current = session.exercises[session.index];
    heroFigure.append(figure(current.exerciseId, { title: current.name }));
    heroBody.append(
      h('p', { class: 'eyebrow' }, 'Session in progress'),
      h('h1', { class: 'display' }, session.title),
      h('p', { class: 'lead' }, `${done.done} of ${plural(done.total, 'set')} logged · ${session.pausedAt ? 'paused' : `${formatClock(elapsedMs(session, now))} elapsed`}. Up now: ${current.name}.`),
      h('div', { class: 'meter today-meter', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': String(done.total), 'aria-valuenow': String(done.done), 'aria-label': 'Sets logged' }, h('span', { style: { width: `${done.ratio * 100}%` } })),
      h('div', { class: 'row' }, linkButton('Resume session', '#/workout', { variant: 'signal', iconAfter: 'arrow' })));
  } else if (!plan || !day) {
    heroBody.append(
      h('p', { class: 'eyebrow' }, date),
      h('h1', { class: 'display' }, greeting(profile.name)),
      h('p', { class: 'lead' }, 'You do not have an active plan. Build one from a template in a few seconds, or ask the coach for a single session.'),
      h('div', { class: 'row' }, linkButton('Build a plan', '#/plans', { variant: 'primary', iconAfter: 'arrow' }), linkButton('Ask the coach', '#/coach', { variant: 'ghost' })));
    heroFigure.append(figure('goblet-squat', { title: 'Training figure' }));
  } else if (!trainingDay) {
    const mobility = generateSession({ muscles: ['mobility'], level: profile.level, goal: profile.goal, equipment: profile.equipment, minutes: 15 });
    heroBody.append(
      h('p', { class: 'eyebrow' }, `${date} · Rest day`),
      h('h1', { class: 'display' }, 'Recover with ', h('em', null, 'intent.')),
      h('p', { class: 'lead' }, `Rest is where the work you did becomes strength. A short walk and some easy mobility help. Next up: ${day.name}.`),
      h('div', { class: 'row' },
        button('Start 15-min mobility', () => startWorkout({ title: 'Mobility & Recovery', source: 'quick', exercises: mobility }, context.navigate), { variant: 'primary', iconAfter: 'arrow' }),
        button(`Train ${day.name} anyway`, () => startDay(plan, day!, context.navigate), { variant: 'ghost' })));
    heroFigure.append(figure('worlds-greatest-stretch', { title: 'Mobility figure' }));
  } else {
    heroBody.append(
      h('p', { class: 'eyebrow' }, `${date} · ${greeting(profile.name)}`),
      h('h1', { class: 'display' }, day.name),
      h('p', { class: 'lead' }, day.focus),
      h('p', { class: 'today-meta tag' }, dayMeta(day)),
      h('div', { class: 'row' },
        button('Begin session', () => startDay(plan, day!, context.navigate), { variant: 'signal', iconAfter: 'arrow' }),
        plan.days.length > 1 ? button('Choose another day', chooseDay, { variant: 'ghost' }) : null));
    if (day.exercises[0]) heroFigure.append(figure(day.exercises[0].exerciseId, { title: exerciseById(day.exercises[0].exerciseId)?.name }));
  }

  // Week strip
  const start = weekStart(now);
  const trainedDays = new Set(store.history.map(workout => dayKey(workout.finishedAt)));
  const todayIndex = weekday(now);
  const week = h('ol', { class: 'week-strip', role: 'list', 'aria-label': 'This week' }, WEEKDAYS.map((label, index) => {
    const key = dayKey(addDays(start, index));
    const trained = trainedDays.has(key), planned = profile.trainingDays.includes(index);
    const state = trained ? 'Trained' : planned ? (index < todayIndex ? 'Planned, missed' : 'Planned') : 'Rest';
    return h('li', { class: [index === todayIndex ? 'today' : '', trained ? 'trained' : '', planned ? 'planned' : ''].join(' ') },
      h('span', { class: 'tag' }, label), h('span', { class: 'day-mark', 'aria-hidden': 'true' }, trained ? icon('check') : null), h('span', { class: 'sr-only' }, `${label}: ${state}${index === todayIndex ? ' (today)' : ''}`));
  }));

  const weekCount = thisWeek(store.history, now).length;
  const streak = weeklyStreak(store.history, now);
  const bests = personalBests(store.history);
  const recovery = recentLoad(now);
  const dayMuscles = new Set((day?.exercises ?? []).flatMap(item => exerciseById(item.exerciseId)?.primary ?? []));
  const overlap = recovery.filter(([muscle]) => dayMuscles.has(muscle));

  const preview = day && plan && !session ? h('section', { class: 'panel', 'aria-labelledby': 'preview-title' },
    h('div', { class: 'panel-head' }, h('h2', { class: 'title', id: 'preview-title' }, trainingDay ? "Today's session" : `Next: ${day.name}`), h('a', { class: 'text-link small', href: `#/plans/${plan.id}` }, 'Edit plan')),
    h('div', { class: 'list' }, (day as PlanDay).exercises.map(item => exerciseRow(item, { href: true })))) : null;

  const recent = h('section', { class: 'panel', 'aria-labelledby': 'recent-title' },
    h('div', { class: 'panel-head' }, h('h2', { class: 'title', id: 'recent-title' }, 'Recent'), store.history.length ? h('a', { class: 'text-link small', href: '#/progress' }, 'All history') : null),
    store.history.length ? h('ul', { class: 'list', role: 'list' }, store.history.slice(0, 4).map(workout => h('li', null, h('a', { class: 'list-row', href: `#/summary/${workout.id}` },
      h('span', { class: 'tag' }, relativeDay(workout.finishedAt, now)),
      h('span', { class: 'list-title' }, workout.title),
      h('span', { class: 'list-meta tabular' }, `${workout.totalSets} sets · ${Math.round(workout.activeSec / 60)} min`)))))
      : empty({ title: 'No sessions yet', text: 'Your completed workouts will appear here, with sets, time and records.', icon: 'calendar' }));

  const records = h('section', { class: 'panel', 'aria-labelledby': 'records-title' },
    h('div', { class: 'panel-head' }, h('h2', { class: 'title', id: 'records-title' }, 'Personal bests'), bests.length ? h('a', { class: 'text-link small', href: '#/progress?tab=records' }, 'All records') : null),
    bests.length ? h('ul', { class: 'list', role: 'list' }, bests.slice(0, 4).map(best => h('li', null, h('div', { class: 'list-row' },
      icon('trophy', 'record-icon'), h('span', { class: 'list-title' }, best.name),
      h('span', { class: 'list-meta tabular' }, best.kind === 'load' ? `${formatLoad(best.loadKg, profile.units)} × ${best.reps}` : best.kind === 'time' ? `${best.seconds}s` : `${best.reps} reps`)))))
      : h('p', { class: 'muted small' }, 'Records appear once you have logged the same exercise more than once.'));

  const recoveryPanel = h('section', { class: 'panel recovery', 'aria-labelledby': 'recovery-title' },
    h('div', { class: 'panel-head' }, h('h2', { class: 'title', id: 'recovery-title' }, 'Recovery'), h('span', { class: 'tag' }, 'Guideline')),
    recovery.length ? h('div', { class: 'stack' },
      h('p', { class: 'body' }, `In the last 48 hours you logged hard work for ${recovery.slice(0, 3).map(([muscle, entry]) => `${MUSCLE_LABEL[muscle].toLowerCase()} (${entry.sets} sets)`).join(', ')}.`),
      h('p', { class: 'body' }, overlap.length && trainingDay && !session ? `Today's session trains ${overlap.map(([muscle]) => MUSCLE_LABEL[muscle].toLowerCase()).join(' and ')} again. If they still feel heavy, keep loads moderate or choose another day.` : 'Today’s session works different muscles, so you should be ready to train.'))
      : h('p', { class: 'body' }, 'No hard sets logged in the last 48 hours. You are fresh.'),
    h('p', { class: 'small muted' }, 'Based only on the sets you logged. Sleep, stress and soreness matter more than any number here.'));

  const el = h('div', { class: 'today' },
    h('section', { class: 'today-hero surface-dark', 'aria-labelledby': 'today-title' },
      h('div', { class: 'container today-grid' }, heroBody, heroFigure)),
    h('div', { class: 'surface-light today-body' },
      h('div', { class: 'container section-tight stack', style: { '--stack': '40px' } },
        h('div', { class: 'stats' },
          stat('Week streak', String(streak), streak === 1 ? 'week' : 'weeks'),
          stat('This week', `${weekCount}`, `/ ${profile.daysPerWeek}`),
          stat('Sessions', String(store.history.length)),
          stat('Records', String(bests.length))),
        h('div', { class: 'week-wrap' }, eyebrow('This week', true), week),
        h('div', { class: 'today-columns' }, h('div', { class: 'stack', style: { '--stack': '24px' } }, preview, recoveryPanel), h('div', { class: 'stack', style: { '--stack': '24px' } }, recent, records)))));
  el.querySelector('h1')?.setAttribute('id', 'today-title');
  return { el, title: 'Today', surface: 'dark', nav: 'today' };
}
