import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, PanResponder, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppHeader } from '../components/AppHeader';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { ActionButton, Pill } from '../components/FormParts';
import { MonthGrid } from '../components/MonthGrid';
import { ScreenFrame } from '../components/ScreenFrame';
import { Toast, useToast } from '../components/Toast';
import { MAX_MEMBERS, type Group, type Schedule } from '../mock/groupData';
import type { Nav } from '../navigation/routes';
import { commonErrorText, useFlash, useGroups } from '../state/GroupsProvider';
import { usePrototype } from '../state/PrototypeProvider';
import { colors, GUTTER, MIN_TOUCH, radius } from '../styles/tokens';
import {
  addDays,
  isWithin,
  monthDayLabel,
  monthGrid,
  monthKey,
  monthTitle,
  periodLabel,
  rangesOverlap,
  shiftMonth,
  todayKst,
  weekdayLabel,
  type DateStr,
} from '../utils/calendar';
import { dayEntriesOf } from '../utils/dayEntries';

const LANES = 3;
const CELL_HEIGHT = 84;

/**
 * 달력·목록에 그리는 한 줄. 여러 날 일정도 하루씩 풀어서 날짜 하나가 한 줄이 되고,
 * 제목은 그날의 제목(날짜 제목)을 쓴다. 변경·취소 같은 일정 단위 동작은 원래 일정(parent)에 한다.
 */
type Entry = Schedule & { parent: Schedule; itineraryId?: string; dayId: string; places: number; firstPlace: string | null };

interface Props {
  nav: Nav;
  group: Group;
  /** 모임을 만든 직후처럼 처음 보여 줄 날짜. 없으면 오늘 */
  focusDate?: DateStr;
}

/**
 * UI05 모임 달력. 디자인: docs/stitch/UI05_모임_달력.html
 * 월요일 시작 · 날짜 칸에 일정 최대 3개 + `+N` · 여러 날 일정은 기간의 모든 칸에 띠로 이어 그린다.
 * 일정 카드를 누르면 날짜별 화면을 거치지 않고 일정 요약(UI08)으로 바로 간다.
 */
export function GroupCalendarScreen({ nav, group, focusDate }: Props) {
  const { schedulesOf, loadCalendar, ensureItinerary, calendarView, setCalendarView } = useGroups();
  const toast = useToast();
  const { itineraries } = usePrototype();
  useFlash(toast.show);
  const today = todayKst();
  const [month, setMonth] = useState(monthKey(focusDate || today));
  const [selected, setSelected] = useState<DateStr>(focusDate || today);
  const [menuFor, setMenuFor] = useState<Entry | null>(null);

  // 달력 조회(calendar). 받기 전에는 일정 0개로 그리지 않는다. 받아 둔 달은 먼저 보여 주고 다시 조회한다.
  const [status, setStatus] = useState<'loading' | 'ok' | 'error' | 'forbidden'>('loading');
  const [errorText, setErrorText] = useState('');
  const [loadedMonths, setLoadedMonths] = useState<Set<string>>(() => new Set());
  const requestId = useRef(0);

  const fetchMonth = useCallback(
    async (m: string) => {
      const id = ++requestId.current;
      setStatus('loading');
      const result = await loadCalendar(group.id, m);
      if (id !== requestId.current) return; // 월을 빠르게 넘기면 마지막 요청의 응답만 반영한다.
      if (result.ok) {
        setStatus('ok');
        setLoadedMonths((prev) => new Set(prev).add(m));
      } else if (result.error === 'FORBIDDEN') setStatus('forbidden');
      else {
        setErrorText(commonErrorText(result.error));
        setStatus('error');
      }
    },
    [group.id, loadCalendar],
  );

  // 들어올 때·돌아올 때·월을 바꿀 때 다시 조회한다(기준 월·선택 날짜·스크롤은 그대로).
  useFocusEffect(
    useCallback(() => {
      fetchMonth(month);
    }, [fetchMonth, month]),
  );

  const ready = loadedMonths.has(month);
  const isOwner = group.myRole === 'owner';
  const rawSchedules = ready ? schedulesOf(group.id) : [];
  // 일정마다 날짜를 하루씩 풀어 그날의 제목·장소로 보여 준다(일정 요약 화면을 거치지 않고 그날 화면으로 간다).
  const schedules: Entry[] = rawSchedules.flatMap((sc): Entry[] => {
    const itinerary = sc.itineraryId ? itineraries.find((it) => it.id === sc.itineraryId) : undefined;
    return dayEntriesOf(sc, itinerary).map((en) => ({
      ...sc,
      status: en.cancelled ? ('cancelled' as const) : sc.status,
      id: `${sc.id}::${en.dayId}`,
      title: en.title,
      startDate: en.date,
      endDate: en.date,
      parent: sc,
      itineraryId: itinerary?.id,
      dayId: en.dayId,
      places: en.places,
      firstPlace: en.firstPlace,
    }));
  });

  // 달력 카드를 좌우로 밀어 월을 넘긴다.
  const monthRef = useRef(month);
  monthRef.current = month;
  const swipe = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > 24 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
        onPanResponderRelease: (_e, g) => {
          if (g.dx < -50) setMonth(shiftMonth(monthRef.current, 1));
          else if (g.dx > 50) setMonth(shiftMonth(monthRef.current, -1));
        },
      }),
    [],
  );

  const grid = useMemo(() => monthGrid(month), [month]);
  const lanes = useMemo(() => layoutLanes(grid, schedules), [grid, schedules]);

  const dayList = schedules.filter((sc) => isWithin(selected, sc.startDate, sc.endDate)).sort(scheduleOrder);
  const monthList = schedules
    .filter((sc) => rangesOverlap(sc.startDate, sc.endDate, `${month}-01`, `${month}-31`))
    .sort(scheduleOrder);

  const openSchedule = (en: Entry) => {
    // 아직 열어 본 적 없는 일정도 날짜 탭에 나오도록 모임의 모든 일정을 미리 만들어 둔다.
    const ids = new Map<string, string>();
    for (const sc of rawSchedules) ids.set(sc.id, sc.itineraryId ?? ensureItinerary(sc.id));
    const itineraryId = ids.get(en.parent.id) ?? ensureItinerary(en.parent.id);
    nav.push({ name: 'itineraryDay', tripId: group.tripId, itineraryId, dayId: en.dayId, groupId: group.id });
  };

  const goToday = () => {
    setMonth(monthKey(today));
    setSelected(today);
  };

  const pickDate = (date: DateStr) => {
    setSelected(date);
    if (monthKey(date) !== month) setMonth(monthKey(date));
  };

  if (status === 'forbidden') {
    return (
      <ScreenFrame>
        <AppHeader title={group.name} onBack={nav.back} />
        <View style={styles.forbidden}>
          <Text style={styles.forbiddenText}>이 모임을 확인할 수 없어요.</Text>
          <ActionButton label="내 모임으로" tone="secondary" onPress={nav.home} style={styles.forbiddenButton} />
        </View>
      </ScreenFrame>
    );
  }

  const statusBlock = !ready ? (
    status === 'error' ? (
      <View style={styles.fail} accessibilityRole="alert">
        <Text style={styles.failTitle}>일정을 불러오지 못했어요</Text>
        <Text style={styles.failBody}>{errorText}</Text>
        <ActionButton label="다시 시도" tone="secondary" onPress={() => fetchMonth(month)} style={styles.failRetry} />
      </View>
    ) : (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.primary} accessibilityLabel="일정을 불러오는 중" />
      </View>
    )
  ) : null;

  return (
    <ScreenFrame>
      <AppHeader title={group.name} onBack={nav.back} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.banner}>
          <View style={styles.bannerLeft}>
            <View style={styles.dot} />
            <Text style={styles.bannerName} numberOfLines={1}>
              {group.members.length}/{MAX_MEMBERS}명
            </Text>
            <Pill label={`방장 ${group.members[0]}`} tone="coral" />
            {!isOwner ? <Pill label="나는 참여자" /> : null}
          </View>
          <Pressable
            onPress={() => nav.push({ name: 'members', groupId: group.id })}
            accessibilityRole="button"
            accessibilityLabel="함께하는 친구 보기"
            hitSlop={8}
            style={styles.avatars}
          >
            {group.members.slice(0, 2).map((m, i) => (
              <View key={m} style={[styles.avatar, i === 1 && styles.avatarAlt]}>
                <Text style={styles.avatarText}>{m.slice(0, 1)}</Text>
              </View>
            ))}
            {group.members.length > 2 ? (
              <View style={[styles.avatar, styles.avatarMore]}>
                <Text style={styles.avatarMoreText}>+{group.members.length - 2}</Text>
              </View>
            ) : null}
          </Pressable>
        </View>

        <View style={styles.monthRow}>
          <View style={styles.monthNav}>
            <Pressable onPress={() => setMonth(shiftMonth(month, -1))} accessibilityLabel="이전 달" style={styles.arrow}>
              <Text style={styles.arrowGlyph}>‹</Text>
            </Pressable>
            <Text style={styles.monthTitle}>{monthTitle(month)}</Text>
            <Pressable onPress={() => setMonth(shiftMonth(month, 1))} accessibilityLabel="다음 달" style={styles.arrow}>
              <Text style={styles.arrowGlyph}>›</Text>
            </Pressable>
          </View>
          <Pressable onPress={goToday} accessibilityRole="button" style={styles.todayPill}>
            <Text style={styles.todayText}>오늘</Text>
          </Pressable>
        </View>

        <View style={styles.toolRow}>
          <View style={styles.segment} accessibilityRole="tablist">
            {(['calendar', 'list'] as const).map((v) => (
              <Pressable
                key={v}
                onPress={() => setCalendarView(v)}
                accessibilityRole="tab"
                accessibilityState={{ selected: calendarView === v }}
                style={[styles.segmentItem, calendarView === v && styles.segmentOn]}
              >
                <Text style={[styles.segmentText, calendarView === v && styles.segmentTextOn]}>
                  {v === 'calendar' ? '달력' : '일정 목록'}
                </Text>
              </Pressable>
            ))}
          </View>
          <Pressable
            onPress={() => nav.push({ name: 'invites', groupId: group.id })}
            accessibilityRole="button"
            style={styles.manage}
            hitSlop={6}
          >
            <Text style={styles.manageText}>초대·관리 ›</Text>
          </Pressable>
        </View>

        {ready && status === 'error' ? (
          <Pressable onPress={() => fetchMonth(month)} accessibilityRole="button" style={styles.staleBanner}>
            <Text style={styles.staleText}>최신 정보를 불러오지 못했어요 · 다시 시도</Text>
          </Pressable>
        ) : null}

        {calendarView === 'calendar' ? (
          <>
            <View style={styles.calendarCard} {...swipe.panHandlers}>
              {ready && status === 'loading' ? (
                <ActivityIndicator style={styles.refreshing} size="small" color={colors.primary} />
              ) : null}
              <MonthGrid
                month={month}
                cellHeight={CELL_HEIGHT}
                onPressDate={pickDate}
                labelFor={(d) => {
                  const n = schedules.filter((sc) => isWithin(d, sc.startDate, sc.endDate)).length;
                  return `${monthDayLabel(d)} ${weekdayLabel(d)}요일${n ? `, 일정 ${n}개` : ''}`;
                }}
                renderCell={(date, { inMonth, column }) => (
                  <DayCell
                    date={date}
                    inMonth={inMonth}
                    column={column}
                    isToday={date === today}
                    isSelected={date === selected}
                    lanes={lanes.get(date) ?? []}
                    hidden={
                      schedules.filter((sc) => isWithin(date, sc.startDate, sc.endDate)).length -
                      (lanes.get(date)?.filter(Boolean).length ?? 0)
                    }
                  />
                )}
              />
            </View>

            <View style={styles.listHead}>
              <View style={styles.listHeadLeft}>
                <Text style={styles.listTitle}>{monthDayLabel(selected)} 일정</Text>
                {dayList.length ? (
                  <View style={styles.countBadge}>
                    <Text style={styles.countText}>{dayList.length}</Text>
                  </View>
                ) : null}
              </View>
              <Text style={styles.weekday}>{weekdayLabel(selected)}요일</Text>
            </View>

            {statusBlock ? (
              statusBlock
            ) : dayList.length === 0 ? (
              <EmptyCard isOwner={isOwner} groupEmpty={schedules.length === 0} />
            ) : (
              dayList.map((sc) => (
                <ScheduleCard
                  key={sc.id}
                  schedule={sc}
                  places={sc.places}
                  firstPlace={sc.firstPlace}
                  isOwner={isOwner}
                  today={today}
                  onOpen={() => openSchedule(sc)}
                  onMenu={() => setMenuFor(sc)}
                />
              ))
            )}
          </>
        ) : statusBlock ? (
          statusBlock
        ) : monthList.length === 0 ? (
          <EmptyCard isOwner={isOwner} groupEmpty={schedules.length === 0} monthEmpty />
        ) : (
          monthList.map((sc, i) => (
            <View key={sc.id} style={styles.listGroup}>
              {i === 0 || monthList[i - 1].startDate !== sc.startDate ? (
                <Text style={styles.listDate}>
                  {monthDayLabel(sc.startDate)} {weekdayLabel(sc.startDate)}요일
                </Text>
              ) : null}
              <ScheduleCard
                schedule={sc}
                places={sc.places}
                firstPlace={sc.firstPlace}
                isOwner={isOwner}
                today={today}
                onOpen={() => openSchedule(sc)}
                onMenu={() => setMenuFor(sc)}
              />
            </View>
          ))
        )}
      </ScrollView>

      {isOwner ? (
        <View style={styles.footer}>
          <Pressable
            onPress={() => nav.push({ name: 'scheduleEdit', groupId: group.id, date: selected })}
            accessibilityRole="button"
            style={({ pressed }) => [styles.addButton, pressed && styles.addButtonPressed]}
          >
            <Text style={styles.addText}>＋ 일정 추가</Text>
          </Pressable>
        </View>
      ) : null}

      <ConfirmDialog
        visible={menuFor !== null}
        title={menuFor?.title ?? ''}
        subtitle={menuFor ? periodLabel(menuFor.startDate, menuFor.endDate) : undefined}
        onRequestClose={() => setMenuFor(null)}
        buttons={[
          {
            label: '일정 변경',
            onPress: () => {
              const id = menuFor!.parent.id;
              setMenuFor(null);
              nav.push({ name: 'scheduleEdit', groupId: group.id, scheduleId: id, dayId: menuFor!.dayId });
            },
          },
          { label: '닫기', tone: 'plain', onPress: () => setMenuFor(null) },
        ]}
      />

      <Toast message={toast.message} bottom={isOwner ? 96 : 32} />
    </ScreenFrame>
  );
}

/** 시작 날짜가 빠른 것 → 기간이 긴 것 → 먼저 만든 것 */
function scheduleOrder(a: Schedule, b: Schedule) {
  return a.startDate.localeCompare(b.startDate) || b.endDate.localeCompare(a.endDate) || a.createdAt - b.createdAt;
}

type LaneSlot = { schedule: Schedule; isStart: boolean; isEnd: boolean; showLabel: boolean } | null;

/**
 * 주마다 일정에 줄(lane)을 나눠 준다. 같은 일정은 한 주 안에서 같은 줄에 이어 그려진다.
 * 3줄을 넘는 일정은 칸의 `+N` 으로만 센다.
 */
function layoutLanes(grid: DateStr[], schedules: Schedule[]): Map<DateStr, LaneSlot[]> {
  const out = new Map<DateStr, LaneSlot[]>();
  for (let w = 0; w < 6; w += 1) {
    const week = grid.slice(w * 7, w * 7 + 7);
    const inWeek = schedules.filter((sc) => rangesOverlap(sc.startDate, sc.endDate, week[0], week[6])).sort(scheduleOrder);
    const laneEnds: number[] = [];
    week.forEach((d) =>
      out.set(
        d,
        Array.from({ length: LANES }, () => null),
      ),
    );
    for (const sc of inWeek) {
      const from = Math.max(0, week.indexOf(sc.startDate) === -1 ? 0 : week.indexOf(sc.startDate));
      const toIdx = week.indexOf(sc.endDate);
      const to = toIdx === -1 ? 6 : toIdx;
      let lane = laneEnds.findIndex((endCol) => endCol < from);
      if (lane === -1) {
        lane = laneEnds.length;
        laneEnds.push(to);
      } else laneEnds[lane] = to;
      if (lane >= LANES) continue;
      for (let c = from; c <= to; c += 1) {
        out.get(week[c])![lane] = {
          schedule: sc,
          isStart: week[c] === sc.startDate || c === 0,
          isEnd: week[c] === sc.endDate || c === 6,
          showLabel: week[c] === sc.startDate || c === 0,
        };
      }
    }
  }
  return out;
}

function DayCell({
  date,
  inMonth,
  column,
  isToday,
  isSelected,
  lanes,
  hidden,
}: {
  date: DateStr;
  inMonth: boolean;
  column: number;
  isToday: boolean;
  isSelected: boolean;
  lanes: LaneSlot[];
  hidden: number;
}) {
  return (
    <View style={[styles.cell, !inMonth && styles.cellOut]}>
      <View style={[styles.num, isToday && styles.numToday, isSelected && styles.numSelected]}>
        <Text style={[styles.numText, isSelected && styles.numTextSelected, isToday && !isSelected && styles.numTextToday]}>
          {Number(date.slice(8))}
        </Text>
      </View>
      {lanes.map((slot, i) =>
        slot ? (
          <View
            key={i}
            style={[
              styles.bar,
              slot.schedule.status === 'cancelled' ? styles.barCancelled : styles.barActive,
              slot.isStart && styles.barStart,
              slot.isEnd && styles.barEnd,
              column === 0 && !slot.isStart && styles.barStart,
            ]}
          >
            {slot.showLabel ? (
              <Text
                style={[styles.barText, slot.schedule.status === 'cancelled' && styles.barTextCancelled]}
                numberOfLines={1}
                ellipsizeMode="clip"
              >
                {slot.schedule.title}
              </Text>
            ) : null}
          </View>
        ) : (
          <View key={i} style={styles.barEmpty} />
        ),
      )}
      {hidden > 0 ? <Text style={styles.more}>+{hidden}</Text> : null}
    </View>
  );
}

function ScheduleCard({
  schedule: sc,
  places,
  firstPlace,
  isOwner,
  today,
  onOpen,
  onMenu,
}: {
  schedule: Schedule;
  places: number;
  firstPlace: string | null;
  isOwner: boolean;
  today: DateStr;
  onOpen: () => void;
  onMenu: () => void;
}) {
  const cancelled = sc.status === 'cancelled';
  const status = cancelled
    ? null
    : isWithin(today, sc.startDate, sc.endDate)
      ? '진행 중'
      : sc.startDate > today
        ? '진행 예정'
        : null;
  // 카드 본문과 ⋯ 메뉴를 형제로 둔다(버튼 안에 버튼을 넣지 않는다).
  return (
    <View style={[styles.card, cancelled && styles.cardCancelled]}>
      <Pressable
        onPress={onOpen}
        accessibilityRole="button"
        accessibilityLabel={`${sc.title} ${periodLabel(sc.startDate, sc.endDate)}${cancelled ? ' 취소된 일정' : ''}`}
        style={({ pressed }) => [styles.cardMain, pressed && styles.cardPressed]}
      >
        <View style={styles.cardBody}>
          <Text style={[styles.cardTitle, cancelled && styles.cardTitleCancelled]} numberOfLines={2}>
            {sc.title}
          </Text>
          <Text style={styles.cardMeta} numberOfLines={1}>
            {periodLabel(sc.startDate, sc.endDate)}
            {places ? ` · 장소 ${places}곳` : ''}
          </Text>
          <View style={styles.chips}>
            {cancelled ? <Pill label="취소된 일정" /> : null}
            {!cancelled && firstPlace ? <Pill label={places > 1 ? `${firstPlace} 외 ${places - 1}` : firstPlace} /> : null}
            {status ? <Pill label={status} tone="coral" /> : null}
          </View>
        </View>
      </Pressable>
      {isOwner && !cancelled ? (
        <Pressable onPress={onMenu} accessibilityRole="button" accessibilityLabel="일정 메뉴" style={styles.menu} hitSlop={4}>
          <Text style={styles.menuGlyph}>⋯</Text>
        </Pressable>
      ) : (
        <View style={styles.menu} />
      )}
    </View>
  );
}

function EmptyCard({ isOwner, groupEmpty, monthEmpty }: { isOwner: boolean; groupEmpty: boolean; monthEmpty?: boolean }) {
  const title = groupEmpty ? '아직 일정이 없어요' : monthEmpty ? '이 달에는 일정이 없어요' : '이 날에는 일정이 없어요';
  const body = groupEmpty ? (isOwner ? '일정 추가로 첫 일정을 만들어 보세요.' : '방장이 일정을 추가하면 여기에 보여요.') : null;
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyTitle}>{title}</Text>
      {body ? <Text style={styles.emptyBody}>{body}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: GUTTER, paddingBottom: 28, gap: 12 },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: radius.item - 4,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  bannerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary },
  bannerName: { fontSize: 14, fontWeight: '700', color: colors.text },
  avatars: { flexDirection: 'row' },
  avatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.surfaceStrong,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -6,
    borderWidth: 2,
    borderColor: colors.surface,
  },
  avatarAlt: { backgroundColor: colors.primarySoft },
  avatarText: { fontSize: 11, fontWeight: '700', color: colors.text },
  avatarMore: { backgroundColor: colors.primary },
  avatarMoreText: { fontSize: 10, fontWeight: '800', color: colors.onPrimary },
  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  monthNav: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  arrow: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowGlyph: { fontSize: 24, color: colors.textSub, marginTop: -2 },
  monthTitle: { fontSize: 20, fontWeight: '800', letterSpacing: -0.4, color: colors.text, paddingHorizontal: 4 },
  todayPill: {
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
  },
  todayText: { fontSize: 13, fontWeight: '700', color: colors.text },
  toolRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  segment: { flexDirection: 'row', padding: 4, backgroundColor: colors.surface, borderRadius: 12 },
  segmentItem: { minHeight: 36, justifyContent: 'center', paddingHorizontal: 14, borderRadius: 9 },
  segmentOn: { backgroundColor: colors.bg },
  segmentText: { fontSize: 13, fontWeight: '600', color: colors.textSub },
  segmentTextOn: { color: colors.text, fontWeight: '800' },
  manage: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 4 },
  manageText: { fontSize: 13, fontWeight: '700', color: colors.textSub },
  forbidden: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, paddingHorizontal: GUTTER },
  forbiddenText: { fontSize: 16, fontWeight: '700', color: colors.text },
  forbiddenButton: { alignSelf: 'stretch' },
  loading: { paddingVertical: 32, alignItems: 'center' },
  fail: { backgroundColor: colors.surface, borderRadius: radius.card, padding: 20, gap: 8, alignItems: 'center' },
  failTitle: { fontSize: 15, fontWeight: '800', color: colors.text },
  failBody: { fontSize: 13, lineHeight: 19, color: colors.textSub, textAlign: 'center' },
  failRetry: { alignSelf: 'stretch', marginTop: 4 },
  staleBanner: {
    backgroundColor: '#FDE7E9',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    minHeight: 44,
    justifyContent: 'center',
  },
  staleText: { fontSize: 13, fontWeight: '700', color: colors.danger },
  refreshing: { position: 'absolute', top: 10, right: 12, zIndex: 2 },
  calendarCard: { backgroundColor: colors.surface, borderRadius: radius.card, paddingHorizontal: 6, paddingVertical: 12 },
  cell: { flex: 1, alignItems: 'stretch', paddingTop: 2 },
  cellOut: { opacity: 0.35 },
  num: {
    alignSelf: 'center',
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 3,
  },
  numToday: { borderWidth: 1.5, borderColor: colors.primary },
  numSelected: { backgroundColor: colors.primary, borderWidth: 0 },
  numText: { fontSize: 13, fontWeight: '600', color: colors.text },
  numTextToday: { color: colors.primary, fontWeight: '800' },
  numTextSelected: { color: colors.onPrimary, fontWeight: '800' },
  bar: { height: 14, marginBottom: 2, justifyContent: 'center', paddingHorizontal: 3, overflow: 'hidden' },
  barEmpty: { height: 14, marginBottom: 2 },
  barActive: { backgroundColor: colors.primarySoft },
  barCancelled: { backgroundColor: colors.surfaceStrong },
  barStart: { borderTopLeftRadius: 5, borderBottomLeftRadius: 5, marginLeft: 2 },
  barEnd: { borderTopRightRadius: 5, borderBottomRightRadius: 5, marginRight: 2 },
  barText: { fontSize: 9, fontWeight: '700', color: colors.primaryPressed },
  barTextCancelled: { color: colors.textMuted, textDecorationLine: 'line-through' },
  more: { fontSize: 10, fontWeight: '700', color: colors.textSub, textAlign: 'center' },
  listHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 },
  listHeadLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  listTitle: { fontSize: 18, fontWeight: '800', color: colors.text },
  countBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  countText: { fontSize: 11, fontWeight: '800', color: colors.primary },
  weekday: { fontSize: 12, color: colors.textMuted },
  listGroup: { gap: 8 },
  listDate: { fontSize: 13, fontWeight: '700', color: colors.textSub, marginTop: 6 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    overflow: 'hidden',
    paddingRight: 8,
  },
  cardMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  cardCancelled: { opacity: 0.75 },
  cardPressed: { backgroundColor: colors.surfaceStrong },
  cardBody: { flex: 1, gap: 3 },
  cardTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
  cardTitleCancelled: { color: colors.textMuted, textDecorationLine: 'line-through' },
  cardMeta: { fontSize: 13, color: colors.textSub },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  menu: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22 },
  menuGlyph: { fontSize: 22, color: colors.textSub, fontWeight: '700' },
  empty: { backgroundColor: colors.surface, borderRadius: radius.card, paddingVertical: 28, alignItems: 'center', gap: 6 },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  emptyBody: { fontSize: 13, color: colors.textMuted },
  footer: { paddingHorizontal: GUTTER, paddingTop: 10, paddingBottom: 14 },
  addButton: {
    minHeight: MIN_TOUCH,
    borderRadius: radius.item,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonPressed: { backgroundColor: colors.primaryPressed },
  addText: { fontSize: 17, fontWeight: '800', color: colors.onPrimary },
});
