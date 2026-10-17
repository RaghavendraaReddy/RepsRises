import { s } from '../core/dom.js';
import { figureFor } from './figure.js';

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

/** The arrival composition: sun disc, orbit rings, a fan of feather lines and a figure mid-stride. */
export function heroArt(): HTMLElement {
  const feathers = Array.from({ length: 22 }, (_, i) => {
    const angle = (-172 + i * 6.2) * (Math.PI / 180);
    const len = 230 + i * 9 + (i % 3) * 14;
    const x = 300 + Math.cos(angle) * len, y = 560 + Math.sin(angle) * len;
    const cx = 300 + Math.cos(angle + 0.18) * len * 0.55, cy = 560 + Math.sin(angle + 0.18) * len * 0.55;
    return s('path', { d: `M300 560 Q${cx.toFixed(0)} ${cy.toFixed(0)} ${x.toFixed(0)} ${y.toFixed(0)}`, class: 'hero-feather', style: { '--i': String(i), '--len': '900' } });
  });
  const svg = s('svg', { viewBox: '0 0 800 760', 'aria-hidden': 'true', class: 'hero-svg', preserveAspectRatio: 'xMidYMid slice' },
    s('g', { class: 'hero-rings' }, [140, 196, 262, 340].map((r, i) => s('circle', { cx: 520, cy: 300, r, class: 'hero-ring', style: { '--i': String(i) } }))),
    s('circle', { cx: 520, cy: 300, r: 118, class: 'hero-sun' }),
    s('g', { class: 'hero-wing' }, feathers),
  );
  const figureEl = figureFor('lunge', [], 'hero', { title: 'Athlete in a lunge', ground: false, strokeScale: 0.9 });
  figureEl.classList.add('hero-figure');
  const wrap = document.createElement('div');
  wrap.className = 'hero-art';
  wrap.append(svg, figureEl);
  return wrap;
}
