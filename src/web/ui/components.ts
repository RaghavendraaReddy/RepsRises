import { h, nextId, s, type Attrs, type Child } from '../core/dom.js';
import { icon } from './icons.js';

type BtnOptions = { variant?: 'primary' | 'signal' | 'ghost' | 'danger' | ''; size?: 'small' | ''; icon?: string; iconAfter?: string; block?: boolean; attrs?: Attrs; label?: string };

export function button(text: Child, onClick: ((event: MouseEvent) => void) | null, options: BtnOptions = {}) {
  const className = ['btn', options.variant, options.size, options.block ? 'block' : '', !text ? 'icon' : ''].filter(Boolean).join(' ');
  return h('button', { type: 'button', class: className, onclick: onClick ?? undefined, 'aria-label': options.label, ...options.attrs },
    options.icon ? icon(options.icon) : null, text, options.iconAfter ? icon(options.iconAfter, options.iconAfter === 'arrow' ? 'arrow' : '') : null);
}

export function linkButton(text: Child, href: string, options: BtnOptions = {}) {
  const className = ['btn', options.variant, options.size, options.block ? 'block' : ''].filter(Boolean).join(' ');
  return h('a', { class: className, href, ...options.attrs }, options.icon ? icon(options.icon) : null, text, options.iconAfter ? icon(options.iconAfter, options.iconAfter === 'arrow' ? 'arrow' : '') : null);
}

export function eyebrow(text: string, muted = false) { return h('p', { class: muted ? 'eyebrow muted' : 'eyebrow' }, text); }

/** Number input with − / + buttons. Keyboard users can type or use arrow keys. */
export function stepper(options: { label: string; value: number | null; min: number; max: number; step?: number; onChange: (value: number | null) => void; compact?: boolean; allowEmpty?: boolean; suffix?: string; id?: string; placeholder?: string }) {
  const step = options.step ?? 1;
  const input = h('input', { type: 'number', inputmode: step % 1 ? 'decimal' : 'numeric', min: options.min, max: options.max, step, value: options.value === null ? '' : String(options.value), 'aria-label': options.label, id: options.id, placeholder: options.placeholder });
  const clamp = (value: number) => Math.min(options.max, Math.max(options.min, Math.round(value / step) * step));
  const commit = (value: number | null) => {
    const next = value === null || Number.isNaN(value) ? (options.allowEmpty ? null : options.min) : clamp(value);
    input.value = next === null ? '' : String(Number(next.toFixed(2)));
    options.onChange(next);
  };
  const bump = (direction: number) => commit((input.value === '' ? (direction > 0 ? options.min - step : options.min) : Number(input.value)) + direction * step);
  input.addEventListener('change', () => commit(input.value === '' ? null : Number(input.value)));
  return h('div', { class: `stepper${options.compact ? ' compact' : ''}` },
    h('button', { type: 'button', 'aria-label': `Decrease ${options.label}`, onclick: () => bump(-1), tabindex: '-1' }, icon('minus')),
    input,
    h('button', { type: 'button', 'aria-label': `Increase ${options.label}`, onclick: () => bump(1), tabindex: '-1' }, icon('plus')));
}

export type Choice<T extends string> = { value: T; title: string; text?: string };

/** Radio or checkbox tiles built on native inputs, so arrow keys and screen readers work. */
export function choices<T extends string>(options: { legend: string; name: string; items: Choice<T>[]; selected: T[]; multiple?: boolean; onChange: (values: T[]) => void; hint?: string; className?: string }) {
  const selected = new Set(options.selected);
  const hintId = options.hint ? nextId('hint') : undefined;
  return h('fieldset', { class: 'field', 'aria-describedby': hintId },
    h('legend', { class: 'label' }, options.legend),
    options.hint ? h('p', { class: 'hint', id: hintId }, options.hint) : null,
    h('div', { class: `choices ${options.className ?? ''}` }, options.items.map(item => h('label', { class: `choice${options.multiple ? ' multi' : ''}` },
      h('input', { type: options.multiple ? 'checkbox' : 'radio', name: options.name, value: item.value, checked: selected.has(item.value),
        onchange: (event: Event) => {
          const input = event.target as HTMLInputElement;
          if (options.multiple) { if (input.checked) selected.add(item.value); else selected.delete(item.value); }
          else { selected.clear(); selected.add(item.value); }
          options.onChange([...selected]);
        } }),
      h('span', { class: 'choice-mark', 'aria-hidden': 'true' }),
      h('span', { class: 'choice-title' }, item.title),
      item.text ? h('span', { class: 'choice-text' }, item.text) : null))));
}

export function segmented<T extends string>(options: { label: string; name: string; items: { value: T; label: string }[]; value: T; onChange: (value: T) => void; hideLabel?: boolean }) {
  return h('fieldset', { class: 'field' },
    h('legend', { class: options.hideLabel ? 'sr-only' : 'label' }, options.label),
    h('div', { class: 'segmented' }, options.items.map(item => h('label', null,
      h('input', { type: 'radio', name: options.name, value: item.value, checked: item.value === options.value, onchange: () => options.onChange(item.value) }),
      h('span', null, item.label)))));
}

export function switchRow(options: { label: string; text?: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return h('label', { class: 'switch' },
    h('span', { class: 'switch-text' }, h('span', null, options.label), options.text ? h('span', null, options.text) : null),
    h('input', { type: 'checkbox', role: 'switch', checked: options.checked, onchange: (event: Event) => options.onChange((event.target as HTMLInputElement).checked) }));
}

export function textField(options: { label: string; value: string; onInput: (value: string) => void; placeholder?: string; maxLength?: number; hint?: string; type?: string; autocomplete?: string }) {
  const id = nextId('field');
  return h('div', { class: 'field' },
    h('label', { for: id }, options.label),
    h('input', { id, class: 'input', type: options.type ?? 'text', value: options.value, placeholder: options.placeholder, maxlength: options.maxLength ?? 60, autocomplete: options.autocomplete ?? 'off',
      oninput: (event: Event) => options.onInput((event.target as HTMLInputElement).value) }),
    options.hint ? h('p', { class: 'hint' }, options.hint) : null);
}

// ── Dialogs ──────────────────────────────────────────────────────────────────────────────────

export function openDialog(options: { title: string; eyebrow?: string; body: Child; footer?: (close: () => void) => Child; wide?: boolean; onClose?: () => void; surface?: 'dark' | 'light' }): () => void {
  const titleId = nextId('dlg');
  const dialog = h('dialog', { class: `dialog${options.wide ? ' wide' : ''} surface-${options.surface ?? 'light'}`, 'aria-labelledby': titleId });
  const close = () => { if (dialog.open) dialog.close(); };
  dialog.append(...[
    h('div', { class: 'dialog-head' },
      h('div', { class: 'stack', style: { '--stack': '6px' } }, options.eyebrow ? eyebrow(options.eyebrow) : null, h('h2', { class: 'title', id: titleId }, options.title)),
      button('', close, { variant: 'ghost', icon: 'close', label: 'Close dialog', size: 'small' })),
    h('div', { class: 'dialog-body' }, options.body),
    options.footer ? h('div', { class: 'dialog-foot' }, options.footer(close)) : null].filter((node): node is HTMLDivElement => node !== null));
  dialog.addEventListener('close', () => { options.onClose?.(); dialog.remove(); });
  dialog.addEventListener('click', event => { if (event.target === dialog) close(); });
  document.body.append(dialog);
  dialog.showModal();
  return close;
}

/** Resolves true when the user confirms. Escape, the close button and Cancel all resolve false. */
export function confirmDialog(options: { title: string; text: Child; confirm: string; cancel?: string; danger?: boolean; extra?: { label: string; value: string } }): Promise<boolean | string> {
  return new Promise(resolve => {
    let result: boolean | string = false;
    openDialog({
      title: options.title, body: h('div', { class: 'body' }, options.text), onClose: () => resolve(result),
      footer: close => [
        button(options.cancel ?? 'Cancel', close, { variant: 'ghost' }),
        options.extra ? button(options.extra.label, () => { result = options.extra!.value; close(); }) : null,
        button(options.confirm, () => { result = true; close(); }, { variant: options.danger ? 'danger' : 'primary' }),
      ],
    });
  });
}

// ── Toasts ───────────────────────────────────────────────────────────────────────────────────

export function toast(message: string, options: { kind?: 'info' | 'error'; action?: { label: string; run: () => void }; ms?: number } = {}) {
  const host = document.getElementById('toasts');
  if (!host) return;
  const node = h('div', { class: `toast${options.kind === 'error' ? ' error' : ''}`, role: options.kind === 'error' ? 'alert' : 'status' }, h('p', null, message));
  const remove = () => { node.classList.add('leaving'); setTimeout(() => node.remove(), 320); };
  if (options.action) node.append(h('button', { type: 'button', onclick: () => { options.action!.run(); remove(); } }, options.action.label));
  node.append(h('button', { type: 'button', 'aria-label': 'Dismiss', onclick: remove }, '×'));
  host.append(node);
  setTimeout(remove, options.ms ?? (options.action ? 7000 : 4200));
}

// ── Data display ─────────────────────────────────────────────────────────────────────────────

export function stat(label: string, value: Child, unit?: string) {
  return h('div', { class: 'stat' }, h('p', { class: 'stat-label' }, label), h('p', { class: 'numeral' }, value, unit ? h('small', null, unit) : null));
}

export function empty(options: { title: string; text: string; action?: Child; icon?: string }) {
  return h('div', { class: 'empty' }, icon(options.icon ?? 'sparkle', 'empty-mark'), h('h3', { class: 'title' }, options.title), h('p', { class: 'body' }, options.text), options.action ?? null);
}

/** Circular countdown. `update(fraction)` moves it without rebuilding. */
export function ring(size: number, stroke = 3) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const value = s('circle', { cx: size / 2, cy: size / 2, r, class: 'value', 'stroke-width': stroke, 'stroke-dasharray': c.toFixed(2), 'stroke-dashoffset': '0' });
  const ticks = s('g', { class: 'ticks' }, Array.from({ length: 60 }, (_, i) => {
    const a = (i / 60) * Math.PI * 2, inner = r - (i % 5 === 0 ? 14 : 8), outer = r - 4;
    return s('line', { x1: size / 2 + Math.cos(a) * inner, y1: size / 2 + Math.sin(a) * inner, x2: size / 2 + Math.cos(a) * outer, y2: size / 2 + Math.sin(a) * outer, 'stroke-width': i % 5 === 0 ? 1.2 : 0.6 });
  }));
  const svg = s('svg', { viewBox: `0 0 ${size} ${size}`, 'aria-hidden': 'true' }, s('circle', { cx: size / 2, cy: size / 2, r, class: 'track', 'stroke-width': stroke }), ticks, value);
  return { svg, update: (fraction: number) => value.setAttribute('stroke-dashoffset', (c * (1 - Math.max(0, Math.min(1, fraction)))).toFixed(2)) };
}

/** Minimal Markdown subset for coach replies: paragraphs, bullet and numbered lists, **bold**. Built as DOM, never HTML. */
export function prose(text: string): HTMLElement {
  const root = h('div', { class: 'prose' });
  const inline = (line: string) => line.split(/(\*\*[^*]+\*\*)/g).filter(Boolean).map(part => part.startsWith('**') && part.endsWith('**') ? h('strong', null, part.slice(2, -2)) : part);
  let list: HTMLElement | null = null;
  for (const raw of text.replace(/\r/g, '').split('\n')) {
    const line = raw.trim();
    const bullet = line.match(/^[-*•]\s+(.*)$/), numbered = line.match(/^\d+[.)]\s+(.*)$/);
    if (bullet || numbered) {
      const tag = bullet ? 'ul' : 'ol';
      if (!list || list.tagName.toLowerCase() !== tag) { list = h(tag); root.append(list); }
      list.append(h('li', null, inline((bullet ?? numbered)![1])));
      continue;
    }
    list = null;
    if (!line) continue;
    const heading = line.match(/^#{1,4}\s+(.*)$/);
    root.append(heading ? h('p', null, h('strong', null, heading[1])) : h('p', null, inline(line)));
  }
  return root;
}

export function tabs<T extends string>(options: { label: string; items: { value: T; label: string }[]; value: T; onChange: (value: T) => void }) {
  const list = h('div', { class: 'tabs', role: 'tablist', 'aria-label': options.label });
  const buttons = options.items.map(item => h('button', { type: 'button', role: 'tab', 'aria-selected': String(item.value === options.value), tabindex: item.value === options.value ? '0' : '-1', onclick: () => options.onChange(item.value) }, item.label));
  list.addEventListener('keydown', event => {
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (index < 0 || !['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    const next = buttons[(index + (event.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length];
    next.focus();
    next.click();
  });
  list.append(...buttons);
  return list;
}

// ── Charts (inline SVG; single series, so the title names it and no legend box is needed) ────

export function barChart(options: { label: string; data: { key: string; label: string; value: number; display: string }[]; height?: number; format?: (value: number) => string; highlightLast?: boolean; emptyText?: string }) {
  const height = options.height ?? 180;
  const width = 640, pad = { top: 18, right: 8, bottom: 26, left: 34 };
  const max = Math.max(1, ...options.data.map(item => item.value));
  const niceMax = (() => { const p = 10 ** Math.floor(Math.log10(max)); const n = max / p; return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p; })();
  const top = options.data.every(item => Number.isInteger(item.value)) ? Math.max(niceMax, 2) : niceMax;
  const ticks = [0, top / 2, top];
  const innerW = width - pad.left - pad.right, innerH = height - pad.top - pad.bottom;
  const band = innerW / options.data.length;
  const barW = Math.min(24, band - 2);
  const y = (value: number) => pad.top + innerH - (value / top) * innerH;
  const format = options.format ?? ((value: number) => value >= 1000 ? `${Math.round(value / 100) / 10}K` : Number.isInteger(value) ? String(value) : value.toFixed(1));
  const wrap = h('figure', { class: 'chart' });
  const tip = h('div', { class: 'tooltip', hidden: true });
  const svg = s('svg', { viewBox: `0 0 ${width} ${height}`, role: 'img', 'aria-label': options.label, class: 'chart-svg' },
    ticks.map(value => s('g', null,
      s('line', { x1: pad.left, x2: width - pad.right, y1: y(value), y2: y(value), class: 'chart-gridline' }),
      s('text', { x: pad.left - 8, y: y(value) + 4, class: 'chart-axis', 'text-anchor': 'end' }, format(value)))),
    options.data.map((item, index) => {
      const x = pad.left + index * band + (band - barW) / 2;
      const top = y(item.value), barH = pad.top + innerH - top;
      const r = Math.min(4, barH);
      const path = item.value > 0 ? `M${x} ${pad.top + innerH} V${top + r} Q${x} ${top} ${x + r} ${top} H${x + barW - r} Q${x + barW} ${top} ${x + barW} ${top + r} V${pad.top + innerH} Z` : '';
      const last = options.highlightLast && index === options.data.length - 1;
      const hit = s('rect', { x: pad.left + index * band, y: pad.top, width: band, height: innerH, fill: 'transparent', class: 'chart-hit', tabindex: '0', 'aria-label': `${item.label}: ${item.display}` });
      const show = () => {
        tip.replaceChildren(h('strong', null, item.display), item.label);
        tip.hidden = false;
        tip.style.left = `${((x + barW / 2) / width) * 100}%`;
        tip.style.top = `${(Math.max(top, pad.top) / height) * 100}%`;
      };
      hit.addEventListener('mouseenter', show); hit.addEventListener('focus', show);
      hit.addEventListener('mouseleave', () => { tip.hidden = true; }); hit.addEventListener('blur', () => { tip.hidden = true; });
      return s('g', { class: last ? 'chart-bar current' : 'chart-bar' }, path ? s('path', { d: path }) : null,
        index % 2 === (options.data.length - 1) % 2 ? s('text', { x: x + barW / 2, y: height - 8, class: 'chart-axis', 'text-anchor': 'middle' }, item.label) : null, hit);
    }),
    s('line', { x1: pad.left, x2: width - pad.right, y1: pad.top + innerH, y2: pad.top + innerH, class: 'chart-base' }));
  // Accessible equivalent: the same values as a table for screen readers.
  const table = h('table', { class: 'sr-only' }, h('caption', null, options.label), h('tbody', null, options.data.map(item => h('tr', null, h('th', { scope: 'row' }, item.label), h('td', null, item.display)))));
  wrap.append(svg, tip, table);
  if (options.data.every(item => item.value === 0) && options.emptyText) wrap.append(h('p', { class: 'chart-empty small muted' }, options.emptyText));
  return wrap;
}
