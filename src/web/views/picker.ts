import { available, EXERCISES, exerciseById, MUSCLE_LABEL, substitutes } from '../../shared/fitness/exercises.js';
import { MUSCLES, type Exercise, type Muscle } from '../../shared/fitness/types.js';
import { h, replace } from '../core/dom.js';
import { store } from '../core/store.js';
import { openDialog } from '../ui/components.js';
import { thumb } from '../ui/photo.js';
import { icon } from '../ui/icons.js';

/** Exercise chooser used to add or replace exercises. Resolves with the chosen exercise, or null. */
export function pickExercise(options: { title: string; replacing?: string }): Promise<Exercise | null> {
  return new Promise(resolve => {
    let chosen: Exercise | null = null;
    let query = '';
    let muscle: Muscle | 'all' = 'all';
    let mine = true;
    const equipment = store.profile?.equipment ?? ['bodyweight'];
    const results = h('ul', { class: 'list picker-results', role: 'list', 'aria-live': 'polite' });
    const suggestions = options.replacing ? substitutes(options.replacing, equipment, 'advanced', store.audience()).slice(0, 4) : [];

    const row = (exercise: Exercise, close: () => void) => h('li', null, h('button', { type: 'button', class: 'list-row exercise-row', onclick: () => { chosen = exercise; close(); } },
      thumb(exercise.id),
      h('span', { class: 'stack', style: { '--stack': '2px' } }, h('span', { class: 'list-title' }, exercise.name), h('span', { class: 'list-meta' }, `${exercise.primary.map(item => MUSCLE_LABEL[item]).join(' · ')} · ${exercise.equipment.length ? exercise.equipment.join(', ') : 'bodyweight'}`)),
      icon('plus')));

    let closeRef: () => void = () => {};
    const draw = () => {
      const q = query.trim().toLowerCase();
      const list = EXERCISES.filter(exercise => exercise.id !== options.replacing && (!mine || available(exercise, equipment)) && (muscle === 'all' || exercise.primary.includes(muscle) || exercise.secondary.includes(muscle)) &&
        (!q || exercise.name.toLowerCase().includes(q) || exercise.primary.some(item => item.includes(q))));
      replace(results, list.length ? list.map(exercise => row(exercise, closeRef)) : h('li', { class: 'muted small picker-empty' }, 'No exercises match. Try another search or include all equipment.'));
    };

    const search = h('input', { class: 'input', type: 'search', placeholder: 'Search exercises', 'aria-label': 'Search exercises', oninput: (event: Event) => { query = (event.target as HTMLInputElement).value; draw(); } });
    const filters = h('div', { class: 'row picker-filters', role: 'group', 'aria-label': 'Filter by muscle' }, (['all', ...MUSCLES] as (Muscle | 'all')[]).map(item => h('button', {
      type: 'button', class: 'chip', 'aria-pressed': String(item === muscle),
      onclick: (event: Event) => { muscle = item; filters.querySelectorAll('.chip').forEach(chip => chip.setAttribute('aria-pressed', String(chip === event.currentTarget))); draw(); },
    }, item === 'all' ? 'All' : MUSCLE_LABEL[item])));
    const mineToggle = h('label', { class: 'row small picker-mine' }, h('input', { type: 'checkbox', checked: true, onchange: (event: Event) => { mine = (event.target as HTMLInputElement).checked; draw(); } }), 'Only equipment I have');

    const body = h('div', { class: 'stack picker', style: { '--stack': '16px' } },
      suggestions.length ? h('div', { class: 'stack', style: { '--stack': '8px' } }, h('p', { class: 'eyebrow' }, `Closest swaps for ${exerciseById(options.replacing!)?.name}`), h('ul', { class: 'list', role: 'list' }, suggestions.map(exercise => row(exercise, () => closeRef())))) : null,
      search, filters, mineToggle, results);
    closeRef = openDialog({ title: options.title, body, wide: true, surface: 'light', onClose: () => resolve(chosen) });
    draw();
    search.focus();
  });
}
