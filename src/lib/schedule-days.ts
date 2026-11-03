export function scheduleDays(start: string, end: string, plans: any[]) {
  const days: any[] = [];
  const first = Date.parse(`${start}T00:00:00Z`),
    last = Date.parse(`${end}T00:00:00Z`);
  if (
    !Number.isFinite(first) ||
    !Number.isFinite(last) ||
    last < first ||
    (last - first) / 86400000 >= 366
  )
    throw new Error('일정 기간을 확인해 주세요.');
  const byDate = new Map(plans.map((p) => [p.date, p]));
  for (let value = first; value <= last; value += 86400000) {
    const date = new Date(value).toISOString().slice(0, 10);
    days.push(
      byDate.get(date) ?? { date, title: '', visits: [], visitCount: 0, outsideRange: false },
    );
  }
  return [
    ...days,
    ...plans
      .filter((p) => p.date < start || p.date > end)
      .map((p) => ({ ...p, outsideRange: true })),
  ];
}
