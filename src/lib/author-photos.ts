/** Collect all pages in the visible record scope; never silently save just the loaded page. */
export async function authorPhotoIds(authorUserId: string, fetchPage: (cursor: string | null) => Promise<{ items: { id: string; authorUserId: string; kind: string; accessState: string }[]; nextCursor: string | null }>) {
  const ids = new Set<string>(), cursors = new Set<string>();
  let cursor: string | null = null;
  do {
    const page = await fetchPage(cursor);
    for (const m of page.items) if (m.authorUserId === authorUserId && m.kind === 'photo' && m.accessState === 'available') ids.add(m.id);
    if (ids.size > 120) throw new Error('한 번에 120개까지 저장할 수 있어요. 날짜나 장소를 골라 다시 시도해 주세요.');
    cursor = page.nextCursor;
    if (cursor && cursors.has(cursor)) throw new Error('사진 목록을 다시 불러와 주세요.');
    if (cursor) cursors.add(cursor);
  } while (cursor);
  return [...ids];
}
