import { s } from '../core/dom.js';

/** The Icarus mark: a sun with a single wing of five feathers crossing it. */
export function mark(title = 'Icarus'): SVGSVGElement {
  // Five feathers fan from the lower left toward the sun, each a little longer than the last.
  const feathers = [0, 1, 2, 3, 4].map(i => {
    const angle = (-78 + i * 13) * (Math.PI / 180);
    const len = 15 + i * 2.4;
    const x = 4 + Math.cos(angle) * len, y = 28 + Math.sin(angle) * len;
    const cx = 4 + Math.cos(angle + 0.32) * len * 0.55, cy = 28 + Math.sin(angle + 0.32) * len * 0.55;
    return s('path', { d: `M4 28 Q${cx.toFixed(1)} ${cy.toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)}`, fill: 'none', stroke: 'currentColor', 'stroke-width': 1.4, 'stroke-linecap': 'round' });
  });
  return s('svg', { viewBox: '0 0 32 32', role: 'img', 'aria-label': title },
    s('circle', { cx: 21, cy: 11, r: 6.5, fill: '#e2552b' }),
    s('circle', { cx: 21, cy: 11, r: 9.5, fill: 'none', stroke: 'currentColor', 'stroke-width': 0.8, opacity: 0.45 }),
    ...feathers);
}

