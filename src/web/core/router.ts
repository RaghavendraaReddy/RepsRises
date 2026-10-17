// Hash router. Each view returns its element plus how the shell should present it.

export type ViewContext = { params: Record<string, string>; query: URLSearchParams; navigate: (hash: string, replace?: boolean) => void };
export type View = { el: HTMLElement; title: string; surface: 'dark' | 'light'; immersive?: boolean; nav?: string; cleanup?: () => void };
export type ViewFactory = (context: ViewContext) => View | string;

type Route = { pattern: RegExp; keys: string[]; factory: ViewFactory };

export class Router {
  private routes: Route[] = [];
  private current: View | null = null;
  private first = true;
  constructor(private outlet: HTMLElement, private onRender: (view: View) => void, private fallback: ViewFactory) {
    window.addEventListener('hashchange', () => this.render());
  }

  add(path: string, factory: ViewFactory) {
    const keys: string[] = [];
    const pattern = new RegExp('^' + path.replace(/:([a-z]+)/gi, (_, key: string) => { keys.push(key); return '([^/]+)'; }) + '$');
    this.routes.push({ pattern, keys, factory });
    return this;
  }

  navigate(hash: string, replace = false) {
    const target = hash.startsWith('#') ? hash : `#${hash}`;
    if (location.hash === target) { this.render(); return; }
    if (replace) { history.replaceState(null, '', target); this.render(); }
    else location.hash = target;
  }

  /** Re-render the current route, e.g. after data changed in another tab. */
  refresh() { this.render(true); }

  render(keepScroll = false) {
    const raw = location.hash.slice(1) || '/';
    const [path, search = ''] = raw.split('?');
    const query = new URLSearchParams(search);
    const context = (params: Record<string, string>): ViewContext => ({ params, query, navigate: (hash, replace) => this.navigate(hash, replace) });
    let result: View | string | undefined;
    for (const route of this.routes) {
      const match = path.match(route.pattern);
      if (!match) continue;
      const params = Object.fromEntries(route.keys.map((key, index) => [key, decodeURIComponent(match[index + 1])]));
      result = route.factory(context(params));
      break;
    }
    result ??= this.fallback(context({}));
    // A view may redirect by returning a hash string.
    if (typeof result === 'string') { this.navigate(result, true); return; }
    const scroll = keepScroll ? window.scrollY : 0;
    this.current?.cleanup?.();
    this.current = result;
    result.el.classList.add('view-enter');
    this.outlet.replaceChildren(result.el);
    document.title = result.title ? `${result.title} · Icarus` : 'Icarus';
    this.onRender(result);
    window.scrollTo({ top: scroll, behavior: 'instant' as ScrollBehavior });
    // Move focus to the new page's heading so screen reader and keyboard users land in context.
    if (!this.first && !keepScroll) {
      const heading = this.outlet.querySelector<HTMLElement>('h1');
      if (heading) { heading.setAttribute('tabindex', '-1'); heading.focus({ preventScroll: true }); }
    }
    this.first = false;
  }
}
