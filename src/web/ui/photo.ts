import { exerciseById, photoFor } from '../../shared/fitness/exercises.js';
import { h, prefersReducedMotion } from '../core/dom.js';

// Exercise demonstrations use real photographs from Free Exercise DB (public domain): a start and a
// finish frame for every movement. See docs/ASSETS.md for provenance.

/** Small square photo for lists. Decorative: the row's text names the exercise. */
export function thumb(id: string) {
  const src = photoFor(id, 0);
  return h('span', { class: 'thumb', 'aria-hidden': 'true' }, src ? h('img', { src, alt: '', loading: 'lazy', decoding: 'async', width: 56, height: 56 }) : null);
}

/** Landscape card photo (start position). */
export function cardPhoto(id: string, alt = '') {
  const src = photoFor(id, 0);
  return h('span', { class: 'card-photo' }, src ? h('img', { src, alt, loading: 'lazy', decoding: 'async', width: 450, height: 300 }) : null);
}

type DemoOptions = { title?: string; controls?: boolean; caption?: boolean };

/**
 * Two-frame demonstration. It alternates start and finish positions; people who prefer reduced motion
 * see the start frame and can step between frames themselves. Moving content can always be paused.
 */
export function demo(id: string, options: DemoOptions = {}) {
  const exercise = exerciseById(id);
  if (!exercise) return h('div', { class: 'demo demo-missing' }, h('p', { class: 'small muted' }, 'No demonstration available.'));
  const name = options.title ?? exercise.name;
  const frame = (index: 0 | 1) => h('img', { class: `demo-frame f${index}`, src: photoFor(exercise, index), alt: `${name}: ${index ? 'finish' : 'start'} position`, decoding: 'async', loading: 'lazy', width: 900, height: 600 });
  const root = h('figure', { class: 'demo', dataset: { frame: prefersReducedMotion() ? '0' : 'auto' } }, h('div', { class: 'demo-stage' }, frame(0), frame(1)));
  const set = (mode: string) => {
    root.dataset.frame = mode;
    root.querySelectorAll('.demo-controls button').forEach(button => button.setAttribute('aria-pressed', String((button as HTMLElement).dataset.mode === mode)));
  };
  if (options.controls !== false) {
    root.append(h('div', { class: 'demo-controls', role: 'group', 'aria-label': `${name} demonstration` },
      ([['auto', 'Play'], ['0', 'Start'], ['1', 'Finish']] as const).map(([mode, label]) => h('button', { type: 'button', class: 'chip small', dataset: { mode }, 'aria-pressed': String(root.dataset.frame === mode), onclick: () => set(mode) }, label))));
  }
  if (options.caption !== false) {
    root.append(h('figcaption', { class: 'demo-caption' }, exercise.photoNote ? `${exercise.photoNote.replace(/\.$/, '')}. ` : '', 'Photo: Free Exercise DB, public domain.'));
  }
  return root;
}
