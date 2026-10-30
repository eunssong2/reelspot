import React, { useState } from 'react';
import { Image, Text, View, Pressable, Alert } from 'react-native';
import { router } from 'expo-router';
import { API, api, currentSession, type Media } from '../lib/api';
import { formatMoment } from '../lib/preferences';
import { Button, P, colors, s, useAction } from './ui';
export function Records({
  items,
  context = 'shared',
  allowSave = true,
  groups,
}: {
  items: Media[];
  context?: 'shared' | 'mine';
  allowSave?: boolean;
  groups?: { authorUserId: string; displayName: string; photos: number; videos: number }[];
}) {
  const [selection, setSelected] = useState<string[]>([]),
    [mode, setMode] = useState(false);
  const [folded, setFolded] = useState<string[]>([]);
  const own = currentSession()?.userId;
  const batchAction = useAction();
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
  const renderItems = (list: Media[]) => (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
      {list.map((m) => (
        <Pressable
          accessibilityLabel={`${m.displayName ?? '내'} ${m.kind === 'video' ? '영상' : '사진'}${selected.includes(m.id) ? ' 선택됨' : ''}`}
          accessibilityRole={mode ? 'checkbox' : 'button'}
          accessibilityState={mode ? { checked: selected.includes(m.id) } : undefined}
          key={m.id}
          onLongPress={() => {
            setMode(true);
            toggle(m.id);
          }}
          onPress={() =>
            mode
              ? toggle(m.id)
              : m.accessState !== 'available'
                ? undefined
                : router.push({
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
                        capturedAt: m.capturedAt,
                        completedAt: m.completedAt,
                        retentionLastDate: m.retentionLastDate,
                      }),
                    },
                  })
          }
          style={{
            width: groups?.length ? '48%' : '100%',
            backgroundColor: colors.paper,
            borderRadius: 12,
            borderWidth: selected.includes(m.id) ? 3 : 1,
            borderColor: selected.includes(m.id) ? colors.accent : colors.line,
            overflow: 'hidden',
            marginBottom: 6,
          }}
        >
          {m.accessState !== 'available' ? (
            <View style={{ height: 145, padding: 16 }}>
              <P>
                {m.accessState === 'expired'
                  ? '보관 기한이 만료된 기록입니다.'
                  : '현재 열람할 수 없는 기록입니다.'}
              </P>
            </View>
          ) : (
            <Image
              accessibilityLabel="기록 미리보기"
              source={[
                {
                  uri: `${API}/v1/media/${m.id}/content?variant=thumbnail&context=${context}&cacheScope=${currentSession()?.userId}&cacheVersion=${m.version}`,
                  headers: { Authorization: `Bearer ${currentSession()?.accessToken}` },
                },
              ]}
              style={{ aspectRatio: groups?.length ? 1 : 4 / 3, backgroundColor: '#F2F4F6' }}
            />
          )}
          {mode && (
            <View
              style={{
                position: 'absolute',
                top: 10,
                right: 10,
                width: 28,
                height: 28,
                borderRadius: 14,
                backgroundColor: selected.includes(m.id) ? colors.accent : '#FFFFFF',
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 1,
                borderColor: colors.line,
              }}
            >
              <Text style={{ color: selected.includes(m.id) ? 'white' : colors.muted }}>
                {selected.includes(m.id) ? '✓' : '○'}
              </Text>
            </View>
          )}
          <View style={{ padding: 11 }}>
            <Text style={{ fontSize: 12, color: colors.ink }}>
              {mode && selected.includes(m.id) ? '✓ ' : ''}
              {m.displayName ?? '내 기록'}
              {m.kind === 'video'
                ? ` · ▶ ${m.durationMs == null ? '영상' : `${(m.durationMs / 1000).toFixed(1)}초`}`
                : ' · 사진'}
            </Text>
            <Text numberOfLines={2} style={{ fontSize: 11, color: colors.muted, marginTop: 5 }}>
              {m.description || '설명 없음'}
            </Text>
            <Text style={{ fontSize: 11, color: colors.muted }}>
              기록일 {m.recordDate} · {m.visitName || '장소 미지정'}
            </Text>
            <Text style={{ fontSize: 11, color: colors.muted }}>
              {m.capturedAt ? '촬영 시각' : '업로드 시각'}{' '}
              {formatMoment(m.capturedAt ?? m.completedAt)}
            </Text>
          </View>
        </Pressable>
      ))}
    </View>
  );
  return (
    <>
      <View style={s.row}>
        <Button
          secondary
          onPress={() => {
            setMode(!mode);
            setSelected([]);
          }}
        >
          {mode ? '선택 끝내기' : '여러 기록 선택'}
        </Button>
        {mode && (
          <Button secondary onPress={() => setSelected(items.slice(0, 120).map((i) => i.id))}>
            불러온 기록 선택
          </Button>
        )}
      </View>
      {groups?.length
        ? groups.map((g) => (
            <View key={g.authorUserId}>
              <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${g.displayName} 기록 메뉴`}
                  style={{
                    minWidth: 48,
                    minHeight: 48,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  onPress={() =>
                    Alert.alert(
                      `${g.displayName}의 기록`,
                      '현재 불러온 기록 중 최대 120개를 선택합니다.',
                      [
                        { text: '취소', style: 'cancel' },
                        {
                          text: '이 사람 기록 선택',
                          onPress: () => {
                            setMode(true);
                            setSelected(
                              items
                                .filter((m) => m.authorUserId === g.authorUserId)
                                .slice(0, 120)
                                .map((m) => m.id),
                            );
                          },
                        },
                      ],
                    )
                  }
                >
                  <Text style={{ fontSize: 24, color: colors.ink }}>⋯</Text>
                </Pressable>
              </View>
              <Button
                secondary
                onPress={() =>
                  setFolded((old) =>
                    old.includes(g.authorUserId)
                      ? old.filter((id) => id !== g.authorUserId)
                      : [...old, g.authorUserId],
                  )
                }
              >
                {folded.includes(g.authorUserId) ? '▸' : '▾'} {g.displayName} · 사진 {g.photos} /
                영상 {g.videos}
              </Button>
              {!folded.includes(g.authorUserId) &&
                renderItems(items.filter((m) => m.authorUserId === g.authorUserId))}
            </View>
          ))
        : renderItems(items)}
      {mode && (
        <>
          <P>{selected.length}개 선택 · 최대 120개</P>
          {[...new Set(items.map((m) => m.submissionId))].map((submissionId) => (
            <Button
              key={submissionId}
              secondary
              onPress={() =>
                setSelected(
                  items
                    .filter((m) => m.submissionId === submissionId)
                    .slice(0, 120)
                    .map((m) => m.id),
                )
              }
            >
              같은 제출 묶음 선택 · {items.filter((m) => m.submissionId === submissionId).length}개
            </Button>
          ))}
          {allowSave &&
            [...new Set(items.map((m) => m.submissionId))].map((submissionId) => (
              <Button
                key={submissionId}
                secondary
                disabled={batchAction.busy}
                onPress={() => saveBatch(items.find((m) => m.submissionId === submissionId)!)}
              >
                같은 제출 묶음의 완료 파일 모두 저장
              </Button>
            ))}
          {batchAction.errorView}
          {allowSave &&
            selected.every((id) => items.find((m) => m.id === id)?.accessState === 'available') && (
              <Button
                disabled={!selected.length}
                onPress={() =>
                  router.push({ pathname: '/save', params: { ids: selected.join(',') } })
                }
              >
                휴대폰 저장
              </Button>
            )}
          <Button
            secondary
            disabled={
              !selected.length ||
              selected.some((id) => items.find((m) => m.id === id)?.authorUserId !== own)
            }
            onPress={() =>
              router.push({
                pathname: '/edit-records',
                params: { ids: selected.join(','), context },
              })
            }
          >
            본인 기록 수정·삭제
          </Button>
        </>
      )}
      {!items.length && <P>아직 기록이 없어요.</P>}
    </>
  );
}
