import { useInitialize } from '../../lib/effects';
import React, { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { api, awaitOperation, ApiError, getGroup, PendingOperationError } from '../../lib/api';
import { inputText, validPeriod } from '../../lib/validation';
import { useDraft, useAccount } from '../../lib/state';
import { useFormExit } from '../../lib/unsaved';
import { PeriodPicker } from '../../components/period-picker';
import { todayInSeoul } from '../../lib/preferences';
import { addDays } from '../../lib/calendar';
import { datesBetween, groupDays, shortDate } from '../../lib/day-labels';
import { View, Text } from 'react-native';
import { Screen, Field, Button, Card, confirm, P, colors, useAction } from '../../components/ui';
export default function EditSchedule() {
  const { id, groupId, date } = useLocalSearchParams<{
      id?: string;
      groupId?: string;
      date?: string;
    }>(),
    { session } = useAccount();
  const [version, setVersion] = useState(1),
    [v, set, clear, draft] = useDraft(`schedule:${id ?? groupId ?? 'new'}`, {
      title: '',
      startDate: date ?? todayInSeoul(),
      endDate: date ?? todayInSeoul(),
      pending: '',
      pendingBody: '',
    }),
    a = useAction({ inlineRetry: false });
  const [actualGroup, setActualGroup] = useState(groupId ?? ''),
    [latest, setLatest] = useState<any>(null),
    [detail, setDetail] = useState<any>(null),
    [allowed, setAllowed] = useState(false),
    [dirty, setDirty] = useState(false),
    [groupName, setGroupName] = useState(''),
    [ownerName, setOwnerName] = useState(''),
    [takenDays, setTakenDays] = useState<ReturnType<typeof groupDays>>([]);
  const pending = v.pending === 'yes',
    leave = useFormExit(dirty || draft.hasDraft || pending, clear, pending);
  useInitialize(() => {
    if (!draft.ready || !session) return;
    void a.run(async () => {
      const r = id ? await api(`/schedules/${id}`) : null;
      if (r && groupId && r.schedule.groupId !== groupId)
        throw new Error('이 모임에 속한 일정이 아닙니다.');
      const gid = r?.schedule.groupId ?? groupId;
      if (!gid) throw new Error('모임을 다시 선택해 주세요.');
      const g = await getGroup(gid);
      if (g.ownerUserId !== session.userId) throw new Error('방장만 일정을 바꿀 수 있어요.');
      if (r?.schedule.status === 'cancelled') throw new Error('취소된 일정은 바꿀 수 없어요.');
      setActualGroup(gid);
      setGroupName(g.name);
      setAllowed(true);
      api(`/groups/${gid}/members`)
        .then((m) => setOwnerName(m.members.find((x: any) => x.isOwner)?.displayName ?? ''))
        .catch(() => {});
      // One schedule per date: fade dates already used by other schedules in the period sheet.
      const around = r?.schedule.startDate ?? date ?? todayInSeoul();
      api(`/groups/${gid}/calendar?from=${addDays(around, -182)}&to=${addDays(around, 183)}`)
        .then((c) => setTakenDays(groupDays(c.schedules).filter((x) => x.status === 'active' && x.scheduleId !== id)))
        .catch(() => {});
      setDetail(r);
      if (r) {
        setVersion(r.schedule.version);
        if (!draft.hasDraft)
          for (const k of ['title', 'startDate', 'endDate']) set(k, r.schedule[k]);
      }
    });
  }, [id, groupId, draft.ready, session?.userId]);
  async function save(confirmed = false) {
    await a.run(async () => {
      try {
        if (!allowed) throw new Error('일정 변경 권한을 확인해 주세요.');
        inputText(v.title, '일정 제목', 100);
        validPeriod(v.startDate, v.endDate);
        if (!pending) {
          const clash = takenDays.filter((x) => datesBetween(v.startDate, v.endDate).includes(x.date));
          if (clash.length)
            throw new Error(
              `이미 일정이 있는 날짜가 들어 있어요: ${clash.map((x) => `${shortDate(x.date)} ${x.scheduleTitle}`).join(', ')}\n하루에는 일정을 하나만 만들 수 있어요.`,
            );
        }
        const body = {
          title: inputText(v.title, '일정 제목', 100),
          startDate: v.startDate,
          endDate: v.endDate,
        };
        const requestBody =
          pending && v.pendingBody
            ? JSON.parse(v.pendingBody)
            : id
              ? { ...body, expectedVersion: version, confirmOutsideRange: confirmed }
              : { ...body, timezone: 'Asia/Seoul' };
        set('pendingBody', JSON.stringify(requestBody));
        set('pending', 'yes');
        await awaitOperation(
          id
            ? await api(`/schedules/${id}`, requestBody, 'PATCH')
            : await api(`/groups/${actualGroup}/schedules`, requestBody),
        );
        await clear();
        leave(() =>
          router.dismissTo({
            pathname: '/group/[id]',
            params: { id: actualGroup, focusDate: v.startDate },
          }),
        );
      } catch (e) {
        if (
          e instanceof ApiError &&
          !(e instanceof PendingOperationError) &&
          (!e.httpStatus || (e.httpStatus < 500 && e.httpStatus !== 429))
        )
          set('pending', '');
        if (e instanceof ApiError && e.code === 'SCHEDULE_DATE_TAKEN') {
          const dates: string[] = e.details?.dates ?? [],
            titles = (e.details?.schedules ?? []).map((x: any) => x.title).join(', ');
          throw new Error(
            `이미 일정이 있는 날짜가 들어 있어요${dates.length ? `: ${dates.map(shortDate).join(', ')}` : ''}${titles ? ` (${titles})` : ''}\n하루에는 일정을 하나만 만들 수 있어요. 기간을 다시 골라 주세요.`,
          );
        }
        if (e instanceof ApiError && e.code === 'OUTSIDE_RANGE_CONFIRMATION_REQUIRED') {
          confirm(
            '기간 밖 기록을 유지할까요?',
            `방문 ${e.details.visits}개 · 기록 ${e.details.media}개가 새 기간 밖에 남습니다. 삭제되지 않습니다.`,
            () => save(true),
          );
        } else {
          if (id && e instanceof ApiError && e.code === 'VERSION_CONFLICT')
            setLatest((await api(`/schedules/${id}`)).schedule);
          throw e;
        }
      }
    });
  }
  const change = (key: string, value: string) => {
    set(key, value);
    setDirty(true);
  };
  async function remove(kind: 'cancellation' | 'deletion') {
    await a.run(async () => {
      await api(`/schedules/${id}/${kind}`, { expectedVersion: version });
      await clear();
      leave(() => router.dismissTo(`/group/${actualGroup}`));
    });
  }
  let valid = true;
  try {
    inputText(v.title, '일정 제목', 100);
    validPeriod(v.startDate, v.endDate);
  } catch {
    valid = false;
  }
  return (
    <Screen
      compact
      title={id ? '일정 변경' : '일정 추가'}
      subtitle={groupName}
    >
      {!!groupName && (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 18,
          }}
        >
          <Text
            numberOfLines={1}
            style={{
              flexShrink: 1,
              fontSize: 13,
              fontWeight: '700',
              color: colors.sub,
              backgroundColor: colors.surface,
              paddingHorizontal: 14,
              paddingVertical: 8,
              borderRadius: 18,
              overflow: 'hidden',
            }}
          >
            👥 {groupName}
          </Text>
          {!!ownerName && (
            <Text style={{ fontSize: 12, color: colors.muted }}>● 방장 {ownerName}</Text>
          )}
        </View>
      )}
      {detail?.retention && (
        <Card style={{ backgroundColor: '#F2F4F6', borderWidth: 0 }}>
          <P>
            {detail.retention.fixed
              ? '최초 기록 완료 후 보관 기한은 바뀌지 않아요'
              : '첫 기록 완료 전 예상 보관 기한'}
          </P>
          <P>{detail.retention.lastDate}까지</P>
        </Card>
      )}
      <Field
        label="일정 제목"
        required
        limit={100}
        placeholder="예: 북한산 둘레길"
        value={v.title}
        editable={allowed && !a.busy && !pending}
        onChangeText={(t) => change('title', t)}
      />
      <PeriodPicker
        start={v.startDate}
        end={v.endDate}
        disabled={!allowed || a.busy || pending}
        disabledDates={new Set(takenDays.map((x) => x.date))}
        onChange={(start, end) => {
          change('startDate', start);
          change('endDate', end);
        }}
      />
      <View
        style={{ backgroundColor: colors.surface, borderRadius: 18, padding: 16, gap: 12, marginBottom: 6 }}
      >
        <Text style={{ color: colors.sub, fontSize: 13 }}>🕘　시간은 각 장소에서 입력해요 · 반복 설정 없음</Text>
        <Text style={{ color: colors.sub, fontSize: 13 }}>🌏　한국 표준시(Asia/Seoul) 기준</Text>
      </View>
      <Button disabled={!allowed || a.busy || !valid || !!latest} onPress={() => save()}>
        {a.busy ? '저장 중…' : pending ? '저장 결과 확인' : '✓ 저장하기'}
      </Button>
      {pending && (
        <P>처리 결과를 확인하는 동안 입력을 보관합니다. 같은 요청으로 결과를 다시 확인해 주세요.</P>
      )}
      {latest && (
        <Card>
          <P>
            최신 일정: {latest.title} · {latest.startDate} ~ {latest.endDate}
          </P>
          <Button
            secondary
            onPress={() => {
              setVersion(latest.version);
              setLatest(null);
            }}
          >
            내 입력 유지 · 최신 버전 기준으로 준비
          </Button>
          <Button
            secondary
            onPress={() => {
              for (const k of ['title', 'startDate', 'endDate']) set(k, latest[k]);
              setVersion(latest.version);
              setLatest(null);
              setDirty(false);
            }}
          >
            최신 내용으로 바꾸기
          </Button>
        </Card>
      )}
      {id && allowed && (
        <>
          <Button
            secondary
            disabled={a.busy || pending}
            onPress={() =>
              confirm(
                '일정을 취소할까요?',
                '기록은 보관 기한까지 유지되며 새 업로드는 막힙니다. 취소는 되돌릴 수 없어요.',
                () => remove('cancellation'),
              )
            }
          >
            일정 취소 · 기록 보존
          </Button>
          <Button
            secondary
            disabled={a.busy || pending}
            onPress={() =>
              confirm(
                '빈 일정을 삭제할까요?',
                `방문 계획 ${detail?.plan?.reduce((n: number, d: any) => n + d.visitCount, 0) ?? 0}개도 삭제됩니다. 기록이나 진행 중 업로드가 있으면 서버가 삭제를 거부합니다.`,
                () => remove('deletion'),
              )
            }
          >
            빈 일정 삭제
          </Button>
        </>
      )}
      {a.errorView}
    </Screen>
  );
}
