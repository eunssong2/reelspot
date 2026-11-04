import { config } from '../core/config.js';
import { demand, DomainError } from '../core/errors.js';

export function coordinates(value: unknown, size: 2 | 4): number[] | null {
  if (value == null || value === '') return null;
  const parts = String(value).split(',');
  const n = parts.map(Number);
  demand(
    parts.length === size && parts.every((p) => p.trim() !== '') && n.every(Number.isFinite),
    'VALIDATION_ERROR',
  );
  demand(
    n.every((v, i) => Math.abs(v) <= (i % 2 === 0 ? 180 : 90)),
    'VALIDATION_ERROR',
  );
  if (size === 4) demand(n[0] < n[2] && n[1] < n[3], 'VALIDATION_ERROR');
  return n;
}
export function distanceMeters(a: number[], b: number[]): number {
  const rad = Math.PI / 180;
  const dlat = (b[1] - a[1]) * rad,
    dlng = (b[0] - a[0]) * rad;
  const h =
    Math.sin(dlat / 2) ** 2 + Math.cos(a[1] * rad) * Math.cos(b[1] * rad) * Math.sin(dlng / 2) ** 2;
  return Math.round(6371000 * 2 * Math.asin(Math.min(1, Math.sqrt(h))));
}
export async function searchPlaces(q: Record<string, any>) {
  const provider = 'kakao'; // D13/Q5: production search remains Kakao in Seoul.
  const center = coordinates(q.center, 2),
    bounds = coordinates(q.bounds, 4);
  const key = process.env.KAKAO_REST_KEY;
  if (!key) {
    demand(!config.production, 'PROVIDER_UNAVAILABLE', 503);
    return {
      places: [],
      provider, region: '서울특별시', excludedOutsideSeoul: 0, page: Number(q.page ?? 1), isEnd: true,
      searchContext: {
        query: q.query,
        center: q.center ?? null,
        available: false,
        message: '장소 검색 연결이 준비되지 않았습니다. 직접 등록은 사용할 수 있어요.',
      },
    };
  }
  try {
    let places: any[];
    let isEnd = true;
    {
      const categoryOnly = !String(q.query ?? '').trim();
      const u = new URL(
        `https://dapi.kakao.com/v2/local/search/${categoryOnly ? 'category' : 'keyword'}.json`,
      );
      if (!categoryOnly) u.searchParams.set('query', q.query);
      else demand(Boolean(center || bounds), 'VALIDATION_ERROR');
      const types: Record<string, string> = {
        restaurant: 'FD6',
        cafe: 'CE7',
        lodging: 'AD5',
        tourism: 'AT4',
      };
      if (types[q.category]) u.searchParams.set('category_group_code', types[q.category]);
      else demand(!categoryOnly, 'VALIDATION_ERROR');
      if (categoryOnly) {
        demand(center, 'VALIDATION_ERROR');
        u.searchParams.set('radius', '2000');
        u.searchParams.set('sort', 'distance');
      } else u.searchParams.set('rect', (bounds ?? [126.75, 37.41, 127.2, 37.72]).join(','));
      u.searchParams.set('size', '15');
      u.searchParams.set('page', String(q.page ?? 1));
      if (center) {
        u.searchParams.set('x', String(center[0]));
        u.searchParams.set('y', String(center[1]));
      }
      if (q.sort === 'distance') u.searchParams.set('sort', 'distance');
      const r = await fetch(u, {
        headers: { Authorization: `KakaoAK ${key}` },
        signal: AbortSignal.timeout(10000),
      });
      demand(r.status !== 429, 'PROVIDER_QUOTA_EXCEEDED', 429);
      demand(r.ok, 'PROVIDER_UNAVAILABLE', 503);
      const data = (await r.json()) as any;
      isEnd = data.meta?.is_end ?? true;
      places = data.documents.map((p: any) => ({
        id: p.id, providerPlaceId: p.id, roadAddress: p.road_address_name, phone: p.phone, category: p.category_name,
        name: p.place_name,
        address: p.road_address_name || p.address_name,
        lat: Number(p.y),
        lng: Number(p.x),
      }));
    }
    const excludedOutsideSeoul = places.filter((p) => !/^서울(?:특별시)?(?:\s|$)/.test(p.address)).length;
    places = places.filter((p) => /^서울(?:특별시)?(?:\s|$)/.test(p.address));
    places = places.map((p) => ({
      ...p,
      distance:
        center && p.lat != null && p.lng != null ? distanceMeters(center, [p.lng, p.lat]) : null,
    }));
    if (q.sort === 'distance')
      places.sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity));
    return {
      places,
      provider, region: '서울특별시', excludedOutsideSeoul, page: Number(q.page ?? 1), isEnd,
      searchContext: { query: q.query, center: q.center ?? null, radiusMeters: !String(q.query ?? '').trim() ? 2000 : null, requestSequence: q.requestSequence, available: true },
    };
  } catch (e) {
    if (e instanceof DomainError) throw e;
    throw new DomainError('PROVIDER_UNAVAILABLE', 503);
  }
}
