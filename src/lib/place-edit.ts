export type VisitValues = {
  name: string;
  address: string;
  lat: number | null;
  lng: number | null;
  plannedTime: string | null;
};
/**
 * Request body for a place edit: only what the user changed. Omitted values stay as they are
 * on the server, so switching modes never drops a pin or an address the user did not touch.
 */
export function visitChanges(original: VisitValues, next: VisitValues) {
  const body: Record<string, unknown> = {};
  if (next.name !== original.name) body.name = next.name;
  if (next.address !== (original.address ?? '')) body.address = next.address || null;
  const same = (a: number | null, b: number | null) =>
    a == null || b == null ? a == null && b == null : Math.abs(a - b) < 0.0000005;
  if (!same(next.lat, original.lat) || !same(next.lng, original.lng))
    body.location = next.lat == null || next.lng == null ? null : { lat: next.lat, lng: next.lng };
  if (next.plannedTime !== original.plannedTime) body.plannedTime = next.plannedTime;
  return body;
}
