// Tiny DOM builder. Everything is created with createElement and textContent, never innerHTML,
// so user and model text can never become markup.

export type Child = Node | string | number | null | undefined | false | Child[];
type Handler = (event: never) => void;
export type Attrs = Record<string, string | number | boolean | null | undefined | Handler | Record<string, string>>;

function append(parent: Node, child: Child) {
  if (child === null || child === undefined || child === false) return;
  if (Array.isArray(child)) { for (const item of child) append(parent, item); return; }
  parent.appendChild(child instanceof Node ? child : document.createTextNode(String(child)));
}

const PROPS = new Set(['value', 'checked', 'selected', 'indeterminate']);

function apply(node: Element, attrs: Attrs | null | undefined) {
  if (!attrs) return;
  for (const [key, value] of Object.entries(attrs)) {
    if (value === null || value === undefined || value === false) continue;
    if (key.startsWith('on') && typeof value === 'function') { node.addEventListener(key.slice(2).toLowerCase(), value as EventListener); continue; }
    if (key === 'dataset' && typeof value === 'object') { Object.assign((node as HTMLElement).dataset, value); continue; }
    if (key === 'style' && typeof value === 'object') { for (const [name, v] of Object.entries(value)) (node as HTMLElement).style.setProperty(name, v); continue; }
    if (PROPS.has(key)) { (node as unknown as Record<string, unknown>)[key] = value; continue; }
    node.setAttribute(key === 'className' ? 'class' : key, value === true ? '' : String(value));
  }
}

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs?: Attrs | null, ...children: Child[]): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  apply(node, attrs);
  append(node, children);
  return node;
}

export function s<K extends keyof SVGElementTagNameMap>(tag: K, attrs?: Attrs | null, ...children: Child[]): SVGElementTagNameMap[K] {
  const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
  apply(node, attrs);
  append(node, children);
  return node;
}

export function fragment(...children: Child[]): DocumentFragment {
  const node = document.createDocumentFragment();
  append(node, children);
  return node;
}

export function replace(node: Element, ...children: Child[]) {
  node.replaceChildren();
  append(node, children);
}

export function byId<T extends HTMLElement = HTMLElement>(id: string): T | null {
  return document.getElementById(id) as T | null;
}

let counter = 0;
export function nextId(prefix = 'el') { return `${prefix}-${++counter}`; }

/** Small debounce for input-driven saves. */
export function debounce<T extends unknown[]>(fn: (...args: T) => void, ms: number) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return (...args: T) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), ms); };
}

export function prefersReducedMotion(): boolean {
  return document.documentElement.dataset.motion === 'reduced' || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
