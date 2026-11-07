import React, { useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { api, ApiError, awaitOperation, getGroup } from '../../lib/api';
import { useInitialize } from '../../lib/effects';
import { useAccount } from '../../lib/state';
import { moveMonth } from '../../lib/calendar';
import { useFormExit } from '../../lib/unsaved';
import { useAppToast } from '../../components/toast-provider';
import { inputText } from '../../lib/validation';
import { scheduleDayList, type ScheduleDay } from '../../lib/day-labels';
import { loadGroupDays } from '../../lib/group-days';
import { MonthGrid, MonthHeader } from '../../components/period-picker';
import { Screen, Button, ClearableInput, P, Sheet, colors, confirm, s, useAction } from '../../components/ui';
/** Edit one day of a schedule: its title and date, or cancel/delete just that day (owner only). */
export default function DayEdit() {
  const params = useLocalSearchParams<{ scheduleId?: string; date?: string }>();
  const scheduleId = typeof params.scheduleId === 'string' ? params.scheduleId : '';
  const date = typeof params.date === 'string' ? params.date : '';
  const validRoute = !!scheduleId && /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(Date.parse(date));
  const
    { session } = useAccount(),
    a = useAction({ inlineRetry: false });
  const [schedule, setSchedule] = useState<any>(null),
    [day, setDay] = useState<ScheduleDay | null>(null),
    [single, setSingle] = useState(false),
    [places, setPlaces] = useState(0),
    [groupName, setGroupName] = useState(''),
    [taken, setTaken] = useState<Set<string>>(new Set()),
    [title, setTitle] = useState(''),
    [newDate, setNewDate] = useState(date),
    [picking, setPicking] = useState(false),
    [pickMonth, setPickMonth] = useState(date.slice(0, 7)),
    [pick, setPick] = useState(date),
    [allowed, setAllowed] = useState(false);
  async function load(preserveInput = false) {
    if (!validRoute) throw new Error('일정과 날짜를 확인할 수 없어요. 모임에서 다시 선택해 주세요.');
    const r = await api(`/schedules/${scheduleId}`);
    const g = await getGroup(r.schedule.groupId);
    if (g.ownerUserId !== session?.userId) throw new Error('방장만 일정을 바꿀 수 있어요.');
    const days = Array.isArray(r.days) ? r.days : scheduleDayList(r.schedule);
    const d = days.find((x: ScheduleDay) => x.date === date);
    if (!d) throw new Error('이 날짜의 일정을 찾을 수 없어요. 달력에서 다시 선택해 주세요.');
    const one = days.length === 1;
    setSchedule(r.schedule);
    setDay(d);
    setSingle(one);
    setGroupName(g.name);
    setPlaces(r.plan?.find((p: any) => p.date === date)?.visitCount ?? d.visitCount ?? 0);
    if (!preserveInput) setTitle(d.title ?? (one ? r.schedule.title : `${d.dayNo}일차 · ${r.schedule.title}`));
    setAllowed(r.schedule.status === 'active' && d.status !== 'cancelled');
    // Dates the day cannot move to.
    const activeDays = await loadGroupDays(g.id);
    setTaken(new Set([
      ...activeDays.filter((x) => x.scheduleId !== scheduleId || x.date !== date).map((x) => x.date),
      ...days.filter((x: ScheduleDay) => x.date !== date).map((x: ScheduleDay) => x.date),
    ]));
  }
  useInitialize(() => {
    if (session) void a.run(load);
  }, [scheduleId, date, session?.userId]);
  const limit = 100;
  let titleError = '';
  try {
    inputText(title, '일정 제목', limit);
  } catch (e) {
    titleError = (e as Error).message;
  }
  const original = day?.title ?? (single ? schedule?.title : `${day?.dayNo}일차 · ${schedule?.title}`);
  const changed = !!day && (title.trim() !== (original ?? '') || newDate !== date);
  const toast = useAppToast();
  const leave = useFormExit(changed, async () => {}, false, { title: '저장하지 않고 나갈까요?', body: '바꾼 내용이 사라져요.', cancel: '계속 편집', discard: '나가기' });
  async function save() {
    await a.run(async () => {
      try {
        const body: any = { expectedVersion: schedule.version };
        if (title.trim() !== (original ?? ''))
          body.title = inputText(title, '일정 제목', 100);
        if (newDate !== date) body.date = newDate;
        await awaitOperation(await api(`/schedules/${scheduleId}/days/${date}`, body, 'PATCH'));
        // Return to the calendar already in the stack instead of stacking another copy.
        toast('일정을 바꿨어요');
        leave(() => router.dismissTo({
          pathname: '/group/[id]',
          params: { id: schedule.groupId, focusDate: newDate },
        }));
      } catch (e) {
        if (e instanceof ApiError && e.code === 'SCHEDULE_DATE_TAKEN')
          throw new Error('이미 다른 일정이 있는 날짜예요. 하루에는 일정을 하나만 만들 수 있어요.');
        if (e instanceof ApiError && e.code === 'VERSION_CONFLICT') {
          await load(true);
          throw new Error('다른 곳에서 일정이 바뀌었어요. 최신 내용을 불러왔으니 다시 확인해 주세요.');
        }
        throw e;
      }
    });
  }
  async function remove(kind: 'cancellation' | 'deletion') {
    await a.run(async () => {
      await api(`/schedules/${scheduleId}/days/${date}/${kind}`, {
        expectedVersion: schedule.version,
      });
      toast(kind === 'cancellation' ? '일정을 취소했어요' : '일정을 삭제했어요');
      leave(() => router.dismissTo({ pathname: '/group/[id]', params: { id: schedule.groupId, focusDate: date } }));
    });
  }
  const row = (
    icon: string,
    label: string,
    sub: string,
    onPress: () => void,
    opts: { danger?: boolean; locked?: boolean; allowCancelled?: boolean } = {},
  ) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!opts.locked || !day || (!allowed && !opts.allowCancelled) || a.busy }}
      disabled={opts.locked || !day || (!allowed && !opts.allowCancelled) || a.busy}
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        paddingVertical: 16,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Text style={{ fontSize: 20, opacity: opts.locked ? 0.5 : 1 }}>{icon}</Text>
      <View style={{ flex: 1 }}>
        <Text
          style={{
            fontSize: 16,
            fontWeight: '800',
            color: opts.locked || !day || (!allowed && !opts.allowCancelled) ? '#B0B8C1' : opts.danger ? '#E5484D' : colors.ink,
          }}
        >
          {label}
        </Text>
        <Text style={{ fontSize: 12, color: colors.muted, marginTop: 3 }}>{sub}</Text>
      </View>
      <Text style={{ fontSize: opts.locked ? 18 : 20, color: colors.muted }}>
        {opts.locked ? '🔒' : '›'}
      </Text>
    </Pressable>
  );
  return (
    <Screen compact title="일정 변경" subtitle={groupName} onBack={() => {
      if (!changed) return false;
      leave.confirmExit(() => router.canGoBack() ? router.back() : router.replace({ pathname: '/group/[id]', params: { id: schedule.groupId } }));
      return true;
    }}>
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 10,
        }}
      >
        <Text style={s.label}>
          일정 제목<Text style={{ color: colors.accent }}> *</Text>
        </Text>
      </View>
      <ClearableInput
        accessibilityLabel="일정 제목"
        limit={limit}
        helper="1~100자로 입력해 주세요"
        placeholder={
          day && schedule && !single ? `${day.dayNo}일차 · ${schedule.title}` : '예: 북한산 둘레길'
        }
        value={title}
        editable={allowed && !a.busy}
        onChangeText={setTitle}
      />
      {!!titleError && !!title && (
        <Text accessibilityRole="alert" style={{ color: '#B8433F', marginBottom: 8 }}>
          {titleError}
        </Text>
      )}
      <Text style={[s.label, { marginBottom: 10 }]}>
        날짜 <Text style={{ color: colors.accent }}>*</Text>
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="날짜 변경"
        disabled={!allowed || a.busy}
        onPress={() => {
          setPick(newDate);
          setPickMonth(newDate.slice(0, 7));
          setPicking(true);
        }}
        style={[s.input, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}
      >
        <Text style={{ fontSize: 17, fontWeight: '800', color: colors.ink }}>
          {newDate.replaceAll('-', '.')}
        </Text>
        <Text style={{ fontSize: 18 }}>📅</Text>
      </Pressable>
      <View
        style={{
          backgroundColor: colors.surface,
          borderRadius: 18,
          padding: 16,
          gap: 12,
          marginTop: 18,
          marginBottom: 6,
        }}
      >
        <Text style={{ color: colors.sub, fontSize: 13 }}>🕘　시간은 각 장소에서 입력해요</Text>
        <Text style={{ color: colors.sub, fontSize: 13 }}>🌏　한국 표준시(Asia/Seoul) 기준</Text>
      </View>
      <Button disabled={!allowed || !changed || !!titleError || a.busy} onPress={save}>
        {a.busy ? '저장 중…' : '✓ 저장하기'}
      </Button>
      {day && !allowed && <P>취소된 일정은 바꿀 수 없어요. 기록은 보관 기한까지 볼 수 있어요.</P>}

      <View
        style={{
          backgroundColor: colors.surface,
          borderRadius: 20,
          paddingHorizontal: 16,
          marginTop: 14,
        }}
      >
        {row('🗓', '일정 취소(기록 보존)',
          day?.status === 'cancelled' ? '이미 취소된 날이에요' : '기록은 보관 기한까지 남아요',
          () =>
          Alert.alert(
            '이 날 일정을 취소할까요?',
            '기록은 보관 기한까지 남아요. 취소하면 누구도 새 사진·영상을 올릴 수 없고 되돌릴 수 없어요.',
            [
              { text: '돌아가기', style: 'cancel' },
              { text: '일정 취소하기', style: 'destructive', onPress: () => remove('cancellation') },
            ],
          ),
          { danger: true, locked: day?.status === 'cancelled' },
        )}
        <View style={{ height: 1, backgroundColor: colors.line }} />
        {row(
          '🗑',
          '이 날 일정 삭제',
          places ? '장소가 담긴 날은 삭제할 수 없어요' : '장소가 없는 날만 삭제할 수 있어요',
          () =>
            confirm('이 날 일정을 삭제할까요?', '이 날짜가 일정에서 빠지고 되돌릴 수 없어요.', () =>
              remove('deletion'),
            ),
          { locked: places > 0, allowCancelled: true },
        )}
      </View>
      {a.errorView}
      <Sheet visible={picking} title="날짜 변경" onClose={() => setPicking(false)}>
        <P>{pick === newDate ? '옮길 날짜를 골라 주세요.' : '날짜를 골랐어요.'}</P>
        <MonthHeader spread month={pickMonth} onMove={(n) => setPickMonth(moveMonth(pickMonth, n))} />
        <MonthGrid month={pickMonth} selected={pick} disabledDates={taken} onSelect={setPick} />
        <P>연한 날짜는 다른 일정이 있어 고를 수 없어요. 날짜를 옮기면 일차 번호가 다시 매겨져요.</P>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Button style={{ flex: 1 }} secondary onPress={() => setPicking(false)}>
            취소
          </Button>
          <Button
            style={{ flex: 1 }}
            onPress={() => {
              setNewDate(pick);
              setPicking(false);
            }}
          >
            선택 완료
          </Button>
        </View>
      </Sheet>
    </Screen>
  );
}
