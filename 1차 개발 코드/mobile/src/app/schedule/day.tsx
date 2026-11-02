import React, { useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { api, ApiError, awaitOperation, getGroup } from '../../lib/api';
import { useInitialize } from '../../lib/effects';
import { useAccount } from '../../lib/state';
import { addDays, moveMonth } from '../../lib/calendar';
import { inputText } from '../../lib/validation';
import { groupDays, scheduleDayList, type ScheduleDay } from '../../lib/day-labels';
import { MonthGrid, MonthHeader } from '../../components/period-picker';
import { Screen, Button, ClearableInput, P, Sheet, colors, confirm, s, useAction } from '../../components/ui';
/** Edit one day of a schedule: its title and date, or cancel/delete just that day (owner only). */
export default function DayEdit() {
  const { scheduleId, date } = useLocalSearchParams<{ scheduleId: string; date: string }>(),
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
  async function load() {
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
    setTitle(one ? r.schedule.title : (d.title ?? ''));
    // Title and date can be changed even for a cancelled day while the schedule is active.
    setAllowed(r.schedule.status === 'active');
    // Dates the day cannot move to.
    const cal = await api(
      `/groups/${g.id}/calendar?from=${addDays(date, -182)}&to=${addDays(date, 183)}`,
    ).catch(() => null);
    if (cal)
      setTaken(
        new Set(
          groupDays(cal.schedules)
            .filter((x) =>
              // Any day of this schedule (even cancelled) or another schedule's active day blocks a move.
              x.scheduleId === scheduleId ? x.date !== date : x.status === 'active',
            )
            .map((x) => x.date),
        ),
      );
  }
  useInitialize(() => {
    if (session) void a.run(load);
  }, [scheduleId, date, session?.userId]);
  const limit = single ? 100 : 30;
  let titleError = '';
  try {
    inputText(title, '일정 제목', limit, single);
  } catch (e) {
    titleError = (e as Error).message;
  }
  const original = single ? schedule?.title : (day?.title ?? '');
  const changed = !!day && (title.trim() !== (original ?? '') || newDate !== date);
  async function save() {
    await a.run(async () => {
      try {
        const body: any = { expectedVersion: schedule.version };
        if (title.trim() !== (original ?? ''))
          body.title = single
            ? inputText(title, '일정 제목', 100)
            : inputText(title, '일정 제목', 30, false) || null;
        if (newDate !== date) body.date = newDate;
        await awaitOperation(await api(`/schedules/${scheduleId}/days/${date}`, body, 'PATCH'));
        // Return to the calendar already in the stack instead of stacking another copy.
        router.dismissTo({
          pathname: '/group/[id]',
          params: { id: schedule.groupId, focusDate: newDate },
        });
      } catch (e) {
        if (e instanceof ApiError && e.code === 'SCHEDULE_DATE_TAKEN')
          throw new Error('그 날짜에는 이미 다른 일정이 있어요. 다른 날짜를 골라 주세요.');
        if (e instanceof ApiError && e.code === 'VERSION_CONFLICT') {
          await load();
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
      router.dismissTo({ pathname: '/group/[id]', params: { id: schedule.groupId, focusDate: date } });
    });
  }
  const row = (
    icon: string,
    label: string,
    sub: string,
    onPress: () => void,
    opts: { danger?: boolean; locked?: boolean } = {},
  ) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!opts.locked || !allowed }}
      disabled={opts.locked || !allowed || a.busy}
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
            color: opts.locked || !allowed ? '#B0B8C1' : opts.danger ? '#E5484D' : colors.ink,
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
    <Screen compact title="일정 변경" subtitle={groupName}>
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 10,
        }}
      >
        <Text style={s.label}>
          일정 제목{single && <Text style={{ color: colors.accent }}> *</Text>}
        </Text>
      </View>
      <ClearableInput
        accessibilityLabel="일정 제목"
        limit={limit}
        helper={single ? '' : '비워 두면 "N일차 · 일정 이름"으로 보여요'}
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
      {day && allowed && day.status === 'cancelled' && (
        <P>취소된 날이에요. 제목과 날짜는 바꿀 수 있지만 새 사진·영상은 올릴 수 없어요.</P>
      )}
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
          { locked: places > 0 },
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
