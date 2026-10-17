import { h } from '../core/dom.js';
import type { View } from '../core/router.js';
import { store } from '../core/store.js';
import { eyebrow, linkButton } from '../ui/components.js';

export function notFoundView(): View {
  const el = h('section', { class: 'page surface-dark' }, h('div', { class: 'container section stack', style: { '--stack': '24px' } },
    eyebrow('Off course'),
    h('h1', { class: 'display' }, 'This page ', h('em', null, 'does not exist.')),
    h('p', { class: 'lead' }, 'The link may be out of date. Your plans and history are safe.'),
    linkButton(store.profile ? 'Back to today' : 'Back to the start', store.profile ? '#/today' : '#/welcome', { variant: 'primary', iconAfter: 'arrow' })));
  return { el, title: 'Not found', surface: 'dark' };
}
