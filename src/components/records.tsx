import React, { useState } from 'react';
import { Image, Text, View, Pressable, type ImageStyle } from 'react-native';
import { router } from 'expo-router';
import { API, api, currentSession, type Media } from '../lib/api';
import { authorPhotoIds } from '../lib/author-photos';
import { Avatar } from './profile-ui';
import { formatDuration, monthDayTime } from '../lib/day-labels';
import { Button, CheckCircle, P, Sheet, colors, TextButton, ScreenFooter, useAction } from './ui';
type AuthorGroup = {
  authorUserId: string;
  displayName: string;
  photos: number;
  videos: number;
  avatarVersion?: number | null;
};
const thumb = (m: Media, context: string) => [
  {
    uri: `${API}/v1/media/${m.id}/content?variant=thumbnail&context=${context}&cacheScope=${currentSession()?.userId}&cacheVersion=${m.version}`,
    headers: { Authorization: `Bearer ${currentSession()?.accessToken}` },
  },
];
function RecordImage({ m, context, style }: { m: Media; context: string; style: ImageStyle }) {
  const [failed, setFailed] = useState(false);
  return failed ? <View style={[style, { justifyContent: 'center', padding: 10 }]}><Text>🖼️ 이미지를 불러오지 못했어요</Text></View> : <Image accessibilityLabel="기록 미리보기" source={thumb(m, context)} style={style} onError={() => setFailed(true)} />;
}
function VideoBadge({ m }: { m: Media }) {
  if (m.kind !== 'video') return null;
  return (
    <View
      style={{
        position: 'absolute',
        top: 10,
        left: 10,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: '#191F28B3',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 14,
      }}
    >
      <Text style={{ color: 'white', fontSize: 12, fontWeight: '800' }}>
        ▶ {formatDuration(m.durationMs) || '영상'}
      </Text>
    </View>
  );
}
/** Icon segmented toggle: grid (by time) / person (by author). */
export function ViewToggle({ view, onView }: { view: string; onView: (v: string) => void }) {
  return (
    <View style={{ flexDirection: 'row', backgroundColor: colors.surface, borderRadius: 18, padding: 4 }}>
      {(
        [
          ['by_photo', '▦', '사진별 보기'],
          ['by_author', '👤', '사람별 보기'],
        ] as const
      ).map(([value, icon, label]) => (
        <Pressable
          key={value}
          accessibilityRole="tab"
          accessibilityLabel={label}
          accessibilityState={{ selected: view === value }}
          onPress={() => onView(value)}
          style={{
            width: 44,
            height: 34,
            borderRadius: 14,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: view === value ? 'white' : 'transparent',
          }}
        >
          <Text style={{ fontSize: 17, color: view === value ? colors.ink : colors.muted, opacity: view === value ? 1 : 0.55 }}>
            {icon}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
export function Records({
  items,
  context = 'shared',
  allowSave = true,
  groups,
  avatars = {},
  toolbar,
  recordScope,
}: {
  items: Media[];
  recordScope?: { scheduleId: string; query: Record<string, string> };
  context?: 'shared' | 'mine';
  allowSave?: boolean;
  groups?: AuthorGroup[];
  /** userId → avatarVersion, for author photos. */
  avatars?: Record<string, number | null | undefined>;
  /** View/sort controls shown above the list (place records screen). */
  toolbar?: { view: string; onView: (v: string) => void; order: string; onOrder: (o: string) => void };
}) {
  const [selection, setSelected] = useState<string[]>([]),
    [mode, setMode] = useState(false),
    [expanded, setExpanded] = useState<string[]>([]),
    [authorMenu, setAuthorMenu] = useState<AuthorGroup | null>(null);
  const own = currentSession()?.userId;
  const batchAction = useAction();
  const byAuthor = !!groups?.length;
  async function saveBatch(example: Media) {
    await batchAction.run(async () => {
      const ids: string[] = [];
      let cursor: string | null = null;
      do {
        const r: any = await api(
          `/schedules/${example.scheduleId}/media${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`,
        );
        ids.push(
          ...r.items
            .filter((m: Media) => m.submissionId === example.submissionId)
            .map((m: Media) => m.id),
        );
        cursor = r.nextCursor;
      } while (cursor && ids.length < 120);
      if (!ids.length)
        throw new Error(
          '이 제출 묶음에 저장 가능한 완료 파일이 없습니다. 현재 권한과 파일 상태를 확인해 주세요.',
        );
      router.push({ pathname: '/save', params: { ids: ids.slice(0, 120).join(',') } });
    });
  }
  const selected = selection.filter((id) => items.some((m) => m.id === id));
  function toggle(id: string) {
    setSelected((old) =>
      old.includes(id)
        ? old.filter((x) => x !== id && items.some((m) => m.id === x))
        : selected.length < 120
          ? [...selected, id]
          : selected,
    );
  }
  function open(m: Media) {
    if (mode) return toggle(m.id);
    if (m.accessState !== 'available') return;
    router.push({
      pathname: '/record/[id]',
      params: {
        id: m.id,
        kind: m.kind,
        context,
        allowSave: String(allowSave),
        authorUserId: m.authorUserId,
        metadata: JSON.stringify({
          description: m.description,
          recordDate: m.recordDate,
          visitName: m.visitName,
          displayName: m.displayName,
          sortAt: m.sortAt,
          completedAt: m.completedAt,
          retentionLastDate: m.retentionLastDate,
        }),
      },
    });
  }
  const unavailable = (m: Media, height?: number) => (
    <View style={{ height, aspectRatio: height ? undefined : 1, padding: 14, backgroundColor: colors.surface }}>
      <P>
        {m.accessState === 'expired' ? '보관 기한이 만료된 기록입니다.' : '현재 열람할 수 없는 기록입니다.'}
      </P>
    </View>
  );
  // Photo cards (screen 16): image, author avatar, "방금 전 · 이름", description.
  const card = (m: Media) => {
    const on = selected.includes(m.id);
    return (
      <Pressable
        key={m.id}
        accessibilityLabel={`${m.displayName ?? '내'} ${m.kind === 'video' ? '영상' : '사진'}${on ? ' 선택됨' : ''}`}
        accessibilityRole={mode ? 'checkbox' : 'button'}
        accessibilityState={mode ? { checked: on } : undefined}
        onLongPress={() => {
          setMode(true);
          toggle(m.id);
        }}
        onPress={() => open(m)}
        style={{
          borderRadius: 22,
          overflow: 'hidden',
          marginBottom: 14,
          backgroundColor: colors.surface,
          borderWidth: on ? 3 : 0,
          borderColor: colors.accent,
        }}
      >
        {m.accessState !== 'available' ? (
          unavailable(m, 160)
        ) : (
          <RecordImage m={m} context={context} style={{ aspectRatio: 4 / 3 }} />
        )}
        <VideoBadge m={m} />
        {mode && (
          <View style={{ position: 'absolute', top: 12, right: 12 }}>
            <CheckCircle checked={on} size={30} />
          </View>
        )}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            padding: 12,
            backgroundColor: '#FFFFFFE6',
          }}
        >
          <Avatar
            initial
            name={m.displayName ?? '나'}
            size={32}
            userId={m.authorUserId}
            avatarVersion={avatars[m.authorUserId]}
          />
          <View style={{ flex: 1 }}>
            <Text numberOfLines={1} style={{ fontSize: 13, fontWeight: '800', color: colors.ink }}>
              {monthDayTime(m.sortAt).slice(-5)}
              {' · '}
              {m.displayName ?? '내 기록'}
            </Text>
            {!!m.description && (
              <Text numberOfLines={1} style={{ fontSize: 13, color: colors.sub, marginTop: 2 }}>
                {m.description}
              </Text>
            )}
          </View>
        </View>
      </Pressable>
    );
  };
  const tile = (m: Media, more?: number, onMore?: () => void, wide?: number) => (
    <Pressable
      key={m.id}
      accessibilityRole="button"
      accessibilityLabel={more ? `${more}개 더 보기` : `${m.kind === 'video' ? '영상' : '사진'} 보기`}
      onPress={() => (onMore ? onMore() : open(m))}
      style={{ width: wide ? '100%' : '48.5%', aspectRatio: wide || 1, borderRadius: 16, overflow: 'hidden', backgroundColor: colors.surface }}
    >
      {m.accessState !== 'available' ? (
        unavailable(m)
      ) : (
        <RecordImage m={m} context={context} style={{ width: '100%', height: '100%' }} />
      )}
      {!more && <VideoBadge m={m} />}
      {!!more && (
        <View
          style={{
            ...({ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 } as const),
            backgroundColor: '#191F2899',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ color: 'white', fontSize: 28, fontWeight: '900' }}>+{more}</Text>
        </View>
      )}
    </Pressable>
  );
  // Author cards (screen 17): 2×2 grid, "+N" expands, "접기" folds.
  const authorCard = (g: AuthorGroup) => {
    const list = items.filter((m) => m.authorUserId === g.authorUserId),
      isOpen = expanded.includes(g.authorUserId),
      latest = list.map((m) => m.sortAt ?? '').sort().pop();
    const shown = isOpen || list.length <= 4 ? list : list.slice(0, 4);
    const fold = () =>
      setExpanded((old) =>
        old.includes(g.authorUserId) ? old.filter((x) => x !== g.authorUserId) : [...old, g.authorUserId],
      );
    return (
      <View
        key={g.authorUserId}
        style={{
          backgroundColor: 'white',
          borderRadius: 22,
          borderWidth: 1,
          borderColor: colors.line,
          padding: 14,
          marginBottom: 14,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <Avatar
            initial
            name={g.displayName}
            size={44}
            userId={g.authorUserId}
            avatarVersion={g.avatarVersion ?? avatars[g.authorUserId]}
          />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 16, fontWeight: '800', color: colors.ink }}>{g.displayName}</Text>
            <Text style={{ fontSize: 12, color: colors.muted, marginTop: 2 }}>
              사진 {g.photos}
              {g.videos ? ` · 동영상 ${g.videos}` : ''}
              {latest ? ` · ${monthDayTime(latest).slice(-5)}` : ''}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${g.displayName} 기록 메뉴`}
            onPress={() => setAuthorMenu(g)}
            style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}
          >
            <Text style={{ fontSize: 20, color: colors.sub }}>⋯</Text>
          </Pressable>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {shown.map((m, i) =>
            !isOpen && list.length > 4 && i === 3 ? tile(m, list.length - 3, fold) : tile(m, undefined, undefined, list.length === 1 ? 4 / 3 : !isOpen && list.length === 3 && i === 0 ? 2 : undefined),
          )}
        </View>
        {isOpen && list.length > 4 && (
          <TextButton color={colors.sub} onPress={fold}>
            접기 ▴
          </TextButton>
        )}
        {!list.length && <P>불러온 기록이 없어요.</P>}
      </View>
    );
  };
  const authorMedia = authorMenu
    ? items.filter(
        (m) => m.authorUserId === authorMenu.authorUserId && ['photo', 'video'].includes(m.kind) && m.accessState === 'available',
      )
    : [];
  const authorSaveCount = recordScope
    ? (authorMenu?.photos ?? 0) + (authorMenu?.videos ?? 0)
    : new Set(authorMedia.map((m) => m.id)).size;
  return (
    <>
      {toolbar && items.length > 0 ? (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: 4,
            marginBottom: 14,
          }}
        >
          <ViewToggle
            view={toolbar.view}
            onView={(v) => {
              setMode(false);
              setSelected([]);
              toolbar.onView(v);
            }}
          />
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            {mode ? (
              <TextButton
                color={colors.sub}
                onPress={() => setSelected(items.filter((i) => i.accessState === 'available').slice(0, 120).map((i) => i.id))}
              >
                전체 선택
              </TextButton>
            ) : (
              <TextButton
                color={colors.sub}
                onPress={() => toolbar.onOrder(toolbar.order === 'desc' ? 'asc' : 'desc')}
              >
                {toolbar.order === 'desc' ? '최신순' : '오래된순'}
              </TextButton>
            )}
            {!byAuthor && allowSave && (
              <TextButton
                color={colors.sub}
                onPress={() => {
                  setMode(!mode);
                  setSelected([]);
                }}
              >
                {mode ? '취소' : '선택'}
              </TextButton>
            )}
          </View>
        </View>
      ) : !toolbar && items.length > 0 ? (
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
          <TextButton
            onPress={() => {
              setMode(!mode);
              setSelected([]);
            }}
          >
            {mode ? '취소' : '선택'}
          </TextButton>
        </View>
      ) : null}
      {byAuthor ? groups!.filter((g) => items.some((m) => m.authorUserId === g.authorUserId)).map(authorCard) : items.map(card)}
      <Sheet
        visible={!!authorMenu}
        title={authorMenu ? `${authorMenu.displayName}의 기록` : ''}
        onClose={() => setAuthorMenu(null)}
      >
        {batchAction.errorView}
        {allowSave && (
          <Button
            disabled={batchAction.busy || !authorSaveCount}
            onPress={() => batchAction.run(async () => {
              const ids = recordScope ? await authorPhotoIds(authorMenu!.authorUserId, async (cursor) => {
                const query = new URLSearchParams(recordScope.query);
                if (cursor) query.set('cursor', cursor);
                return api(`/schedules/${recordScope.scheduleId}/media?${query}`);
              }) : [...new Set(authorMedia.map((m) => m.id))];
              if (!ids.length) throw new Error('지금 저장할 수 있는 사진·동영상이 없어요.');
              setAuthorMenu(null);
              router.push({ pathname: '/save', params: { ids: ids.join(',') } });
            })}
          >
            {authorSaveCount ? `사진 다운받기 · ${authorSaveCount}개` : '받을 수 있는 사진·동영상이 없어요'}
          </Button>
        )}
        {authorMenu?.authorUserId === own && (
          <Button
            secondary
            onPress={() => {
              const ids = items.filter((m) => m.authorUserId === own).slice(0, 120).map((m) => m.id);
              setAuthorMenu(null);
              router.push({ pathname: '/edit-records', params: { ids: ids.join(','), context } });
            }}
          >
            내 기록 수정·삭제
          </Button>
        )}
        <Button secondary onPress={() => setAuthorMenu(null)}>
          닫기
        </Button>
      </Sheet>
      {mode && (
        <>
          {[...new Set(items.map((m) => m.submissionId))].length > 1 &&
            allowSave &&
            selected.length === 1 && (
              <Button
                secondary
                small
                disabled={batchAction.busy}
                onPress={() => saveBatch(items.find((m) => m.id === selected[0])!)}
              >
                같은 묶음으로 올린 파일 모두 저장
              </Button>
            )}
          {batchAction.errorView}
          <ScreenFooter>
            <View>
              {selected.length > 0 &&
                selected.every((id) => items.find((m) => m.id === id)?.authorUserId === own) && (
                  <TextButton
                    color={colors.sub}
                    onPress={() =>
                      router.push({
                        pathname: '/edit-records',
                        params: { ids: selected.join(','), context },
                      })
                    }
                  >
                    선택한 내 기록 수정·삭제 ›
                  </TextButton>
                )}
              {allowSave ? (
                <Button
                  disabled={
                    !selected.length ||
                    !selected.every((id) => items.find((m) => m.id === id)?.accessState === 'available')
                  }
                  onPress={() => router.push({ pathname: '/save', params: { ids: selected.join(',') } })}
                >
                  {selected.length ? `${selected.length}개 다운받기` : '다운받을 기록을 선택해 주세요'}
                </Button>
              ) : (
                <P>{selected.length}개 선택</P>
              )}
            </View>
          </ScreenFooter>
        </>
      )}
      {!items.length && <P>아직 기록이 없어요.</P>}
    </>
  );
}
