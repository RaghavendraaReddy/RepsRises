import type { Audience } from '../fitness/types.js';
import { distanceKm } from './geo.js';
import { effectiveMonthly, fromPrice } from './pricing.js';
import { FACILITIES, GYM_CATEGORIES, type Facility, type GeoPoint, type Gym, type GymCategory, type MembershipPlan } from './types.js';

export const DURATIONS = [1, 2, 3, 6, 9, 10, 12] as const;
export type SortKey = 'distance' | 'price' | 'name';

export type GymQuery = {
  near: GeoPoint | null;
  radiusKm: number | null;
  q: string;
  audience: Audience | null;
  cityId: string | null;
  maxMonthly: number | null;
  minMonthly: number | null;
  months: number | null;
  facilities: Facility[];
  categories: GymCategory[];
  classes: boolean;
  trainers: boolean;
  open24h: boolean;
  earlyOpen: boolean;
  accessible: boolean;
  /** Only gyms with ratings from a verified review source. */
  reviewed: boolean;
  sort: SortKey;
};

export const EMPTY_QUERY: GymQuery = { near: null, radiusKm: null, q: '', audience: null, cityId: null, maxMonthly: null, minMonthly: null, months: null, facilities: [], categories: [], classes: false, trainers: false, open24h: false, earlyOpen: false, accessible: false, reviewed: false, sort: 'distance' };

export type GymResult = { gym: Gym; distanceKm: number | null; from: { plan: MembershipPlan; monthly: number } | null };

/** Parses URL search parameters into a query, dropping anything invalid instead of failing. */
export function parseGymQuery(params: URLSearchParams): GymQuery {
  const num = (key: string, min: number, max: number) => {
    const raw = params.get(key);
    if (raw === null || raw === '') return null;
    const value = Number(raw);
    return Number.isFinite(value) && value >= min && value <= max ? value : null;
  };
  const list = <T extends string>(key: string, allowed: readonly T[]) => (params.get(key) ?? '').split(',').filter((item): item is T => (allowed as readonly string[]).includes(item));
  const lat = num('lat', -90, 90), lng = num('lng', -180, 180);
  const audience = params.get('audience');
  const sort = params.get('sort');
  return {
    near: lat !== null && lng !== null ? { lat, lng } : null,
    radiusKm: num('radius', 1, 200),
    q: (params.get('q') ?? '').slice(0, 80),
    audience: audience === 'kids' || audience === 'adults' || audience === 'older' ? audience : null,
    cityId: /^[a-z-]{2,40}$/.test(params.get('city') ?? '') ? params.get('city') : null,
    maxMonthly: num('max', 0, 1_000_000),
    minMonthly: num('min', 0, 1_000_000),
    months: num('months', 1, 36),
    facilities: list('facilities', FACILITIES),
    categories: list('categories', GYM_CATEGORIES),
    classes: params.get('classes') === '1',
    trainers: params.get('trainers') === '1',
    open24h: params.get('open24h') === '1',
    earlyOpen: params.get('early') === '1',
    accessible: params.get('accessible') === '1',
    reviewed: params.get('reviewed') === '1',
    sort: sort === 'price' || sort === 'name' ? sort : 'distance',
  };
}

export function serializeGymQuery(query: GymQuery): URLSearchParams {
  const params = new URLSearchParams();
  if (query.near) { params.set('lat', String(query.near.lat)); params.set('lng', String(query.near.lng)); }
  if (query.radiusKm) params.set('radius', String(query.radiusKm));
  if (query.q) params.set('q', query.q);
  if (query.audience) params.set('audience', query.audience);
  if (query.cityId) params.set('city', query.cityId);
  if (query.maxMonthly !== null) params.set('max', String(query.maxMonthly));
  if (query.minMonthly !== null) params.set('min', String(query.minMonthly));
  if (query.months) params.set('months', String(query.months));
  if (query.facilities.length) params.set('facilities', query.facilities.join(','));
  if (query.categories.length) params.set('categories', query.categories.join(','));
  for (const [key, on] of [['classes', query.classes], ['trainers', query.trainers], ['open24h', query.open24h], ['early', query.earlyOpen], ['accessible', query.accessible], ['reviewed', query.reviewed]] as const) if (on) params.set(key, '1');
  if (query.sort !== 'distance') params.set('sort', query.sort);
  return params;
}

export function planMatches(plan: MembershipPlan, query: Pick<GymQuery, 'audience' | 'months' | 'maxMonthly' | 'minMonthly'>) {
  const monthly = effectiveMonthly(plan);
  return (!query.audience || plan.audiences.includes(query.audience)) && (!query.months || plan.months === query.months) &&
    (query.maxMonthly === null || monthly <= query.maxMonthly) && (query.minMonthly === null || monthly >= query.minMonthly);
}

/** One implementation of gym search, used by the server API and its tests. */
export function searchGyms(gyms: Gym[], query: GymQuery): GymResult[] {
  const q = query.q.trim().toLowerCase();
  const results: GymResult[] = [];
  for (const gym of gyms) {
    if (query.cityId && gym.cityId !== query.cityId) continue;
    if (query.audience && !gym.audiences.includes(query.audience)) continue;
    if (q && !`${gym.name} ${gym.area} ${gym.tagline}`.toLowerCase().includes(q)) continue;
    if (query.facilities.some(item => !gym.facilities.includes(item))) continue;
    if (query.categories.length && !query.categories.some(item => gym.categories.includes(item))) continue;
    if (query.classes && !gym.classes.length) continue;
    if (query.trainers && !gym.trainerIds.length) continue;
    if (query.open24h && !gym.hours.open24h) continue;
    if (query.earlyOpen && !gym.hours.earlyOpen) continue;
    if (query.accessible && !gym.accessibility.includes('step-free')) continue;
    if (query.reviewed && !gym.reviews) continue;
    const from = fromPrice(gym, plan => planMatches(plan, query));
    if ((query.months || query.maxMonthly !== null || query.minMonthly !== null || query.audience) && !from) continue;
    const distance = query.near ? distanceKm(query.near, gym) : null;
    if (distance !== null && query.radiusKm && distance > query.radiusKm) continue;
    results.push({ gym, distanceKm: distance === null ? null : Math.round(distance * 10) / 10, from });
  }
  const byName = (a: GymResult, b: GymResult) => a.gym.name.localeCompare(b.gym.name);
  return results.sort(query.sort === 'name' ? byName
    : query.sort === 'price' ? (a, b) => (a.from?.monthly ?? Infinity) - (b.from?.monthly ?? Infinity) || byName(a, b)
    : (a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity) || byName(a, b));
}
