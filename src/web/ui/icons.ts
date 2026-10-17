import { s } from '../core/dom.js';

// A small line-icon set drawn for Icarus: 24px grid, 1.5px strokes, square-ish terminals.
const PATHS: Record<string, string[]> = {
  arrow: ['M4 12h15', 'M13 6l6 6-6 6'],
  'arrow-left': ['M20 12H5', 'M11 6l-6 6 6 6'],
  down: ['M12 4v15', 'M6 13l6 6 6-6'],
  plus: ['M12 5v14', 'M5 12h14'],
  minus: ['M5 12h14'],
  check: ['M4.5 12.5l4.5 4.5L19.5 6.5'],
  close: ['M6 6l12 12', 'M18 6L6 18'],
  play: ['M8 5.5v13l10.5-6.5z'],
  pause: ['M8.5 5.5v13', 'M15.5 5.5v13'],
  skip: ['M6 5.5v13l9-6.5z', 'M18 5.5v13'],
  chevron: ['M9 5l7 7-7 7'],
  'chevron-left': ['M15 5l-7 7 7 7'],
  up: ['M6 15l6-6 6 6'],
  'down-small': ['M6 9l6 6 6-6'],
  swap: ['M5 8h12', 'M14 4l4 4-4 4', 'M19 16H7', 'M10 12l-4 4 4 4'],
  trash: ['M4.5 6.5h15', 'M9.5 6.5V4h5v2.5', 'M6.5 6.5l1 13.5h9l1-13.5', 'M10.5 10.5v6', 'M13.5 10.5v6'],
  clock: ['M12 3.5a8.5 8.5 0 1 0 0 17a8.5 8.5 0 1 0 0-17', 'M12 7.5V12l3 2'],
  flame: ['M12 21c-3.6 0-6-2.4-6-5.6 0-3.5 3-5.1 3.6-8.4C11.7 8.4 12.5 10 12.5 11.6 13.6 10.8 14 9.5 13.9 8c2.6 1.7 4.1 4.6 4.1 7.4 0 3.2-2.4 5.6-6 5.6z'],
  trophy: ['M7.5 4.5h9v4a4.5 4.5 0 0 1-9 0z', 'M7.5 6H4.5a3 3 0 0 0 3 3.5', 'M16.5 6h3a3 3 0 0 1-3 3.5', 'M12 13v4', 'M8.5 20.5h7', 'M9.5 17h5v3.5h-5z'],
  calendar: ['M4.5 6h15v14h-15z', 'M4.5 10h15', 'M8.5 3.5V7', 'M15.5 3.5V7'],
  today: ['M4.5 6h15v14h-15z', 'M4.5 10h15', 'M8.5 3.5V7', 'M15.5 3.5V7', 'M10 15h4'],
  plans: ['M5 4.5h14v15H5z', 'M8.5 9h7', 'M8.5 12.5h7', 'M8.5 16h4'],
  coach: ['M4.5 5.5h15v10h-8l-4.5 3.5v-3.5h-2.5z', 'M8.5 10.5h.01', 'M12 10.5h.01', 'M15.5 10.5h.01'],
  chart: ['M4.5 19.5h15', 'M7 16v-5', 'M11 16V7', 'M15 16v-7', 'M19 16v-3'],
  settings: ['M12 9a3 3 0 1 0 0 6a3 3 0 1 0 0-6', 'M19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.4-2.3.9a7 7 0 0 0-2.1-1.2L14 3.5h-4l-.4 2.1a7 7 0 0 0-2.1 1.2l-2.3-.9-2 3.4 2 1.5a7 7 0 0 0 0 2.4l-2 1.5 2 3.4 2.3-.9a7 7 0 0 0 2.1 1.2l.4 2.1h4l.4-2.1a7 7 0 0 0 2.1-1.2l2.3.9 2-3.4-2-1.5c.07-.4.1-.8.1-1.2z'],
  library: ['M5 4.5h3.5v15H5z', 'M10.5 4.5H14v15h-3.5z', 'M15.5 5.5l3.2-.8 3 14.5-3.2.8z'],
  dumbbell: ['M3.5 9.5v5', 'M6 7.5v9', 'M18 7.5v9', 'M20.5 9.5v5', 'M6 12h12'],
  info: ['M12 3.5a8.5 8.5 0 1 0 0 17a8.5 8.5 0 1 0 0-17', 'M12 11v5', 'M12 8h.01'],
  alert: ['M12 4l9 16H3z', 'M12 10v4.5', 'M12 17.5h.01'],
  grip: ['M9 6h.01', 'M15 6h.01', 'M9 12h.01', 'M15 12h.01', 'M9 18h.01', 'M15 18h.01'],
  edit: ['M4.5 19.5l1-4L15 6l3 3-9.5 9.5z', 'M13 8l3 3'],
  sparkle: ['M12 3.5l1.8 5.2 5.2 1.8-5.2 1.8L12 17.5l-1.8-5.2L5 10.5l5.2-1.8z'],
  send: ['M4 12l16-7.5-6 16-2.5-6.5z', 'M11.5 14L20 4.5'],
  stop: ['M7 7h10v10H7z'],
  download: ['M12 4v11', 'M7 10.5l5 5 5-5', 'M5 19.5h14'],
  upload: ['M12 15.5V4.5', 'M7 9l5-5 5 5', 'M5 19.5h14'],
  user: ['M12 4a4 4 0 1 0 0 8a4 4 0 1 0 0-8', 'M4.5 20.5c1-3.8 4-5.5 7.5-5.5s6.5 1.7 7.5 5.5'],
  search: ['M10.5 4a6.5 6.5 0 1 0 0 13a6.5 6.5 0 1 0 0-13', 'M15.5 15.5l4.5 4.5'],
  volume: ['M4.5 9.5h3.5l4.5-4v13l-4.5-4H4.5z', 'M16 9a4 4 0 0 1 0 6', 'M18.5 6.5a7.5 7.5 0 0 1 0 11'],
  moon: ['M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10z'],
  rest: ['M4.5 17.5h15', 'M6 17.5v-5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v5', 'M7.5 10.5V7.5h4v3'],
  external: ['M14 4.5h5.5V10', 'M19.5 4.5L11 13', 'M17 14v5.5H4.5V7H10'],
  shield: ['M12 3.5l7.5 3v5.5c0 4.5-3.2 7.6-7.5 8.5-4.3-.9-7.5-4-7.5-8.5V6.5z', 'M9 12l2.2 2.2L15.5 10'],
};

export type IconName = keyof typeof PATHS;

export function icon(name: string, className = ''): SVGSVGElement {
  const paths = PATHS[name] ?? PATHS.info;
  const filled = name === 'play' || name === 'skip';
  return s('svg', { viewBox: '0 0 24 24', 'aria-hidden': 'true', focusable: 'false', class: `icon ${className}`.trim(), fill: 'none', stroke: 'currentColor', 'stroke-width': '1.5', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' },
    paths.map((d, index) => s('path', { d, fill: filled && index === 0 ? 'currentColor' : 'none' })));
}
