/** The four policy rows in Settings, matched to published documents by itemKey or title. */
export const POLICY_ROWS = [
  { key: 'terms', label: '서비스 이용약관' },
  { key: 'privacy', label: '개인정보 처리방침' },
  { key: 'location', label: '위치정보 이용약관' },
  { key: 'policy', label: '서비스 이용정책' },
] as const;
type Doc = { itemKey?: string; title?: string | null; kind?: string };
export function findPolicyDoc<T extends Doc>(docs: T[], key: (typeof POLICY_ROWS)[number]['key']) {
  const k = (d: T) => (d.itemKey ?? '').toLowerCase(),
    t = (d: T) => (d.title ?? '').replace(/\s/g, '');
  const tests: Record<typeof key, (d: T) => boolean> = {
    terms: (d) => ['terms', 'terms-service', 'service-terms'].includes(k(d)) || (t(d).includes('이용약관') && !t(d).includes('위치')),
    privacy: (d) => k(d).startsWith('privacy') || t(d).includes('개인정보'),
    location: (d) => k(d).includes('location') || t(d).includes('위치정보'),
    policy: (d) =>
      (k(d).includes('policy') && !k(d).startsWith('privacy')) || /이용정책|운영정책/.test(t(d)),
  };
  // Prefer the notice (처리방침) over the consent form for the privacy row.
  const hits = docs.filter(tests[key]);
  return key === 'privacy' ? (hits.find((d) => d.kind === 'notice') ?? hits[0]) : hits[0];
}
