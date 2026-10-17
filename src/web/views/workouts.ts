import { AUDIENCE_INFO, safetyNote } from '../../shared/audience.js';
import { EXERCISES, suitableFor } from '../../shared/fitness/exercises.js';
import { splitsFor } from '../../shared/fitness/programs.js';
import { h } from '../core/dom.js';
import type { View } from '../core/router.js';
import { store } from '../core/store.js';
import { eyebrow, linkButton } from '../ui/components.js';
import { audienceSwitch, notice, sectionHead } from '../ui/market-ui.js';
import { cardPhoto } from '../ui/photo.js';

/** Entry to training. People with a training profile go straight to today's session. */
export function workoutsView(): View | string {
  if (store.profile) return '#/today';
  const audience = store.audience();
  const splits = splitsFor(audience);
  const sample = EXERCISES.filter(item => suitableFor(item, audience)).slice(0, 3);
  const el = h('div', { class: 'page surface-light workouts' }, h('div', { class: 'container stack', style: { '--stack': '48px' } },
    h('header', { class: 'page-head' }, eyebrow('Workouts'), h('h1', { class: 'display' }, 'Train with ', h('em', null, 'a plan.')),
      h('p', { class: 'lead' }, 'Answer five short questions and Icarus builds a weekly programme around your goal, equipment and schedule. Every set is logged, every rest is timed, and your history stays on this device.'),
      h('div', { class: 'row' }, linkButton('Set up my training', '#/onboarding', { variant: 'primary', iconAfter: 'arrow' }), audienceSwitch())),
    notice(safetyNote(audience), 'safety'),
    h('section', { class: 'stack' }, sectionHead({ eyebrow: 'Programmes', title: `For ${AUDIENCE_INFO[audience].label.toLowerCase()}` }),
      h('ol', { class: 'program-list', role: 'list' }, splits.map((split, index) => h('li', null, h('span', { class: 'numeral' }, String(index + 1).padStart(2, '0')),
        h('div', { class: 'stack', style: { '--stack': '4px' } }, h('p', { class: 'title' }, split.name), h('p', { class: 'small muted' }, split.summary)), h('span', { class: 'tag' }, `${split.days} days a week`))))),
    h('section', { class: 'stack' }, sectionHead({ eyebrow: 'Demonstrated', title: 'See each movement first', action: linkButton('Exercise library', '#/library', { variant: 'ghost', iconAfter: 'arrow' }) }),
      h('ul', { class: 'exercise-grid', role: 'list' }, sample.map(item => h('li', null, h('a', { class: 'exercise-card', href: `#/library/${item.id}` }, cardPhoto(item.id), h('span', { class: 'exercise-card-body' }, h('span', { class: 'title' }, item.name)))))))));
  return { el, title: 'Workouts', surface: 'light', nav: 'workouts' };
}
