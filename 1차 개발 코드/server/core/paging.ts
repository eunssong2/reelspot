import { readCursor, signCursor, hash } from './crypto.js';
import { demand, DomainError } from './errors.js';
export function page<T>(
  items: T[],
  q: Record<string, any>,
  actor: string,
  scope: string,
  key: (item: T) => string,
  max = 60,
  snapshotOverride?: string,
) {
  const filter = hash(
    JSON.stringify(
      Object.fromEntries(
        Object.entries(q)
          .filter(([k]) => !['cursor', 'limit'].includes(k))
          .sort(),
      ),
    ) + scope,
  );
  let cur: { actor: string; filter: string; last: string; snapshotAt: string } | undefined;
  if (q.cursor) {
    try {
      cur = readCursor(q.cursor);
    } catch {
      throw new DomainError('INVALID_CURSOR');
    }
    demand(cur?.actor === actor && cur.filter === filter, 'INVALID_CURSOR');
  }
  const limit = Math.min(Number(q.limit) || max, max),
    snapshotAt = cur?.snapshotAt ?? snapshotOverride ?? new Date().toISOString();
  const sorted = items.sort((a, b) => key(a).localeCompare(key(b))),
    filtered = cur ? sorted.filter((i) => key(i) > cur!.last) : sorted;
  const result = filtered.slice(0, limit);
  return {
    items: result,
    nextCursor:
      filtered.length > limit
        ? signCursor({ actor, filter, last: key(result.at(-1)!), snapshotAt })
        : null,
    snapshotAt,
  };
}
