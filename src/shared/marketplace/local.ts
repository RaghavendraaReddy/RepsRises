import { AUDIENCES, type Audience } from '../fitness/types.js';
import type { RequestKind, RequestStatus, UserLocation } from './types.js';

// What the browser keeps about marketplace use. Everything here stays on the device: the server only
// sees a request when the person submits one. Location is stored coarsened (about 1 km).

export const SAVED_KINDS = ['gyms', 'exercises', 'professionals', 'packages'] as const;
export type SavedKind = typeof SAVED_KINDS[number];

export const DIETS = ['no-preference', 'vegetarian', 'eggetarian', 'vegan', 'pescatarian', 'jain'] as const;
export type Diet = typeof DIETS[number];
export const DIET_LABEL: Record<Diet, string> = { 'no-preference': 'No preference', vegetarian: 'Vegetarian', eggetarian: 'Eggetarian', vegan: 'Vegan', pescatarian: 'Pescatarian', jain: 'Jain' };

export const AVOIDS = ['dairy', 'gluten', 'nuts', 'eggs', 'soy', 'shellfish'] as const;
export type Avoid = typeof AVOIDS[number];
export const AVOID_LABEL: Record<Avoid, string> = { dairy: 'Dairy', gluten: 'Gluten', nuts: 'Nuts', eggs: 'Eggs', soy: 'Soy', shellfish: 'Shellfish' };

export const MEAL_SLOTS = ['breakfast', 'lunch', 'snack', 'dinner'] as const;
export type MealSlot = typeof MEAL_SLOTS[number];
export const MEAL_SLOT_LABEL: Record<MealSlot, string> = { breakfast: 'Breakfast', lunch: 'Lunch', snack: 'Snack', dinner: 'Dinner' };

/** A note in the person's own weekly meal organiser. It is their plan, not advice from Icarus. */
export type MealEntry = { id: string; day: number; slot: MealSlot; text: string };

export type CompareItem = { gymId: string; planId: string };

/** A submitted request: the reference and access token let the person check or withdraw it. */
export type LocalRequest = { ref: string; token: string; kind: RequestKind; summary: string; createdAt: string; status: RequestStatus };

export type LocalState = {
  version: 1;
  audience: Audience | null;
  location: UserLocation | null;
  saved: Record<SavedKind, string[]>;
  compare: CompareItem[];
  requests: LocalRequest[];
  nutrition: { diet: Diet; avoid: Avoid[]; meals: MealEntry[] };
};

export const COMPARE_LIMIT = 4;
export const SAVED_LIMIT = 200;
export const MEAL_LIMIT = 7 * 4 * 3;

export function emptyLocal(): LocalState {
  return { version: 1, audience: null, location: null, saved: { gyms: [], exercises: [], professionals: [], packages: [] }, compare: [], requests: [], nutrition: { diet: 'no-preference', avoid: [], meals: [] } };
}

const isObject = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const id = (value: unknown) => typeof value === 'string' && /^[a-z0-9_-]{1,80}$/i.test(value);
const text = (value: unknown, max: number) => typeof value === 'string' && value.length <= max;
const coord = (value: unknown, limit: number) => typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= limit;

export function isLocation(value: unknown): value is UserLocation {
  return isObject(value) && coord(value.lat, 90) && coord(value.lng, 180) && text(value.label, 120) && (value.cityId === null || id(value.cityId)) && (value.source === 'device' || value.source === 'search');
}

function isRequest(value: unknown): value is LocalRequest {
  return isObject(value) && typeof value.ref === 'string' && /^ICR-\d{6}-[0-9A-F]{6}$/.test(value.ref) && text(value.token, 64) && ['membership', 'coaching', 'enquiry', 'support'].includes(value.kind as string) &&
    text(value.summary, 300) && text(value.createdAt, 40) && ['received', 'forwarded', 'withdrawn'].includes(value.status as string);
}

function isMeal(value: unknown): value is MealEntry {
  return isObject(value) && id(value.id) && Number.isInteger(value.day) && (value.day as number) >= 0 && (value.day as number) <= 6 && MEAL_SLOTS.includes(value.slot as MealSlot) && text(value.text, 140) && (value.text as string).trim().length > 0;
}

/**
 * Validates stored state. Unknown or damaged parts fall back to defaults one field at a time, so a
 * bad saved item never wipes the rest.
 */
export function readLocal(value: unknown): LocalState {
  const base = emptyLocal();
  if (!isObject(value) || value.version !== 1) return base;
  const saved = isObject(value.saved) ? value.saved : {};
  const nutrition = isObject(value.nutrition) ? value.nutrition : {};
  return {
    version: 1,
    audience: AUDIENCES.includes(value.audience as Audience) ? value.audience as Audience : null,
    location: isLocation(value.location) ? value.location : null,
    saved: Object.fromEntries(SAVED_KINDS.map(kind => [kind, Array.isArray(saved[kind]) ? [...new Set((saved[kind] as unknown[]).filter(id) as string[])].slice(0, SAVED_LIMIT) : []])) as Record<SavedKind, string[]>,
    compare: Array.isArray(value.compare) ? (value.compare as unknown[]).filter((item): item is CompareItem => isObject(item) && id(item.gymId) && id(item.planId)).slice(0, COMPARE_LIMIT) : [],
    requests: Array.isArray(value.requests) ? (value.requests as unknown[]).filter(isRequest).slice(0, 50) : [],
    nutrition: {
      diet: DIETS.includes(nutrition.diet as Diet) ? nutrition.diet as Diet : 'no-preference',
      avoid: Array.isArray(nutrition.avoid) ? [...new Set((nutrition.avoid as unknown[]).filter((item): item is Avoid => AVOIDS.includes(item as Avoid)))] : [],
      meals: Array.isArray(nutrition.meals) ? (nutrition.meals as unknown[]).filter(isMeal).slice(0, MEAL_LIMIT) : [],
    },
  };
}

export function toggleSaved(state: LocalState, kind: SavedKind, itemId: string): LocalState {
  const list = state.saved[kind];
  const next = list.includes(itemId) ? list.filter(item => item !== itemId) : [itemId, ...list].slice(0, SAVED_LIMIT);
  return { ...state, saved: { ...state.saved, [kind]: next } };
}

/** Adds or removes a plan from the comparison. Returns null when the comparison is already full. */
export function toggleCompare(state: LocalState, item: CompareItem): LocalState | null {
  const present = state.compare.some(entry => entry.gymId === item.gymId && entry.planId === item.planId);
  if (present) return { ...state, compare: state.compare.filter(entry => !(entry.gymId === item.gymId && entry.planId === item.planId)) };
  if (state.compare.length >= COMPARE_LIMIT) return null;
  return { ...state, compare: [...state.compare, item] };
}

/** Rounds a position to two decimals (about 1 km) before it is stored or sent anywhere. */
export function coarseLocation(location: UserLocation): UserLocation {
  return { ...location, lat: Math.round(location.lat * 100) / 100, lng: Math.round(location.lng * 100) / 100 };
}
