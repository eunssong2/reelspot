/** 두 좌표 사이 직선거리(m). 하버사인 공식. */
export function distanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371000;
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** 1km 미만은 m, 이상은 km (10km 이상은 정수). */
export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters / 10) * 10 || 10}m`;
  const km = meters / 1000;
  return km >= 10 ? `${Math.round(km)}km` : `${km.toFixed(1)}km`;
}
