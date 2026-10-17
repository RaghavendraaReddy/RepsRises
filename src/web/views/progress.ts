import { dayKey, formatDuration, formatLoad, formatVolume, monthGrid, monthSummary, personalBests, toDisplay, totals, weeklyStreak, weeklySummary } from '../../shared/fitness/stats.js';
import { h, replace } from '../core/dom.js';
import type { View, ViewContext } from '../core/router.js';
import { store } from '../core/store.js';
import { barChart, button, empty, eyebrow, linkButton, stat, tabs } from '../ui/components.js';
import { plural, relativeDay } from './shared.js';

type Tab = 'overview' | 'workouts' | 'records';

export function progressView(context: ViewContext): View {
  const units = store.profile?.units ?? 'kg';
  let tab: Tab = (['overview', 'workouts', 'records'] as Tab[]).includes(context.query.get('tab') as Tab) ? context.query.get('tab') as Tab : 'overview';
  let monthOffset = 0;
  const el = h('div', { class: 'page surface-light progress' });
  const body = h('div', { class: 'progress-body' });

  const calendar = () => {
    const now = new Date();
    const month = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1).getTime();
    const cells = monthGrid(store.history, month, Date.now());
    const todayKey = dayKey(Date.now());
    const summary = monthSummary(store.history, month);
    const label = new Date(month).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    return h('section', { class: 'panel', 'aria-labelledby': 'cal-title' },
      h('div', { class: 'panel-head' },
        h('h2', { class: 'title', id: 'cal-title' }, label),
        h('div', { class: 'row' },
          button('', () => { monthOffset--; draw(); }, { variant: 'ghost', size: 'small', icon: 'chevron-left', label: 'Previous month' }),
          button('', () => { monthOffset++; draw(); }, { variant: 'ghost', size: 'small', icon: 'chevron', label: 'Next month', attrs: { disabled: monthOffset >= 0 } }))),
      h('div', { class: 'calendar', role: 'grid', 'aria-label': `Training days in ${label}` },
        h('div', { class: 'cal-row cal-head', role: 'row' }, ['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, index) => h('span', { role: 'columnheader', 'aria-label': ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][index] }, day))),
        Array.from({ length: cells.length / 7 }, (_, week) => h('div', { class: 'cal-row', role: 'row' }, cells.slice(week * 7, week * 7 + 7).map(cell => cell
          ? h('span', { role: 'gridcell', class: `cal-cell level-${Math.min(cell.count, 3)}${cell.future ? ' future' : ''}${cell.key === todayKey ? ' today' : ''}`, 'aria-label': `${cell.day}: ${cell.count ? plural(cell.count, 'workout') : 'no workout'}`, title: `${cell.count ? plural(cell.count, 'workout') : 'Rest'}` }, String(cell.day))
          : h('span', { role: 'gridcell', class: 'cal-cell blank', 'aria-hidden': 'true' }))))),
      h('div', { class: 'row between cal-foot' },
        h('p', { class: 'small muted' }, `${plural(summary.workouts, 'workout')} on ${plural(summary.activeDays, 'day')} · ${plural(summary.sets, 'set')} · ${summary.minutes} min`),
        h('div', { class: 'cal-legend', 'aria-hidden': 'true' }, h('span', { class: 'small muted' }, 'Rest'), h('span', { class: 'cal-cell level-0' }), h('span', { class: 'cal-cell level-1' }), h('span', { class: 'cal-cell level-2' }), h('span', { class: 'small muted' }, '2+'))));
  };

  const overview = () => {
    const all = totals(store.history);
    const weeks = weeklySummary(store.history, Date.now(), 12);
    const label = (start: number) => new Date(start).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
    return h('div', { class: 'stack', style: { '--stack': '32px' } },
      h('div', { class: 'stats' },
        stat('Week streak', String(weeklyStreak(store.history, Date.now()))),
        stat('Workouts', String(all.workouts)),
        stat('Time trained', formatDuration(all.minutes * 60).replace(/:\d\d$/, ''), all.minutes >= 60 ? 'h:mm' : 'min'),
        stat('Volume', formatVolume(all.volumeKg, units).replace(` ${units}`, ''), units)),
      h('div', { class: 'chart-grid' },
        h('section', { class: 'panel', 'aria-labelledby': 'freq-title' },
          h('div', { class: 'panel-head' }, h('h2', { class: 'title', id: 'freq-title' }, 'Workouts per week'), h('span', { class: 'tag' }, 'Last 12 weeks')),
          barChart({ label: 'Workouts per week, last 12 weeks', highlightLast: true, data: weeks.map(week => ({ key: String(week.start), label: label(week.start), value: week.workouts, display: plural(week.workouts, 'workout') })) })),
        h('section', { class: 'panel', 'aria-labelledby': 'vol-title' },
          h('div', { class: 'panel-head' }, h('h2', { class: 'title', id: 'vol-title' }, `Volume per week (${units})`), h('span', { class: 'tag' }, 'Reps × load')),
          barChart({ label: `Training volume per week in ${units}, last 12 weeks`, highlightLast: true, emptyText: 'No loaded sets yet. Volume counts reps × load for exercises with weights.', data: weeks.map(week => ({ key: String(week.start), label: label(week.start), value: toDisplay(week.volumeKg, units), display: formatVolume(week.volumeKg, units) })) }))),
      calendar());
  };

  const workouts = () => {
    const groups = new Map<string, typeof store.history>();
    for (const workout of store.history) {
      const key = new Date(workout.finishedAt).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
      groups.set(key, [...(groups.get(key) ?? []), workout]);
    }
    return h('div', { class: 'stack', style: { '--stack': '32px' } }, [...groups.entries()].map(([month, items]) => h('section', { 'aria-label': month },
      h('h2', { class: 'eyebrow muted' }, month),
      h('ul', { class: 'list', role: 'list' }, items.map(workout => h('li', null, h('a', { class: 'list-row history-row', href: `#/summary/${workout.id}` },
        h('span', { class: 'history-date' }, h('span', { class: 'numeral' }, String(new Date(workout.finishedAt).getDate())), h('span', { class: 'tag' }, relativeDay(workout.finishedAt))),
        h('span', { class: 'stack', style: { '--stack': '2px' } }, h('span', { class: 'list-title' }, workout.title, workout.partial ? h('span', { class: 'tag partial' }, 'Ended early') : null),
          h('span', { class: 'list-meta' }, workout.exercises.map(exercise => exercise.name).slice(0, 4).join(' · ') + (workout.exercises.length > 4 ? ' …' : ''))),
        h('span', { class: 'list-meta tabular history-figures' }, `${workout.totalSets} sets · ${formatDuration(workout.activeSec)}${workout.volumeKg ? ` · ${formatVolume(workout.volumeKg, units)}` : ''}`))))))));
  };

  const records = () => {
    const bests = personalBests(store.history).sort((a, b) => a.name.localeCompare(b.name));
    if (!bests.length) return empty({ title: 'No records yet', text: 'Log a few sessions and your best lifts, reps and holds will appear here.', icon: 'trophy' });
    return h('table', { class: 'records-table' },
      h('caption', { class: 'sr-only' }, 'Personal bests'),
      h('thead', null, h('tr', null, h('th', { scope: 'col' }, 'Exercise'), h('th', { scope: 'col' }, 'Best'), h('th', { scope: 'col' }, 'Estimated max'), h('th', { scope: 'col' }, 'Date'))),
      h('tbody', null, bests.map(best => h('tr', null,
        h('th', { scope: 'row' }, h('a', { href: `#/library/${best.exerciseId}`, class: 'text-link' }, best.name)),
        h('td', { class: 'numeral' }, best.kind === 'load' ? `${formatLoad(best.loadKg, units)} × ${best.reps}` : best.kind === 'time' ? `${best.seconds}s hold` : `${best.reps} reps`),
        h('td', { class: 'muted' }, best.kind === 'load' ? `≈ ${formatLoad(best.value, units)}` : '—'),
        h('td', { class: 'muted' }, new Date(best.at).toLocaleDateString())))));
  };

  const draw = () => {
    replace(body, store.history.length
      ? (tab === 'overview' ? overview() : tab === 'workouts' ? workouts() : records())
      : empty({ title: 'Your story starts with one session', text: 'Complete a workout and Icarus will chart your consistency, volume and personal bests here.', icon: 'chart', action: linkButton("Go to today's session", '#/today', { variant: 'primary', iconAfter: 'arrow' }) }));
  };

  replace(el, h('div', { class: 'container' },
    h('header', { class: 'page-head' }, eyebrow('Progress'), h('h1', { class: 'display' }, 'Measured, ', h('em', null, 'not guessed.')),
      h('p', { class: 'lead' }, 'Everything here is calculated from sets you logged on this device.')),
    tabs({ label: 'Progress views', value: tab, items: [{ value: 'overview', label: 'Overview' }, { value: 'workouts', label: 'Workouts' }, { value: 'records', label: 'Records' }],
      onChange: value => { tab = value; history.replaceState(null, '', `#/progress?tab=${value}`); el.querySelectorAll('[role="tab"]').forEach(node => { const selected = node.textContent?.toLowerCase() === value; node.setAttribute('aria-selected', String(selected)); node.setAttribute('tabindex', selected ? '0' : '-1'); }); draw(); } }),
    h('div', { class: 'section-tight' }, body)));
  draw();
  return { el, title: 'Progress', surface: 'light', nav: 'progress' };
}
