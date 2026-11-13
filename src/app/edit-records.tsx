import { useInitialize } from '../lib/effects';
import React, { useState } from 'react';
import { useLocalSearchParams, router } from 'expo-router';
import { Image, ScrollView, Switch, View } from 'react-native';
import { API, api, awaitOperation, currentSession } from '../lib/api';
import { inputText } from '../lib/validation';
import { useAppToast } from '../components/toast-provider';
import { Screen, Sheet, Field, Button, Card, H, P, confirm, useAction } from '../components/ui';
export default function Edit() {
  const p = useLocalSearchParams<{
      ids?: string;
      scheduleId?: string;
      context?: string;
      allOwn?: string;
    }>(),
    [targets, setTargets] = useState<any[]>([]),
    [selected, setSelected] = useState<string[]>(p.ids?.split(',') ?? []),
    [deleting, setDeleting] = useState(false),
    [description, setDescription] = useState(''),
    [date, setDate] = useState(''),
    [visit, setVisit] = useState<string | null>(null),
    [visits, setVisits] = useState<any[]>([]),
    [apply, setApply] = useState({ description: false, recordDate: false, visitId: false }),
    [canEdit, setCanEdit] = useState(false),
    [next, setNext] = useState<string | null>(null);
  const a = useAction();
  const toast = useAppToast();
  let descriptionError = '';
  try { if (apply.description) inputText(description, '설명', 1000, false, true); } catch (e) { descriptionError = (e as Error).message; }
  useInitialize(() => {
    a.run(async () => {
      if (p.allOwn) {
        const r = await api('/me/media?limit=60');
        setTargets(
          r.items.map((i: any) => ({
            ...i.media,
            groupName: i.groupName,
            scheduleTitle: i.scheduleTitle,
          })),
        );
        setNext(r.nextCursor);
        setCanEdit(false);
      } else if (p.scheduleId) {
        const r = await api(`/schedules/${p.scheduleId}/media`);
        setTargets(r.items.filter((m: any) => m.authorUserId === currentSession()?.userId));
        setNext(r.nextCursor);
        const s = await api(`/schedules/${p.scheduleId}`);
        setVisits(s.plan.flatMap((d: any) => d.visits));
        setCanEdit(true);
      } else {
        let all: any[] = [],
          cursor: string | null = null;
        do {
          const r: any = await api(
            `/me/media${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`,
          );
          all.push(...r.items);
          cursor = r.nextCursor;
        } while (cursor && selected.some((id) => !all.some((m) => m.media.id === id)));
        const chosen = all.filter((m) => selected.includes(m.media.id));
        setTargets(chosen.map((m) => ({ ...m.media, groupName: m.groupName, scheduleTitle: m.scheduleTitle })));
        setCanEdit(
          chosen.every((m) => m.membershipState === 'active') &&
            new Set(chosen.map((m) => m.media.scheduleId)).size === 1,
        );
        if (
          chosen.length &&
          new Set(chosen.map((m) => m.media.scheduleId)).size === 1 &&
          chosen.every((m) => m.membershipState === 'active')
        ) {
          const s = await api(`/schedules/${chosen[0].media.scheduleId}`);
          setVisits(s.plan.flatMap((d: any) => d.visits));
        }
      }
    });
  }, []);
  const deletionTargets = targets.filter((m) => selected.includes(m.id));
  const deletionPhotos = deletionTargets.filter((m) => m.kind === 'photo').length;
  const deletionVideos = deletionTargets.filter((m) => m.kind === 'video').length;
  const deletionGroups = [...new Set(deletionTargets.map((m) => m.groupName).filter(Boolean))];
  return (
    <Screen
      title="본인 기록 일괄 수정"
      subtitle="한 번에 최대 120개. 수정은 같은 일정의 본인 파일에 적용됩니다."
    >
      {targets.map((m) => (
        <Card
          key={m.id}
          onPress={() =>
            setSelected((old) =>
              old.includes(m.id)
                ? old.filter((i) => i !== m.id)
                : old.length < 120
                  ? [...old, m.id]
                  : old,
            )
          }
        >
          <Image accessibilityLabel="삭제·수정 대상 기록 미리보기" style={{ width: 96, height: 72, borderRadius: 8 }} source={[{ uri: `${API}/v1/media/${m.id}/content?variant=thumbnail&context=mine`, headers: { Authorization: `Bearer ${currentSession()?.accessToken}` } }]} />
          <H>
            {selected.includes(m.id) ? '✓ ' : ''}
            {m.description || m.recordDate}
          </H>
          <P>
            {m.groupName} {m.scheduleTitle}
          </P>
          <P>
            {m.kind === 'video' ? '영상' : '사진'} · {m.recordDate}
          </P>
        </Card>
      ))}
      {next && (
        <Button
          secondary
          disabled={a.busy}
          onPress={() =>
            a.run(async () => {
              const r = await api(
                p.allOwn
                  ? `/me/media?cursor=${encodeURIComponent(next)}`
                  : `/schedules/${p.scheduleId}/media?cursor=${encodeURIComponent(next)}`,
              );
              setTargets((old) => [
                ...old,
                ...(p.allOwn
                  ? r.items.map((i: any) => ({
                      ...i.media,
                      groupName: i.groupName,
                      scheduleTitle: i.scheduleTitle,
                    }))
                  : r.items.filter((m: any) => m.authorUserId === currentSession()?.userId)),
              ]);
              setNext(r.nextCursor);
            })
          }
        >
          기록 더 불러오기
        </Button>
      )}
      <Button secondary onPress={() => setSelected(targets.slice(0, 120).map((m) => m.id))}>
        불러온 본인 기록 선택 · 최대 120개
      </Button>
      {/* One button per upload batch, told apart by order and size; pointless with a single batch. */}
      {[...new Set(targets.map((m) => m.submissionId))].filter((_, __, all) => all.length > 1).map((submissionId, index) => (
        <Button
          key={submissionId}
          secondary
          onPress={() =>
            setSelected(
              targets
                .filter((m) => m.submissionId === submissionId)
                .slice(0, 120)
                .map((m) => m.id),
            )
          }
        >
          {index + 1}번째 묶음 선택 · {targets.filter((m) => m.submissionId === submissionId).length}개
        </Button>
      ))}
      <H>내 기록 {selected.length}개 수정</H>
      {canEdit && (
        <>
          {(['description', 'recordDate', 'visitId'] as const).map((k) => (
            <View
              key={k}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <P>
                {
                  {
                    description: '설명 변경·비우기',
                    recordDate: '기록일 변경',
                    visitId: '방문 변경·연결 해제',
                  }[k]
                }
              </P>
              <Switch style={{ minWidth: 48, minHeight: 48 }}
                trackColor={{ false: '#D1D6DB', true: '#F9C9C6' }}
                thumbColor={apply[k] ? '#F1706B' : '#FFFFFF'}
                accessibilityLabel={
                  { description: '설명 변경', recordDate: '기록일 변경', visitId: '방문 변경' }[k]
                }
                value={apply[k]}
                onValueChange={(v) => setApply({ ...apply, [k]: v })}
              />
            </View>
          ))}
          {apply.description && (
            <Field
              label="설명 · 빈칸이면 지우기"
              limit={1000}
              helper="설명은 1000자까지 쓸 수 있어요"
              multiline
              value={description}
              onChangeText={setDescription}
            />
          )}
          {!!descriptionError && <P>{descriptionError}</P>}
          {apply.recordDate && (
            <Field
              label="새 기록일"
              value={date}
              onChangeText={(value) => {
                setDate(value);
                setApply({ ...apply, visitId: true });
                setVisit(null);
              }}
            />
          )}
          {apply.recordDate && (
            <P>
              기록일을 바꾸면 방문 연결을 해제합니다. 같은 날짜의 방문을 다시 선택할 수 있습니다.
            </P>
          )}
          {apply.visitId && (
            <>
              <Button secondary onPress={() => setVisit(null)}>
                {visit === null ? '✓ ' : ''}장소 미지정으로 변경
              </Button>
              {visits
                .filter((v) => !apply.recordDate || v.visitDate === date)
                .map((v) => (
                  <Button secondary={visit !== v.id} key={v.id} onPress={() => setVisit(v.id)}>
                    {v.visitDate} · {v.name}
                  </Button>
                ))}
            </>
          )}
          <Button
            disabled={a.busy || !selected.length || !!descriptionError || !Object.values(apply).some(Boolean)}
            onPress={() =>
              confirm(
                '선택한 기록을 변경할까요?',
                `${selected.length}개 파일의 선택한 필드를 덮어씁니다.`,
                () =>
                  a.run(async () => {
                    const fields: any = {};
                    if (apply.description) fields.description = { apply: true, value: inputText(description, '설명', 1000, false, true) };
                    if (apply.recordDate) fields.recordDate = { apply: true, value: date };
                    if (apply.visitId) fields.visitId = { apply: true, value: visit };
                    await awaitOperation(
                      await api('/media/metadata-changes', {
                        targets: targets
                          .filter((m) => selected.includes(m.id))
                          .map((m) => ({ id: m.id, expectedVersion: m.version })),
                        fields,
                      }),
                    );
                    toast('기록 정보를 바꿨어요');
                    router.back();
                  }),
              )
            }
          >
            선택한 정보 일괄 적용
          </Button>
        </>
      )}
      <Button secondary disabled={!selected.length || a.busy} onPress={() => setDeleting(true)}>선택한 본인 기록 삭제</Button>
      <Sheet visible={deleting} title="서버 기록을 삭제할까요?" onClose={() => { if (!a.busy) setDeleting(false); }}>
        <P>사진 {deletionPhotos}개 · 동영상 {deletionVideos}개를 삭제해요. 복구할 수 없으며 기기 앨범 원본은 유지됩니다.</P>
        {deletionGroups.length > 0 && <P>모임: {deletionGroups.join(', ')}</P>}
        <ScrollView horizontal contentContainerStyle={{ gap: 8 }}>
          {deletionTargets.map((m) => <View key={m.id} style={{ width: 96 }}>
            <Image accessibilityLabel="삭제 대상 미리보기" style={{ width: 96, height: 72 }} source={[{ uri: `${API}/v1/media/${m.id}/content?variant=thumbnail&context=mine`, headers: { Authorization: `Bearer ${currentSession()?.accessToken}` } }]} />
            <P>{m.kind === 'video' ? '동영상' : '사진'} · {m.recordDate}</P>
          </View>)}
        </ScrollView>
        <Button disabled={a.busy} onPress={() => a.run(async () => {
          const r = await api('/media/deletions', { mediaIds: selected });
          const failed = r.results.filter((r: any) => r.status === 'failed');
          if (failed.length) {
            setSelected(failed.map((r: any) => r.id));
            throw new Error(`${failed.length}개 삭제에 실패했습니다. 실패 파일만 다시 시도해 주세요.`);
          }
          setDeleting(false); toast('기록을 삭제했어요'); router.back();
        })}>삭제</Button>
        <Button secondary disabled={a.busy} onPress={() => setDeleting(false)}>돌아가기</Button>
        {a.errorView}
      </Sheet>
      {a.errorCode === 'VERSION_CONFLICT' && (
        <Button
          secondary
          onPress={() =>
            a.run(async () => {
              const latest: any[] = [];
              for (const id of selected)
                latest.push((await api(`/media/${id}?context=mine`)).media);
              setTargets((old) => old.map((m) => latest.find((n) => n.id === m.id) ?? m));
            })
          }
        >
          선택 파일의 최신 정보 확인 · 변경 입력 유지
        </Button>
      )}
      {a.errorView}
    </Screen>
  );
}
