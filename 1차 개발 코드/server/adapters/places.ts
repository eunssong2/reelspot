import { config } from '../core/config.js';
import { demand, DomainError } from '../core/errors.js';

export function coordinates(value: unknown, size: 2 | 4): number[] | null {
  if (value == null || value === '') return null;
  const parts = String(value).split(',');
  const n = parts.map(Number);
  demand(parts.length === size && parts.every((p) => p.trim() !== '') && n.every(Number.isFinite), 'VALIDATION_ERROR');
  demand(n.every((v, i) => Math.abs(v) <= (i % 2 === 0 ? 180 : 90)), 'VALIDATION_ERROR');
  if (size === 4) demand(n[0] < n[2] && n[1] < n[3], 'VALIDATION_ERROR');
  return n;
}
export function distanceMeters(a: number[], b: number[]): number {
  const rad = Math.PI / 180;
  const dlat = (b[1] - a[1]) * rad, dlng = (b[0] - a[0]) * rad;
  const h = Math.sin(dlat / 2) ** 2 + Math.cos(a[1] * rad) * Math.cos(b[1] * rad) * Math.sin(dlng / 2) ** 2;
  return Math.round(6371000 * 2 * Math.asin(Math.min(1, Math.sqrt(h))));
}
export async function searchPlaces(q: Record<string, any>) {
  const provider = process.env.PLACES_PROVIDER ?? 'google';
  const center = coordinates(q.center, 2), bounds = coordinates(q.bounds, 4);
  const key = provider === 'google' ? process.env.GOOGLE_PLACES_API_KEY : process.env.KAKAO_REST_KEY;
  if (!key) {
    demand(!config.production, 'PROVIDER_UNAVAILABLE', 503);
    return { places: [], provider, searchContext: { query: q.query, center: q.center ?? null, available: false,
      message: '장소 검색 연결이 준비되지 않았습니다. 직접 등록은 사용할 수 있어요.' } };
  }
  try {
    let places: any[];
    if (provider === 'google') {
      const types: Record<string, string> = { restaurant: 'restaurant', cafe: 'cafe', lodging: 'lodging', tourism: 'tourist_attraction' };
      const body: Record<string, unknown> = { textQuery: q.query, languageCode: 'ko', regionCode: 'KR', pageSize: 20 };
      if (q.sort === 'distance') body.rankPreference = 'DISTANCE';
      if (types[q.category]) Object.assign(body, { includedType: types[q.category], strictTypeFiltering: true });
      if (bounds) body.locationRestriction = { rectangle: { low: { longitude: bounds[0], latitude: bounds[1] }, high: { longitude: bounds[2], latitude: bounds[3] } } };
      else if (center) body.locationBias = { circle: { center: { longitude: center[0], latitude: center[1] }, radius: 25000 } };
      const r = await fetch('https://places.googleapis.com/v1/places:searchText', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': key,
          'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location,places.attributions' },
        body: JSON.stringify(body), signal: AbortSignal.timeout(10000),
      });
      demand(r.ok, 'PROVIDER_UNAVAILABLE', 503);
      const data = await r.json() as any;
      places = (data.places ?? []).map((p: any) => ({ id: p.id, name: p.displayName?.text ?? '', address: p.formattedAddress ?? '',
        lat: p.location?.latitude ?? null, lng: p.location?.longitude ?? null, attributions: p.attributions ?? [] }));
    } else {
      demand(provider === 'kakao', 'PROVIDER_UNAVAILABLE', 503);
      const u = new URL('https://dapi.kakao.com/v2/local/search/keyword.json');
      u.searchParams.set('query', q.query);
      const types: Record<string, string> = { restaurant: 'FD6', cafe: 'CE7', lodging: 'AD5', tourism: 'AT4' };
      if (types[q.category]) u.searchParams.set('category_group_code', types[q.category]);
      if (bounds) u.searchParams.set('rect', bounds.join(','));
      if (center) { u.searchParams.set('x', String(center[0])); u.searchParams.set('y', String(center[1])); }
      if (q.sort === 'distance') u.searchParams.set('sort', 'distance');
      const r = await fetch(u, { headers: { Authorization: `KakaoAK ${key}` }, signal: AbortSignal.timeout(10000) });
      demand(r.ok, 'PROVIDER_UNAVAILABLE', 503);
      const data = await r.json() as any;
      places = data.documents.map((p: any) => ({ id: p.id, name: p.place_name, address: p.road_address_name || p.address_name, lat: Number(p.y), lng: Number(p.x) }));
    }
    places = places.map((p) => ({ ...p, distance: center && p.lat != null && p.lng != null ? distanceMeters(center, [p.lng, p.lat]) : null }));
    if (q.sort === 'distance') places.sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity));
    return { places, provider, searchContext: { query: q.query, center: q.center ?? null, available: true } };
  } catch (e) {
    if (e instanceof DomainError) throw e;
    throw new DomainError('PROVIDER_UNAVAILABLE', 503);
  }
}
