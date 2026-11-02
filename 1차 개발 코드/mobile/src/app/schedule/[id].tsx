import { useFocusLoad } from '../../lib/effects';
import React, { useState, useRef } from 'react';
import { View, Text, Pressable } from 'react-native';
import { DateTabs, DayTimeline } from '../../components/schedule-plan';
import { useLocalSearchParams, router } from 'expo-router';
import { api, getGroup } from '../../lib/api';
import { usePreference, todayInSeoul } from '../../lib/preferences';
import { addDays } from '../../lib/calendar';
import { validDate } from '../../lib/validation';
import { dayLabel, groupDays, periodLabel, scheduleDayList, shortDate, weekday } from '../../lib/day-labels';
import { useAccount } from '../../lib/state';
import { Records } from '../../components/records';
import { UploadSheet } from '../../components/upload-sheet';
import {
  Screen,
  Button,
  H,
  P,
  Field,
  useAction,
  s,
  Sheet,
  Chip,
  TextButton,
  colors,
} from '../../components/ui';
/**
 * Date view (screen 14) with the group's day tabs, and the place records view (16, 17).
 * `date` picks the day; tabs list active days of every schedule in the group.
 */
export default function Schedule() {
  const { id, date: dateParam } = useLocalSearchParams<{ id: string; date?: string }>(),
    { session } = useAccount(),
    [detail, setDetail] = useState<any>(null),
    [files, setFiles] = useState<any[]>([]),
    [tab, setTab] = useState<'plan' | 'records'>('plan'),
    [options, setOptions, optionsReady] = usePreference('record-view-v2', {
      view: 'by_time',
      order: 'desc',
    }),
    [date, setDate] = useState(dateParam ?? ''),
    [recordDate, setRecordDate] = useState(''),
    [visitId, setVisit] = useState(''),
    [next, setNext] = useState<string | null>(null),
    [groups, setGroups] = useState<any[]>([]),
    [owner, setOwner] = useState(false),
    [group, setGroup] = useState<any>(null),
    [groupDayList, setGroupDayList] = useState<ReturnType<typeof groupDays>>([]),
    [avatars, setAvatars] = useState<Record<string, number | null>>({}),
    [summary, setSummary] = useState<any>(null),
    [unassigned, setUnassigned] = useState(false),
    [outside, setOutside] = useState(false),
    [counts, setCounts] = useState<any>(null),
    [dateInput, setDateInput] = useState('');
  const { view, order } = options;
  const setView = (view: string) => setOptions({ ...options, view });
  const setOrder = (order: string) => setOptions({ ...options, order });
  const [menu, setMenu] = useState(false),
    [filters, setFilters] = useState(false),
    [adding, setAdding] = useState(false);
  const a = useAction();
  const previousVisits = useRef<Set<string> | null>(null);
  const [highlightedVisits, setHighlightedVisits] = useState<string[]>([]);
  async function load(cursor?: string, valid = () => true) {
    const q = new URLSearchParams({ view, order });
    if (recordDate) q.set('recordDate', recordDate);
    if (visitId) q.set('visitId', visitId);
    if (unassigned) q.set('unassigned', 'true');
    if (outside) q.set('outsideRange', 'true');
    if (cursor) q.set('cursor', cursor);
    const r = await api(`/schedules/${id}/media?${q}`);
    if (!valid()) return;
    setCounts(r.visibleCounts);
    setFiles((old) => (cursor ? [...old, ...r.items] : r.items));
    setGroups(r.groups ?? []);
    setNext(r.nextCursor);
  }
  useFocusLoad(() => {
    if (!optionsReady) return;
    let live = true;
    setSummary(null);
    a.run(async () => {
      const d = await api(`/schedules/${id}`);
      if (!live) return;
      const visitIds = d.plan.flatMap((day: any) => day.visits.map((v: any) => v.id)) as string[];
      setHighlightedVisits(
        previousVisits.current ? visitIds.filter((id) => !previousVisits.current!.has(id)) : [],
      );
      previousVisits.current = new Set(visitIds);
      setDetail(d);
      const own = (Array.isArray(d.days) ? d.days : scheduleDayList(d.schedule)) as any[];
      if (!date || !own.some((x) => x.date === date)) {
        const active = own.filter((x) => x.status === 'active'),
          today = todayInSeoul();
        setDate(
          (active.find((x) => x.date === today) ?? active.find((x) => x.date > today) ?? active[0] ?? own[0])
            ?.date ?? d.schedule.startDate,
        );
      }
      const g = await getGroup(d.schedule.groupId);
      if (!live) return;
      setGroup(g);
      setOwner(g.ownerUserId === session?.userId);
      const around = d.schedule.startDate;
      const [cal, members, totals] = await Promise.all([
        api(`/groups/${g.id}/calendar?from=${addDays(around, -182)}&to=${addDays(around, 183)}`).catch(
          () => null,
        ),
        api(`/groups/${g.id}/members`).catch(() => null),
        api(`/schedules/${id}/media?limit=1`),
      ]);
      if (!live) return;
      if (cal) setGroupDayList(groupDays(cal.schedules));
      if (members)
        setAvatars(Object.fromEntries(members.members.map((m: any) => [m.userId, m.avatarVersion ?? null])));
      setSummary(totals);
      if (tab === 'records') await load(undefined, () => live);
    });
    return () => {
      live = false;
    };
  }, [id, view, order, recordDate, visitId, unassigned, outside, optionsReady, tab]);
  const ownDays = detail ? ((Array.isArray(detail.days) ? detail.days : scheduleDayList(detail.schedule)) as any[]) : [];
  const day = ownDays.find((x) => x.date === date);
  const plan = detail?.plan.find((p: any) => p.date === date);
  const single = ownDays.length === 1;
  const scheduleActive = detail?.schedule.status === 'active';
  const dayActive = scheduleActive && day?.status !== 'cancelled';
  // Tabs: every active day in the group; this schedule's days stand in until the calendar loads.
  const tabs = (
    groupDayList.length
      ? groupDayList.filter((x) => x.status === 'active' || (x.scheduleId === id && x.date === date))
      : ownDays.filter((x) => x.status === 'active' || x.date === date).map((x) => ({ ...x, scheduleId: id }))
  ) as { date: string; scheduleId: string }[];
  const activeTabs = tabs.filter((t) => t.date);
  const selectedVisit = detail?.plan.flatMap((d: any) => d.visits).find((v: any) => v.id === visitId);
  const visitDate = selectedVisit?.visitDate ?? recordDate;
  const uploadParams: Record<string, string> = detail
    ? {
        id,
        startDate: detail.schedule.startDate,
        endDate: detail.schedule.endDate,
        visitId,
        recordDate: visitDate || date,
      }
    : { id };
  const title =
    tab === 'records'
      ? selectedVisit?.name || '함께 남긴 순간'
      : (group?.name ?? '');
  const subtitle =
    tab === 'records'
      ? `${detail?.schedule.title ?? ''}${visitDate ? ` · ${shortDate(visitDate).replace(/^0/, '')} ${weekday(visitDate)}` : ''}`
      : activeTabs.length
        ? periodLabel(activeTabs[0].date, activeTabs[activeTabs.length - 1].date)
        : undefined;
  function openRecords(v?: any) {
    setVisit(v?.id ?? '');
    setRecordDate(v ? date : '');
    setDateInput(v ? date : '');
    setUnassigned(false);
    setOutside(false);
    setFiles([]);
    setTab('records');
  }
  return (
    <Screen
      title={title}
      subtitle={subtitle}
      onBack={() => {
        // The records view lives in this screen's state, so step back to the date view first.
        if (tab === 'records') {
          setVisit('');
          setRecordDate('');
          setTab('plan');
          return true;
        }
        return false;
      }}
      contentStyle={tab === 'plan' ? { paddingBottom: 0 } : undefined}
      headerRight={
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="일정 메뉴"
          style={{ padding: 10 }}
          onPress={() => setMenu(true)}
        >
          <Text style={{ fontSize: 22 }}>⋯</Text>
        </Pressable>
      }
    >
      <Sheet visible={menu} title="일정 메뉴" onClose={() => setMenu(false)}>
        {owner && day && day.status === 'active' && scheduleActive && (
          <Button
            secondary
            onPress={() => {
              setMenu(false);
              router.push({ pathname: '/schedule/day', params: { scheduleId: id, date } });
            }}
          >
            이 날 일정 변경
          </Button>
        )}
        <Button
          secondary
          onPress={() => {
            setMenu(false);
            openRecords();
          }}
        >
          이 일정의 모든 기록
        </Button>
        <Button
          secondary
          onPress={() => {
            setMenu(false);
            router.push(`/edit-records?scheduleId=${id}`);
          }}
        >
          내 기록 수정·삭제
        </Button>
        <Button
          secondary
          onPress={() => {
            setMenu(false);
            router.push('/uploads');
          }}
        >
          파일 전송 상태
        </Button>
        <Button
          secondary
          onPress={() => {
            setMenu(false);
            router.push(`/group/manage?id=${group?.id}`);
          }}
        >
          함께하는 친구
        </Button>
        <P>
          {detail?.retention.fixed ? '고정 보관 기한' : '첫 업로드 전 예상 보관 기한'} ·{' '}
          {detail?.retention.lastDate ?? '확인 중'}까지
        </P>
      </Sheet>
      {detail && (
        <UploadSheet
          visible={adding}
          onClose={() => setAdding(false)}
          scheduleId={id}
          visitId={visitId || null}
          recordDate={visitDate || date}
          cameraParams={uploadParams}
        />
      )}
      {tab === 'plan' ? (
        <>
          {activeTabs.length > 0 && (
            <DateTabs
              days={activeTabs}
              date={date}
              onSelect={(t) => {
                if (t.scheduleId === id) setDate(t.date);
                else router.replace({ pathname: '/schedule/[id]', params: { id: t.scheduleId, date: t.date } });
              }}
            />
          )}
          <View
            style={{
              flexGrow: 1,
              marginHorizontal: -20,
              paddingHorizontal: 20,
              paddingTop: 24,
              paddingBottom: 24,
              backgroundColor: '#F7F8FA',
            }}
          >
            {detail && date && (
              <>
                {day?.status === 'cancelled' && (
                  <P>취소된 날이에요. 보관 기한까지 기록을 볼 수 있어요.</P>
                )}
                {detail.schedule.status === 'cancelled' && (
                  <P>취소된 일정입니다. 보관 기한까지 기록을 볼 수 있어요.</P>
                )}
                <DayTimeline
                  date={date}
                  title={
                    day
                      ? dayLabel({
                          title: day.title || plan?.title || null,
                          dayNo: day.dayNo,
                          scheduleTitle: detail.schedule.title,
                          single,
                        })
                      : (plan?.title ?? '')
                  }
                  visits={plan?.visits ?? []}
                  visitCounts={summary?.countsByVisit ?? null}
                  loading={a.busy && !summary}
                  editable={!!dayActive}
                  canAdd={!!dayActive}
                  highlightedVisits={highlightedVisits}
                  onEdit={(visit) =>
                    router.push({ pathname: '/plan', params: { id, date, ...(visit ? { visit } : {}) } })
                  }
                  onVisit={(v) => openRecords(v)}
                  onAdd={() =>
                    router.push({
                      pathname: '/places',
                      params: {
                        id,
                        groupId: detail.schedule.groupId,
                        startDate: detail.schedule.startDate,
                        endDate: detail.schedule.endDate,
                        visitDate: date,
                      },
                    })
                  }
                />
                <TextButton color={colors.sub} onPress={() => openRecords()}>
                  이 일정의 모든 기록 보기 ›
                </TextButton>
              </>
            )}
            {a.errorView}
          </View>
        </>
      ) : (
        <>
          {dayActive && (
            <Button tone="outline" onPress={() => setAdding(true)}>
              ＋ 사진·동영상 올리기
            </Button>
          )}
          {!dayActive && detail && <P>취소된 날에는 새 사진·동영상을 올릴 수 없어요.</P>}
          <Text style={{ fontSize: 19, fontWeight: '800', color: colors.ink, marginTop: 14, marginBottom: 10 }}>
            함께 남긴 순간
          </Text>
          {!visitId && (
            <>
              <TextButton color={colors.sub} onPress={() => setFilters(true)}>
                {recordDate || unassigned || outside
                  ? `필터: ${[recordDate, unassigned && '장소 미지정', outside && '기간 밖']
                      .filter(Boolean)
                      .join(' · ')} · 변경`
                  : '날짜·장소 필터'}
              </TextButton>
              <Sheet visible={filters} title="기록 필터" onClose={() => setFilters(false)}>
                <Field label="기록일" value={dateInput} onChangeText={setDateInput} placeholder="전체 날짜" />
                <View style={s.row}>
                  <Chip selected={unassigned} onPress={() => setUnassigned(!unassigned)}>
                    장소 미지정
                  </Chip>
                  <Chip selected={outside} onPress={() => setOutside(!outside)}>
                    기간 밖 기록
                  </Chip>
                </View>
                <Button
                  onPress={() =>
                    a.run(async () => {
                      if (dateInput) validDate(dateInput);
                      setRecordDate(dateInput);
                      setFilters(false);
                    })
                  }
                >
                  필터 적용
                </Button>
                <Button
                  secondary
                  onPress={() => {
                    setRecordDate('');
                    setDateInput('');
                    setUnassigned(false);
                    setOutside(false);
                    setFilters(false);
                  }}
                >
                  전체 기록 보기
                </Button>
              </Sheet>
              {counts && !a.busy && (
                <P>
                  사진 {counts.photos}개 · 동영상 {counts.videos}개
                </P>
              )}
            </>
          )}
          {!a.busy && !a.error && (
            <Records
              key={`${id}:${recordDate}:${visitId}:${unassigned}:${outside}:${view}`}
              items={files}
              groups={view === 'by_author' ? groups : undefined}
              avatars={avatars}
              toolbar={{ view, onView: setView, order, onOrder: setOrder }}
            />
          )}
          {next && (
            <Button secondary onPress={() => a.run(() => load(next))}>
              기록 더 보기
            </Button>
          )}
          {a.errorView}
        </>
      )}
      {!detail && !a.busy && !a.error && <H>일정을 불러오고 있어요</H>}
    </Screen>
  );
}
