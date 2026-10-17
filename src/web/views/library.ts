import { AUDIENCE_INFO, safetyNote } from '../../shared/audience.js';
import { available, CATEGORIES, EQUIPMENT_LABEL, EXERCISES, exerciseById, instructionsFor, MUSCLE_LABEL, safetyFor, substitutes, suitableFor, type CategoryId } from '../../shared/fitness/exercises.js';
import { describeTarget, planExercise, prescribe } from '../../shared/fitness/programs.js';
import { EQUIPMENT, LEVELS, type Equipment, type Exercise, type Level } from '../../shared/fitness/types.js';
import { h, replace } from '../core/dom.js';
import type { View, ViewContext } from '../core/router.js';
import { store } from '../core/store.js';
import { button, eyebrow, linkButton, openDialog, toast } from '../ui/components.js';
import { icon } from '../ui/icons.js';
import { audienceSwitch, notice, saveButton } from '../ui/market-ui.js';
import { cardPhoto, demo, thumb } from '../ui/photo.js';
import { notFoundView } from './not-found.js';

const LEVEL = { beginner: 'Beginner', intermediate: 'Intermediate', advanced: 'Advanced' } as const;
const RANK: Record<Level, number> = { beginner: 0, intermediate: 1, advanced: 2 };
type Sort = 'name' | 'level' | 'muscle';

export function libraryView(context: ViewContext): View {
  const audience = store.audience();
  const params = context.query;
  const state = {
    q: params.get('q') ?? '',
    category: (CATEGORIES.some(item => item.id === params.get('category')) ? params.get('category') : 'all') as CategoryId | 'all',
    level: (LEVELS as readonly string[]).includes(params.get('level') ?? '') ? params.get('level') as Level : 'all' as Level | 'all',
    equipment: (EQUIPMENT as readonly string[]).includes(params.get('equipment') ?? '') ? params.get('equipment') as Equipment : 'all' as Equipment | 'all',
    mine: params.get('mine') === '1',
    saved: params.get('saved') === '1',
    everyone: params.get('everyone') === '1',
    sort: (['name', 'level', 'muscle'].includes(params.get('sort') ?? '') ? params.get('sort') : 'name') as Sort,
  };
  const grid = h('ul', { class: 'exercise-grid', role: 'list' });
  const count = h('p', { class: 'tag', role: 'status' });

  const sync = () => {
    const next = new URLSearchParams();
    if (state.q) next.set('q', state.q);
    if (state.category !== 'all') next.set('category', state.category);
    if (state.level !== 'all') next.set('level', state.level);
    if (state.equipment !== 'all') next.set('equipment', state.equipment);
    if (state.mine) next.set('mine', '1');
    if (state.saved) next.set('saved', '1');
    if (state.everyone) next.set('everyone', '1');
    if (state.sort !== 'name') next.set('sort', state.sort);
    history.replaceState(null, '', `#/library${next.toString() ? `?${next}` : ''}`);
  };

  const draw = () => {
    const q = state.q.trim().toLowerCase();
    const category = CATEGORIES.find(item => item.id === state.category);
    const list = EXERCISES.filter(exercise => (state.everyone || suitableFor(exercise, audience)) &&
      (!category || category.test(exercise)) &&
      (state.level === 'all' || exercise.level === state.level) &&
      (state.equipment === 'all' || (state.equipment === 'bodyweight' ? exercise.equipment.length === 0 : exercise.equipment.includes(state.equipment))) &&
      (!state.mine || available(exercise, store.profile?.equipment ?? ['bodyweight'])) &&
      (!state.saved || store.isSaved('exercises', exercise.id)) &&
      (!q || `${exercise.name} ${exercise.summary} ${exercise.primary.join(' ')} ${exercise.secondary.join(' ')}`.toLowerCase().includes(q)))
      .sort((a, b) => state.sort === 'level' ? RANK[a.level] - RANK[b.level] || a.name.localeCompare(b.name)
        : state.sort === 'muscle' ? MUSCLE_LABEL[a.primary[0]].localeCompare(MUSCLE_LABEL[b.primary[0]]) || a.name.localeCompare(b.name)
        : a.name.localeCompare(b.name));
    count.textContent = `${list.length} exercise${list.length === 1 ? '' : 's'}`;
    replace(grid, list.length ? list.map(card) : h('li', { class: 'library-empty' }, h('div', { class: 'empty' }, h('h3', { class: 'title' }, 'No exercises match'),
      h('p', { class: 'body' }, state.saved ? 'You have not saved any exercises with these filters.' : 'Clear the search or choose another category.'),
      button('Clear filters', () => { Object.assign(state, { q: '', category: 'all', level: 'all', equipment: 'all', mine: false, saved: false }); search.value = ''; sync(); drawChips(); draw(); }, { variant: 'ghost' }))));
    sync();
  };

  const card = (exercise: Exercise) => h('li', null, h('article', { class: 'exercise-card' },
    h('a', { href: `#/library/${exercise.id}`, class: 'exercise-card-link' }, cardPhoto(exercise.id),
      h('span', { class: 'exercise-card-body' }, h('span', { class: 'title' }, exercise.name),
        h('span', { class: 'tag' }, exercise.primary.map(item => MUSCLE_LABEL[item]).join(' · ')),
        h('span', { class: 'small muted' }, `${exercise.equipment.length ? exercise.equipment.map(item => EQUIPMENT_LABEL[item]).join(' + ') : 'Bodyweight'} · ${LEVEL[exercise.level]}`))),
    h('div', { class: 'exercise-card-save' }, saveButton('exercises', exercise.id, exercise.name, { compact: true }))));

  const chips = h('div', { class: 'row category-chips', role: 'group', 'aria-label': 'Category' });
  const drawChips = () => replace(chips, [{ id: 'all', label: 'All' }, ...CATEGORIES].map(item => h('button', { type: 'button', class: 'chip', 'aria-pressed': String(state.category === item.id), onclick: () => { state.category = item.id as CategoryId | 'all'; drawChips(); draw(); } }, item.label)));
  drawChips();

  const select = <T extends string>(label: string, value: T, options: [T, string][], set: (value: T) => void) => h('label', { class: 'field compact-field' }, h('span', { class: 'label' }, label),
    h('select', { class: 'input select', onchange: (event: Event) => { set((event.target as HTMLSelectElement).value as T); draw(); } }, options.map(([v, text]) => h('option', { value: v, selected: v === value }, text))));
  const search = h('input', { class: 'input', type: 'search', value: state.q, placeholder: 'Search by name, muscle or description', 'aria-label': 'Search exercises', oninput: (event: Event) => { state.q = (event.target as HTMLInputElement).value; draw(); } });
  const toggle = (label: string, value: boolean, set: (on: boolean) => void) => h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: value, onchange: (event: Event) => { set((event.target as HTMLInputElement).checked); draw(); } }), label);

  const el = h('div', { class: 'page surface-light library' }, h('div', { class: 'container' },
    h('header', { class: 'page-head' }, eyebrow('Exercise library'), h('h1', { class: 'display' }, 'Every movement, ', h('em', null, 'demonstrated.')),
      h('p', { class: 'lead' }, 'Real photographs of the start and finish of each exercise, step-by-step instructions, sets and reps to start with, and the mistakes to avoid.'),
      h('div', { class: 'row' }, audienceSwitch())),
    h('div', { class: 'library-tools' }, h('div', { class: 'search-field' }, icon('search'), search),
      select('Difficulty', state.level, [['all', 'Any level'], ...LEVELS.map(level => [level, LEVEL[level]] as [Level, string])], value => { state.level = value; }),
      select('Equipment', state.equipment, [['all', 'Any equipment'], ...EQUIPMENT.map(item => [item, EQUIPMENT_LABEL[item]] as [Equipment, string])], value => { state.equipment = value; }),
      select('Sort', state.sort, [['name', 'Name A–Z'], ['level', 'Easiest first'], ['muscle', 'Muscle group']], value => { state.sort = value; })),
    h('div', { class: 'row library-toggles' },
      toggle(`Only suitable for ${AUDIENCE_INFO[audience].label.toLowerCase()}`, !state.everyone, on => { state.everyone = !on; }),
      store.profile ? toggle('Only equipment I have', state.mine, on => { state.mine = on; }) : null,
      toggle('Saved only', state.saved, on => { state.saved = on; })),
    chips, count, grid,
    h('p', { class: 'small muted library-credit' }, 'Photographs and step-by-step instructions: Free Exercise DB (github.com/yuhonas/free-exercise-db), released into the public domain.')));
  draw();
  return { el, title: 'Exercise library', surface: 'light', nav: 'library' };
}

export function exerciseView(context: ViewContext): View {
  const exercise = exerciseById(context.params.id);
  if (!exercise) return notFoundView();
  const audience = store.audience();
  const profile = store.profile;
  const level = profile?.level ?? exercise.level;
  const goal = profile?.goal ?? 'general';
  const dose = prescribe(exercise, exercise.compound ? 'main' : 'accessory', level, goal, audience);
  const steps = instructionsFor(exercise);
  const swaps = substitutes(exercise.id, profile?.equipment ?? EQUIPMENT, profile?.level ?? 'advanced', audience).slice(0, 4);
  const easier = exercise.easier ? exerciseById(exercise.easier) : undefined;
  const harder = exercise.harder ? exerciseById(exercise.harder) : undefined;
  const suitable = suitableFor(exercise, audience);

  const addToPlan = () => {
    if (!profile) { toast('Set up training first to get a plan.', { action: { label: 'Set up', run: () => context.navigate('#/onboarding') } }); return; }
    const plans = store.plans;
    if (!plans.length) { toast('Create a plan first.', { action: { label: 'Plans', run: () => context.navigate('#/plans') } }); return; }
    const close = openDialog({ title: `Add ${exercise.name}`, eyebrow: 'Choose a session', surface: 'light', body: h('div', { class: 'stack', style: { '--stack': '20px' } }, plans.map(plan => h('section', null,
      h('h3', { class: 'eyebrow muted' }, plan.name),
      h('ul', { class: 'list', role: 'list' }, plan.days.map((day, index) => h('li', null, h('button', { type: 'button', class: 'list-row', onclick: () => {
        const next = structuredClone(plan);
        next.days[index].exercises.push(planExercise(exercise, prescribe(exercise, exercise.compound ? 'main' : 'accessory', plan.level, plan.goal, audience)));
        try { store.upsertPlan(next); toast(`Added to ${day.name}.`, { action: { label: 'Open', run: () => context.navigate(`#/plans/${plan.id}?day=${index}`) } }); }
        catch (error) { toast(error instanceof Error ? error.message : 'Could not add it.', { kind: 'error' }); }
        close();
      } }, h('span', { class: 'numeral day-index' }, String(index + 1).padStart(2, '0')), h('span', { class: 'list-title' }, day.name), icon('plus')))))))) });
  };

  const variation = (label: string, item: Exercise | undefined) => item ? h('a', { class: 'list-row exercise-row', href: `#/library/${item.id}` }, thumb(item.id),
    h('span', { class: 'stack', style: { '--stack': '2px' } }, h('span', { class: 'tag' }, label), h('span', { class: 'list-title' }, item.name)), icon('arrow')) : null;

  const el = h('div', { class: 'page surface-light exercise-detail' }, h('div', { class: 'container' },
    h('a', { class: 'text-link small back-link detail-back', href: '#/library' }, icon('arrow-left'), 'Library'),
    h('div', { class: 'detail-grid' },
      h('div', { class: 'detail-media' }, demo(exercise.id)),
      h('div', { class: 'stack', style: { '--stack': '28px' } },
        eyebrow(`${LEVEL[exercise.level]} · ${exercise.kind === 'time' ? 'Timed' : 'Reps'}`),
        h('h1', { class: 'display' }, exercise.name),
        h('p', { class: 'lead' }, exercise.summary),
        !suitable ? notice(`This exercise is not part of the programmes for ${AUDIENCE_INFO[audience].label.toLowerCase()}. It is shown for reference.`, 'warn') : null,
        h('dl', { class: 'review-list' },
          h('div', null, h('dt', null, 'Primary muscles'), h('dd', null, exercise.primary.map(item => MUSCLE_LABEL[item]).join(', '))),
          exercise.secondary.length ? h('div', null, h('dt', null, 'Also works'), h('dd', null, exercise.secondary.map(item => MUSCLE_LABEL[item]).join(', '))) : null,
          h('div', null, h('dt', null, 'Equipment'), h('dd', null, exercise.equipment.length ? exercise.equipment.map(item => EQUIPMENT_LABEL[item]).join(', ') : 'None')),
          h('div', null, h('dt', null, 'Difficulty'), h('dd', null, LEVEL[exercise.level])),
          h('div', null, h('dt', null, 'Suggested start'), h('dd', null, `${describeTarget(dose)}, rest ${dose.restSec} s`))),
        h('p', { class: 'small muted' }, profile ? `Starting point for your ${level} level and ${goal} goal. Adjust it in your plan.` : `General starting point for ${AUDIENCE_INFO[audience].label.toLowerCase()}. Set up training for a personal one.`),
        h('div', { class: 'row' },
          button('Add to plan', addToPlan, { variant: 'primary', icon: 'plus' }),
          saveButton('exercises', exercise.id, exercise.name),
          profile ? linkButton('Ask the coach', `#/coach?ask=${encodeURIComponent(`How do I do ${exercise.name} well?`)}`, { variant: 'ghost', icon: 'coach' }) : null),
        steps.length ? h('section', { class: 'stack', 'aria-labelledby': 'steps-title' }, h('h2', { class: 'eyebrow', id: 'steps-title' }, 'Step by step'),
          h('ol', { class: 'cue-list', role: 'list' }, steps.map((step, index) => h('li', null, h('span', { class: 'numeral' }, String(index + 1)), step))),
          exercise.photoNote ? h('p', { class: 'small muted' }, exercise.photoNote) : null) : null,
        h('section', { class: 'stack', 'aria-labelledby': 'cues-title' }, h('h2', { class: 'eyebrow', id: 'cues-title' }, 'Coaching cues'),
          h('ul', { class: 'feature-list', role: 'list' }, exercise.cues.map(cue => h('li', null, icon('check'), cue)))),
        h('section', { class: 'stack', 'aria-labelledby': 'mistakes-title' }, h('h2', { class: 'eyebrow', id: 'mistakes-title' }, 'Common mistakes'),
          h('ul', { class: 'mistake-list', role: 'list' }, exercise.mistakes.map(item => h('li', null, icon('close'), item)))),
        easier || harder ? h('section', { class: 'stack', 'aria-labelledby': 'var-title' }, h('h2', { class: 'eyebrow', id: 'var-title' }, 'Variations'), h('div', { class: 'list' }, variation('Easier', easier), variation('Harder', harder))) : null,
        h('section', { class: 'stack', 'aria-labelledby': 'safety-title' }, h('h2', { class: 'eyebrow', id: 'safety-title' }, 'Safety'), notice([safetyFor(exercise), ' ', safetyNote(audience)], 'safety')),
        swaps.length ? h('section', { class: 'stack', 'aria-labelledby': 'swaps-title' }, h('h2', { class: 'eyebrow', id: 'swaps-title' }, profile ? 'Alternatives with your equipment' : 'Alternatives'),
          h('ul', { class: 'list', role: 'list' }, swaps.map(item => h('li', null, h('a', { class: 'list-row exercise-row', href: `#/library/${item.id}` }, thumb(item.id), h('span', { class: 'list-title' }, item.name), icon('arrow')))))) : null))));
  return { el, title: exercise.name, surface: 'light', nav: 'library' };
}
