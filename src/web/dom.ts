export function el<K extends keyof HTMLElementTagNameMap>(tag: K, text = '', className = ''): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag); node.textContent = text; node.className = className; return node;
}
export function button(text: string, action: () => void, className = '') {
  const node = el('button', text, className); node.type = 'button'; node.addEventListener('click', action); return node;
}
export function byId<T extends HTMLElement>(id: string) { return document.getElementById(id) as T; }
export function svg<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string> = {}): SVGElementTagNameMap[K] {
  const node = document.createElementNS('http://www.w3.org/2000/svg', tag); for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, value); return node;
}
