import { useInitialize } from '../../lib/effects';
import React, { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { api, awaitOperation, ApiError } from '../../lib/api';
import { inputText, validPeriod } from '../../lib/validation';
import { useDraft } from '../../lib/state';
import { Screen, Field, Button, confirm, P, useAction } from '../../components/ui';
export default function EditSchedule() {
  const { id, groupId } = useLocalSearchParams<{ id?: string; groupId?: string }>(),
    [version, setVersion] = useState(1),
    [v, set, clear, draft] = useDraft(`schedule:${id ?? groupId ?? 'new'}`, {
      title: '',
      startDate: new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' }),
      endDate: new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' }),
    }),
    a = useAction();
  const [actualGroup, setActualGroup] = useState(groupId ?? ''), [latest, setLatest] = useState<any>(null);
  useInitialize(() => {
    if (id && draft.ready)
      a.run(async () => {
        const r = await api(`/schedules/${id}`);
        setVersion(r.schedule.version); setActualGroup(r.schedule.groupId);
        if (!draft.hasDraft) for (const k of ['title', 'startDate', 'endDate']) set(k, r.schedule[k]);
      });
  }, [id, draft.ready]);
  async function save(confirmed = false, overlapConfirmed = false) {
    await a.run(async () => {
      try {
        inputText(v.title, '일정 제목', 100); validPeriod(v.startDate, v.endDate);
        if (!overlapConfirmed) {
          const calendar = await api(`/groups/${actualGroup}/calendar?from=${v.startDate}&to=${v.endDate}`);
          const overlaps = calendar.schedules.filter((s: any) => s.id !== id && s.status !== 'cancelled');
          if (overlaps.length) { confirm('기간이 겹치는 일정이 있습니다', overlaps.map((s: any) => `${s.title} · ${s.startDate}~${s.endDate}`).join('\n') + '\n별도 일정으로 저장할까요?', () => save(confirmed, true)); return; }
        }
        if (id)
          await awaitOperation(
            await api(
              `/schedules/${id}`,
              { ...v, expectedVersion: version, confirmOutsideRange: confirmed },
              'PATCH',
            ),
          );
        else
          await awaitOperation(
            await api(`/groups/${groupId}/schedules`, { ...v, timezone: 'Asia/Seoul' }),
          );
        await clear();
        router.back();
      } catch (e) {
        if (e instanceof ApiError && e.code === 'OUTSIDE_RANGE_CONFIRMATION_REQUIRED') {
          confirm(
            '기간 밖 기록을 유지할까요?',
            `방문 ${e.details.visits}개 · 기록 ${e.details.media}개가 새 기간 밖에 남습니다.`,
            () => save(true, overlapConfirmed),
          );
        } else { if (id && e instanceof ApiError && e.code === 'VERSION_CONFLICT') setLatest((await api(`/schedules/${id}`)).schedule); throw e; }
      }
    });
  }
  return (
    <Screen
      title={id ? '일정 변경' : '일정 추가'}
      subtitle="날짜는 한국 시간을 기준으로 표시합니다."
    >
      <Field label="일정 제목" value={v.title} onChangeText={(t) => set('title', t)} />
      <Field label="시작 날짜" value={v.startDate} onChangeText={(t) => set('startDate', t)} />
      <Field label="종료 날짜" value={v.endDate} onChangeText={(t) => set('endDate', t)} />
      <P>겹치는 일정도 추가할 수 있어요. 장소별 시간은 장소를 추가할 때 정합니다.</P>
      {latest && <><P>최신 일정: {latest.title} · {latest.startDate}~{latest.endDate} · 버전 {latest.version}</P><Button secondary onPress={() => confirm('내 입력으로 다시 적용할까요?', '최신 버전을 기준으로 현재 입력한 제목·기간을 저장할 준비를 합니다. 내용을 확인한 뒤 저장해 주세요.', () => { setVersion(latest.version); setLatest(null); })}>입력 유지·최신 버전으로 다시 준비</Button></>}
      <Button disabled={a.busy || !draft.ready} onPress={() => save()}>
        저장
      </Button>
      {a.errorView}
    </Screen>
  );
}
