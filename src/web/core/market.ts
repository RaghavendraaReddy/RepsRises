import type { RequestInput, RequestRecord } from '../../shared/marketplace/requests.js';
import type { GymResult } from '../../shared/marketplace/search.js';
import type { City, Gym, PackageTemplate, Professional, UserLocation } from '../../shared/marketplace/types.js';
import { store } from './store.js';

// Browser client for the marketplace API. Reads are cached for the page's lifetime; the dataset is
// small and changes only when the server's provider changes.

export class MarketError extends Error {
  constructor(message: string, public status: number, public fields: Record<string, string> = {}) { super(message); }
}

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, { ...init, headers: { Accept: 'application/json', ...(init.headers ?? {}) } });
  } catch {
    throw new MarketError('Could not reach the Icarus server. Check your connection and try again.', 0);
  }
  let data: unknown = null;
  try { data = await response.json(); } catch { /* handled below */ }
  if (!response.ok) {
    const body = (data ?? {}) as { error?: string; fields?: Record<string, string> };
    throw new MarketError(body.error ?? 'Something went wrong. Please try again.', response.status, body.fields ?? {});
  }
  return data as T;
}

const cache = new Map<string, Promise<unknown>>();
function cached<T>(path: string): Promise<T> {
  if (!cache.has(path)) cache.set(path, call<T>(path).catch(error => { cache.delete(path); throw error; }));
  return cache.get(path) as Promise<T>;
}

export type MarketInfo = { provider: { name: string; demo: boolean }; cities: City[]; packages: PackageTemplate[] };
export type GymCard = Omit<Gym, 'description' | 'policies' | 'equipment'>;
export type GymSearch = { total: number; results: (Omit<GymResult, 'gym'> & { gym: GymCard })[] };
export type GymDetail = { gym: Gym; trainers: Professional[]; nutritionists: Professional[] };

export const market = {
  info: () => cached<MarketInfo>('/api/marketplace'),
  gyms: (params: URLSearchParams) => cached<GymSearch>(`/api/gyms?${params}`),
  gym: (id: string) => cached<GymDetail>(`/api/gyms/${encodeURIComponent(id)}`),
  professionals: (params: Record<string, string>) => cached<{ results: Professional[] }>(`/api/professionals?${new URLSearchParams(params)}`),
  professional: (id: string) => cached<{ professional: Professional; gyms: GymCard[] }>(`/api/professionals/${encodeURIComponent(id)}`),
  geocode: (q: string) => call<{ source: string; results: UserLocation[] }>(`/api/geocode?q=${encodeURIComponent(q)}`),

  async submit(input: RequestInput): Promise<RequestRecord & { token: string }> {
    if (!store.config) throw new MarketError('Not connected to the Icarus server. Reload the page and try again.', 0);
    return call('/api/requests', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Icarus-Token': store.config.token }, body: JSON.stringify(input) });
  },
  status: (ref: string, token: string) => call<RequestRecord>(`/api/requests/${encodeURIComponent(ref)}`, { headers: { 'X-Request-Token': token } }),
  async withdraw(ref: string, token: string): Promise<RequestRecord> {
    if (!store.config) throw new MarketError('Not connected to the Icarus server.', 0);
    return call(`/api/requests/${encodeURIComponent(ref)}`, { method: 'DELETE', headers: { 'X-Request-Token': token, 'X-Icarus-Token': store.config.token } });
  },
};

/** Loads several resources and renders a loading, error or ready state into a container. */
export async function load<T>(target: HTMLElement, work: () => Promise<T>, render: (value: T) => Node | (Node | null)[], options: { loading?: string } = {}) {
  target.setAttribute('aria-busy', 'true');
  target.replaceChildren(loadingBlock(options.loading ?? 'Loading…'));
  try {
    const value = await work();
    const nodes = render(value);
    target.replaceChildren(...(Array.isArray(nodes) ? nodes.filter((node): node is Node => node !== null) : [nodes]));
  } catch (error) {
    target.replaceChildren(errorBlock(error instanceof Error ? error.message : 'Could not load this.', () => void load(target, work, render, options)));
  } finally { target.removeAttribute('aria-busy'); }
}

function loadingBlock(text: string) {
  const el = document.createElement('div');
  el.className = 'state state-loading';
  el.setAttribute('role', 'status');
  const bar = document.createElement('span'); bar.className = 'skeleton-bar'; bar.setAttribute('aria-hidden', 'true');
  const label = document.createElement('p'); label.className = 'small muted'; label.textContent = text;
  el.append(bar, label);
  return el;
}

function errorBlock(text: string, retry: () => void) {
  const el = document.createElement('div');
  el.className = 'state state-error';
  el.setAttribute('role', 'alert');
  const p = document.createElement('p'); p.textContent = text;
  const button = document.createElement('button'); button.type = 'button'; button.className = 'btn ghost small'; button.textContent = 'Try again'; button.addEventListener('click', retry);
  el.append(p, button);
  return el;
}
