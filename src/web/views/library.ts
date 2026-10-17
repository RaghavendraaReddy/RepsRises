import { available, EQUIPMENT_LABEL, EXERCISES, exerciseById, MUSCLE_LABEL, substitutes } from '../../shared/fitness/exercises.js';
import { planExercise, prescribe } from '../../shared/fitness/programs.js';
import { MUSCLES, type Muscle } from '../../shared/fitness/types.js';
import { h, replace } from '../core/dom.js';
import type { View, ViewContext } from '../core/router.js';
import { store } from '../core/store.js';
import { button, eyebrow, linkButton, openDialog, toast } from '../ui/components.js';
import { figure } from '../ui/figure.js';
import { icon } from '../ui/icons.js';
import { notFoundView } from './not-found.js';

const LEVEL = { beginner: 'Beginner', intermediate: 'Intermediate', advanced: 'Advanced' } as const;

export function libraryView(context: ViewContext): View {
  let query = context.query.get('q') ?? '';
  let muscle: Muscle | 'all' = (MUSCLES as readonly string[]).includes(context.query.get('muscle') ?? '') ? context.query.get('muscle') as Muscle : 'all';
  let mine = Boolean(store.profile);
  const grid = h('ul', { class: 'library-grid', role: 'list' });
  const count = h('p', { class: 'tag', role: 'status' });

  const draw = () => {
    const q = query.trim().toLowerCase();
    const list = EXERCISES.filter(exercise => (!mine || available(exercise, store.profile?.equipment ?? ['bodyweight'])) &&
      (muscle === 'all' || exercise.primary.includes(muscle) || exercise.secondary.includes(muscle)) &&
      (!q || exercise.name.toLowerCase().includes(q) || exercise.summary.toLowerCase().includes(q)));
    count.textContent = `${list.length} exercise${list.length === 1 ? '' : 's'}`;
    replace(grid, list.length ? list.map(exercise => h('li', null, h('a', { class: 'library-card', href: `#/library/${exercise.id}` },
      h('span', { class: 'library-figure', 'aria-hidden': 'true' }, figure(exercise.id, { animate: false })),
      h('span', { class: 'stack', style: { '--stack': '6px' } },
        h('span', { class: 'title' }, exercise.name),
        h('span', { class: 'list-meta' }, exercise.primary.map(item => MUSCLE_LABEL[item]).join(' · ')),
        h('span', { class: 'tag' }, exercise.equipment.length ? exercise.equipment.map(item => EQUIPMENT_LABEL[item]).join(' + ') : 'Bodyweight', ' · ', LEVEL[exercise.level])))))
      : h('li', { class: 'library-empty muted' }, 'No exercises match. Clear the search or include all equipment.'));
  };

  const filters = h('div', { class: 'row library-muscles', role: 'group', 'aria-label': 'Filter by muscle' }, (['all', ...MUSCLES] as (Muscle | 'all')[]).map(item => h('button', {
    type: 'button', class: 'chip', 'aria-pressed': String(item === muscle),
    onclick: (event: Event) => { muscle = item; filters.querySelectorAll('.chip').forEach(chip => chip.setAttribute('aria-pressed', String(chip === event.currentTarget))); draw(); },
  }, item === 'all' ? 'All' : MUSCLE_LABEL[item])));

  const el = h('div', { class: 'page surface-light library' }, h('div', { class: 'container' },
    h('header', { class: 'page-head' }, eyebrow('Library'), h('h1', { class: 'display' }, 'Every movement, ', h('em', null, 'explained.')),
      h('p', { class: 'lead' }, 'Demonstrations, technique cues and common mistakes for every exercise Icarus programmes.')),
    h('div', { class: 'library-tools' },
      h('input', { class: 'input', type: 'search', value: query, placeholder: 'Search by name or description', 'aria-label': 'Search exercises', oninput: (event: Event) => { query = (event.target as HTMLInputElement).value; draw(); } }),
      store.profile ? h('label', { class: 'row small picker-mine' }, h('input', { type: 'checkbox', checked: mine, onchange: (event: Event) => { mine = (event.target as HTMLInputElement).checked; draw(); } }), 'Only equipment I have') : null),
    filters, count, grid));
  draw();
  return { el, title: 'Exercise library', surface: 'light', nav: 'library' };
}

export function exerciseView(context: ViewContext): View {
  const exercise = exerciseById(context.params.id);
  if (!exercise) return notFoundView();
  const profile = store.profile;
  const swaps = substitutes(exercise.id, profile?.equipment ?? ['bodyweight', 'dumbbells', 'barbell', 'kettlebell', 'bench', 'pullup-bar', 'bands', 'cable', 'machines'], profile?.level ?? 'advanced').slice(0, 4);

  const addToPlan = () => {
    const plans = store.plans;
    if (!plans.length) { toast('Create a plan first.', { action: { label: 'Plans', run: () => context.navigate('#/plans') } }); return; }
    const close = openDialog({ title: `Add ${exercise.name}`, eyebrow: 'Choose a session', surface: 'light', body: h('div', { class: 'stack', style: { '--stack': '20px' } }, plans.map(plan => h('section', null,
      h('h3', { class: 'eyebrow muted' }, plan.name),
      h('ul', { class: 'list', role: 'list' }, plan.days.map((day, index) => h('li', null, h('button', { type: 'button', class: 'list-row', onclick: () => {
        const next = structuredClone(plan);
        next.days[index].exercises.push(planExercise(exercise, prescribe(exercise, exercise.compound ? 'main' : 'accessory', plan.level, plan.goal)));
        try { store.upsertPlan(next); toast(`Added to ${day.name}.`, { action: { label: 'Open', run: () => context.navigate(`#/plans/${plan.id}?day=${index}`) } }); }
        catch (error) { toast(error instanceof Error ? error.message : 'Could not add it.', { kind: 'error' }); }
        close();
      } }, h('span', { class: 'numeral day-index' }, String(index + 1).padStart(2, '0')), h('span', { class: 'list-title' }, day.name), icon('plus')))))))) });
  };

  const el = h('div', { class: 'page surface-light exercise-detail' }, h('div', { class: 'container' },
    h('a', { class: 'text-link small back-link detail-back', href: '#/library' }, icon('arrow-left'), 'Library'),
    h('div', { class: 'detail-grid' },
      h('div', { class: 'detail-figure surface-dark' }, figure(exercise.id, { title: `${exercise.name} demonstration` }), h('p', { class: 'tag detail-caption' }, 'Demonstration · side view')),
      h('div', { class: 'stack', style: { '--stack': '24px' } },
        eyebrow(`${LEVEL[exercise.level]} · ${exercise.kind === 'time' ? 'Timed' : 'Reps'}`),
        h('h1', { class: 'display' }, exercise.name),
        h('p', { class: 'lead' }, exercise.summary),
        h('dl', { class: 'review-list' },
          h('div', null, h('dt', null, 'Primary'), h('dd', null, exercise.primary.map(item => MUSCLE_LABEL[item]).join(', '))),
          exercise.secondary.length ? h('div', null, h('dt', null, 'Also works'), h('dd', null, exercise.secondary.map(item => MUSCLE_LABEL[item]).join(', '))) : null,
          h('div', null, h('dt', null, 'Equipment'), h('dd', null, exercise.equipment.length ? exercise.equipment.map(item => EQUIPMENT_LABEL[item]).join(', ') : 'None'))),
        h('section', { class: 'stack', 'aria-labelledby': 'cues-title' }, h('h2', { class: 'eyebrow', id: 'cues-title' }, 'Technique cues'),
          h('ol', { class: 'cue-list', role: 'list' }, exercise.cues.map((cue, index) => h('li', null, h('span', { class: 'numeral' }, String(index + 1)), cue)))),
        h('section', { class: 'stack', 'aria-labelledby': 'mistakes-title' }, h('h2', { class: 'eyebrow', id: 'mistakes-title' }, 'Common mistakes'),
          h('ul', { class: 'mistake-list', role: 'list' }, exercise.mistakes.map(item => h('li', null, icon('close'), item)))),
        profile ? h('div', { class: 'row' },
          button('Add to a plan', addToPlan, { variant: 'primary', icon: 'plus' }),
          linkButton('Ask the coach', `#/coach?ask=${encodeURIComponent(`How do I do ${exercise.name} well?`)}`, { variant: 'ghost', icon: 'coach' })) : null,
        swaps.length ? h('section', { class: 'stack', 'aria-labelledby': 'swaps-title' }, h('h2', { class: 'eyebrow', id: 'swaps-title' }, profile ? 'Alternatives with your equipment' : 'Alternatives'),
          h('ul', { class: 'list', role: 'list' }, swaps.map(item => h('li', null, h('a', { class: 'list-row exercise-row', href: `#/library/${item.id}` },
            h('span', { class: 'thumb', 'aria-hidden': 'true' }, figure(item.id, { animate: false, ground: false })), h('span', { class: 'list-title' }, item.name), icon('arrow')))))) : null,
        h('p', { class: 'small muted' }, 'General guidance for healthy adults. Stop if you feel pain, and get in-person coaching for heavy or complex lifts.')))));
  return { el, title: exercise.name, surface: 'light', nav: 'library' };
}
