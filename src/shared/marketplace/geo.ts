import type { City, GeoPoint, UserLocation } from './types.js';

export function distanceKm(a: GeoPoint, b: GeoPoint): number {
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function formatDistance(km: number): string {
  return km < 1 ? `${Math.round(km * 1000 / 50) * 50} m` : km < 10 ? `${km.toFixed(1)} km` : `${Math.round(km)} km`;
}

/**
 * Coordinates are rounded to about 1 km before they leave the device, so a precise home location is
 * never sent to or stored by the server.
 */
export function coarse(point: GeoPoint): GeoPoint {
  return { lat: Math.round(point.lat * 100) / 100, lng: Math.round(point.lng * 100) / 100 };
}

export function nearestCity(point: GeoPoint, cities: City[], maxKm = 60): City | null {
  let best: City | null = null, bestKm = Infinity;
  for (const city of cities) {
    const km = distanceKm(point, city);
    if (km < bestKm) { best = city; bestKm = km; }
  }
  return bestKm <= maxKm ? best : null;
}

const clean = (text: string) => text.toLowerCase().normalize('NFKD').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();

/**
 * Resolves a typed place against the configured gazetteer: area or city names and postcode prefixes.
 * Returns ranked matches; an empty list means the place is outside the areas Icarus covers.
 */
export function resolvePlace(query: string, cities: City[]): UserLocation[] {
  const q = clean(query);
  if (q.length < 2) return [];
  const results: (UserLocation & { score: number })[] = [];
  for (const city of cities) {
    const cityName = clean(city.name);
    for (const area of city.areas) {
      const name = clean(area.name);
      const postcode = area.postcodes.some(code => q.replace(/ /g, '').startsWith(code.toLowerCase().replace(/ /g, '')) && q.replace(/ /g, '').length >= 3);
      const score = postcode ? 3 : name === q || `${name} ${cityName}` === q ? 3 : name.startsWith(q) ? 2 : q.includes(name) || name.includes(q) ? 1 : 0;
      if (score) results.push({ lat: area.lat, lng: area.lng, label: `${area.name}, ${city.name}`, cityId: city.id, source: 'search', score });
    }
    if (cityName === q || cityName.startsWith(q) || q.includes(cityName)) results.push({ lat: city.lat, lng: city.lng, label: city.name, cityId: city.id, source: 'search', score: cityName === q ? 4 : 2 });
  }
  return results.sort((a, b) => b.score - a.score || a.label.localeCompare(b.label)).slice(0, 8).map(({ score: _score, ...rest }) => rest);
}
