import { useFocusLoad } from '../../lib/effects';
import React, { useState, useRef } from 'react';
import { View, Text, Pressable } from 'react-native';
import { DateTabs, DayTimeline } from '../../components/schedule-plan';
import { useLocalSearchParams, router } from 'expo-router';
import { api, ApiError, getGroup, awaitOperation } from '../../lib/api';
import { todayInSeoul } from '../../lib/preferences';
import { loadGroupDays } from '../../lib/group-days';
import { validDate } from '../../lib/validation';
import { dayLabel, groupDays, periodLabel, scheduleDayList, shortDate, weekday } from '../../lib/day-labels';
import { useAccount } from '../../lib/state';
import { Records } from '../../components/records';
import { TimeEditModal } from '../../components/time-edit-modal';
import { UploadSheet } from '../../components/upload-sheet';
import { useCandidateExit } from '../../components/candidate-exit';
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
  const { id, date: dateParam, recordVisit, openUpload } = useLocalSearchParams<{ id: string; date?: string; recordVisit?: string; openUpload?: string }>(),
    { session } = useAccount(),
    [detail, setDetail] = useState<any>(null),
    [files, setFiles] = useState<any[]>([]),
    [tab, setTab] = useState<'plan' | 'records'>(openUpload === '1' ? 'records' : 'plan'),
    [options, setOptions] = useState({
      view: 'by_photo',
      order: 'desc',
    }),
    [date, setDate] = useState(dateParam ?? ''),
    [recordDate, setRecordDate] = useState(openUpload === '1' ? dateParam ?? '' : ''),
    [visitId, setVisit] = useState(recordVisit ?? ''),
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
    [adding, setAdding] = useState(openUpload === '1');
  const a = useAction();
  const [candidateState, setCandidateState] = useState({ count: 0, busy: false });
  const candidateExit = useCandidateExit(candidateState);
  const timeAction = useAction({ inlineRetry: false });
  const [timeVisit, setTimeVisit] = useState('');
  const [timeLatest, setTimeLatest] = useState('');
  const timeNeedsRefresh = useRef(false);
  async function refreshTimePlan() {
    const fresh = await api(`/schedules/${id}`);
    setDetail({ ...fresh, writable: Date.parse(fresh.retention.expiresAt) > Date.now() });
    const latest = fresh.plan.find((p: any) => p.date === date);
    setTimeLatest(latest ? `최신 계획\n${latest.title}\n${latest.visits.map((v: any) => `${v.name} · ${v.plannedTime ?? '시간 미정'}`).join('\n')}` : '이 날짜의 계획이 없어졌어요.');
    timeNeedsRefresh.current = false;
  }
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
    let live = true;
    setSummary(null);
    a.run(async () => {
      const d = await api(`/schedules/${id}`);
      if (!live) return;
      if (openUpload === '1' && recordVisit && !d.plan.some((day: any) => day.date === dateParam && day.visits.some((v: any) => v.id === recordVisit))) { setAdding(false); throw new Error('이전 후보의 장소가 이동·삭제됐어요. 후보는 원래 날짜·장소로 보존됩니다.'); }
      const visitIds = d.plan.flatMap((day: any) => day.visits.map((v: any) => v.id)) as string[];
      setHighlightedVisits(
        previousVisits.current ? visitIds.filter((id) => !previousVisits.current!.has(id)) : [],
      );
      previousVisits.current = new Set(visitIds);
      setDetail({ ...d, writable: Date.parse(d.retention.expiresAt) > Date.now() });
      const own = (Array.isArray(d.days) ? d.days : scheduleDayList(d.schedule)) as any[];
      if (date && !own.some((x) => x.date === date)) throw new Error('선택한 날짜가 이동되거나 삭제됐어요. 모임 달력에서 다시 선택해 주세요.');
      if (!date) {
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
      const [cal, members, totals] = await Promise.all([
        loadGroupDays(g.id),
        api(`/groups/${g.id}/members`).catch(() => null),
        api(`/schedules/${id}/media?limit=1`),
      ]);
      if (!live) return;
      setGroupDayList(cal);
      if (members)
        setAvatars(Object.fromEntries(members.members.map((m: any) => [m.userId, m.avatarVersion ?? null])));
      setSummary(totals);
      if (tab === 'records') await load(undefined, () => live);
    });
    return () => {
      live = false;
    };
  }, [id, view, order, recordDate, visitId, unassigned, outside, tab]);
  const ownDays = detail ? ((Array.isArray(detail.days) ? detail.days : scheduleDayList(detail.schedule)) as any[]) : [];
  const day = ownDays.find((x) => x.date === date);
  const plan = detail?.plan.find((p: any) => p.date === date);
  const single = ownDays.length === 1;
  const scheduleActive = detail?.schedule.status === 'active';
  const dayActive = scheduleActive && day?.status === 'active' && detail?.writable;
  // Tabs: every active day in the group; this schedule's days stand in until the calendar loads.
  const tabs = (
    groupDayList.length
      ? groupDayList.filter((x) => x.status === 'active' || (x.scheduleId === id && x.date === date))
      : ownDays.filter((x) => x.status === 'active' || x.date === date).map((x) => ({ ...x, scheduleId: id }))
  ) as { date: string; scheduleId: string }[];
  const activeTabs = tabs.filter((t) => t.date);
  const selectedVisit = detail?.plan.flatMap((d: any) => d.visits).find((v: any) => v.id === visitId);
  const visitDate = selectedVisit?.visitDate ?? recordDate;
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
    const enter = () => {
    setOptions({ view: 'by_photo', order: 'desc' });
    setVisit(v?.id ?? '');
    setRecordDate(v ? date : '');
    setDateInput(v ? date : '');
    setUnassigned(false);
    setOutside(false);
    setFiles([]);
    setTab('records');
    };
    if (tab === 'records') candidateExit.requestExit(enter); else enter();
  }
  return (
    <Screen
      title={title}
      subtitle={subtitle}
      onBack={() => {
        // The records view lives in this screen's state, so step back to the date view first.
        if (tab === 'records') {
          candidateExit.requestExit(() => {
          setVisit('');
          setRecordDate('');
          setTab('plan');
          setAdding(false);
          });
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
      {candidateExit.dialog}
      <TimeEditModal visible={!!timeVisit} placeName={plan?.visits.find((v: any) => v.id === timeVisit)?.name ?? ''}
        value={plan?.visits.find((v: any) => v.id === timeVisit)?.plannedTime ?? undefined}
        busy={timeAction.busy} error={timeAction.error} latest={timeLatest} onClose={() => { setTimeVisit(''); timeAction.clear(); }}
        onSave={(value) => timeAction.run(async () => {
          if (timeNeedsRefresh.current) {
            await refreshTimePlan();
            throw new Error('내 입력은 유지했어요. 최신 계획을 확인한 뒤 다시 저장해 주세요.');
          }
          if (!plan?.visits.some((v: any) => v.id === timeVisit) || !dayActive)
            throw new Error('이 장소가 이동·삭제됐거나 날짜를 수정할 수 없어요. 창을 닫고 최신 일정을 확인해 주세요.');
          try {
          await awaitOperation(await api(`/schedules/${id}/plans/${date}`, {
            title: plan.title, expectedVersion: plan.version,
            visits: plan.visits.map((v: any, order: number) => ({ id: v.id, order, plannedTime: v.id === timeVisit ? value ?? null : v.plannedTime ?? null })),
          }, 'PUT'));
          } catch (e) {
            if (e instanceof ApiError && e.code === 'VERSION_CONFLICT') {
              timeNeedsRefresh.current = true;
              try { await refreshTimePlan(); }
              catch { throw new Error('최신 계획을 불러오지 못했어요. 내 입력은 유지됩니다. 다시 확인을 누르면 재조회합니다.'); }
              throw new Error('다른 참여자가 계획을 바꿨어요. 내 입력은 유지했으니 최신 계획을 확인한 뒤 다시 저장해 주세요.');
            }
            throw e;
          }
          const fresh = await api(`/schedules/${id}`);
          setDetail({ ...fresh, writable: Date.parse(fresh.retention.expiresAt) > Date.now() });
          setTimeVisit('');
          timeAction.clear();
        })} />
      {detail && tab === 'records' && (
        <UploadSheet
          visible={adding}
          onClose={() => setAdding(false)}
          scheduleId={id}
          onStateChange={setCandidateState}
          visitId={visitId || null}
          recordDate={recordDate || date}
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
                  onEdit={(visit) => {
                    if (visit) { setTimeLatest(''); setTimeVisit(visit); }
                    else router.push({ pathname: '/plan', params: { id, date } });
                  }}
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
                      setFilters(false);
                      if (dateInput !== recordDate) candidateExit.requestExit(() => setRecordDate(dateInput));
                    })
                  }
                >
                  필터 적용
                </Button>
                <Button
                  secondary
                  onPress={() => {
                    const reset = () => {
                    setRecordDate('');
                    setDateInput('');
                    setUnassigned(false);
                    setOutside(false);
                    setFilters(false);
                    };
                    setFilters(false);
                    if (recordDate) candidateExit.requestExit(reset); else reset();
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
              recordScope={{ scheduleId: id, query: { view: 'by_photo', order, ...(recordDate ? { recordDate } : {}), ...(visitId ? { visitId } : {}), ...(unassigned ? { unassigned: 'true' } : {}), ...(outside ? { outsideRange: 'true' } : {}) } }}
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
