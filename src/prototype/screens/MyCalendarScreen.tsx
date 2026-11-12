import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { MonthGrid } from '../components/MonthGrid';
import { ScreenFrame } from '../components/ScreenFrame';
import { Toast, useToast } from '../components/Toast';
import type { Group } from '../mock/groupData';
import type { Nav } from '../navigation/routes';
import { useGroups } from '../state/GroupsProvider';
import { usePrototype } from '../state/PrototypeProvider';
import { colors, GUTTER, MIN_TOUCH, radius } from '../styles/tokens';
import {
  isWithin,
  monthDayLabel,
  monthKey,
  monthTitle,
  shiftMonth,
  todayKst,
  weekdayLabel,
  type DateStr,
} from '../utils/calendar';
import { dayEntriesOf } from '../utils/dayEntries';

const CELL_HEIGHT = 62;
/** 날짜 칸에 찍는 점의 최대 개수. 넘치면 마지막에 +N 으로 적는다. */
const MAX_DOTS = 3;
/** 모임을 구분하는 점 색. 모임 순서대로 돌려 쓴다. */
const GROUP_COLORS = ['#F1706B', '#5B8DEF', '#3FB984', '#F2A33C', '#9B7BEF', '#E36FA8'];

/** 한 날짜에 놓이는 일정 한 줄. 어느 모임의 일정인지 함께 들고 다닌다. */
interface Row {
  key: string;
  groupId: string;
  groupName: string;
  color: string;
  title: string;
  date: DateStr;
  places: number;
  cancelled: boolean;
}

/**
 * 내 달력 — 참여 중인 모든 모임의 일정을 한 달력에서 본다.
 * 모임 안(UI05)은 일정 목록만 보여 주고, 날짜로 훑어보는 일은 이 화면이 맡는다.
 * 일정을 고치는 기능은 두지 않는다(확인 전용). 누르면 그 모임의 그날 화면으로 간다.
 */
export function MyCalendarScreen({ nav }: { nav: Nav }) {
  const { groups, schedulesOf, loadCalendar } = useGroups();
  const { itineraries } = usePrototype();
  const toast = useToast();
  const today = todayKst();
  const [month, setMonth] = useState(monthKey(today));
  const [selected, setSelected] = useState<DateStr>(today);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const requestId = useRef(0);

  // 모임마다 그 달을 조회한다. 하나라도 실패하면 안내만 띄우고, 받아 둔 모임은 그대로 보여 준다.
  const fetchMonth = useCallback(
    async (m: string) => {
      const id = ++requestId.current;
      setLoading(true);
      const results = await Promise.all(groups.map((g) => loadCalendar(g.id, m)));
      if (id !== requestId.current) return; // 월을 빠르게 넘기면 마지막 요청만 반영한다.
      setFailed(results.some((r) => !r.ok));
      setLoading(false);
    },
    [groups, loadCalendar],
  );

  useFocusEffect(
    useCallback(() => {
      fetchMonth(month);
    }, [fetchMonth, month]),
  );

  // 모든 모임의 일정을 하루 단위로 풀어 한 배열에 모은다.
  const rows: Row[] = groups.flatMap((g: Group, gi) =>
    schedulesOf(g.id).flatMap((sc) => {
      const itinerary = sc.itineraryId ? itineraries.find((it) => it.id === sc.itineraryId) : undefined;
      return dayEntriesOf(sc, itinerary).map((en) => ({
        key: `${sc.id}::${en.dayId}`,
        groupId: g.id,
        groupName: g.name,
        color: GROUP_COLORS[gi % GROUP_COLORS.length],
        title: en.title,
        date: en.date,
        places: en.places,
        cancelled: en.cancelled || sc.status === 'cancelled',
      }));
    }),
  );

  const rowsOn = (date: DateStr) => rows.filter((r) => isWithin(date, r.date, r.date));
  const dayList = rowsOn(selected);
  const monthRows = rows.filter((r) => monthKey(r.date) === month);
  /** 이 달에 일정이 있는 모임만 색 범례로 보여 준다. */
  const legend = groups
    .map((g, gi) => ({ name: g.name, color: GROUP_COLORS[gi % GROUP_COLORS.length], id: g.id }))
    .filter((g) => monthRows.some((r) => r.groupId === g.id));

  return (
    <ScreenFrame>
      <View style={styles.topBar}>
        <View style={styles.flex}>
          <Text style={styles.topTitle}>달력</Text>
          <Text style={styles.topSub}>
            {groups.length ? '모든 모임의 일정을 한눈에' : '참여 중인 모임이 없어요'}
          </Text>
        </View>
        {monthRows.length ? (
          <View style={styles.monthCount}>
            <Text style={styles.monthCountText}>이 달 {monthRows.length}개</Text>
          </View>
        ) : null}
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.calendarCard}>
          <View style={styles.monthRow}>
            <Text style={styles.monthTitle}>{monthTitle(month)}</Text>
            <View style={styles.monthNav}>
              <Pressable
                onPress={() => setMonth(shiftMonth(month, -1))}
                accessibilityLabel="이전 달"
                style={({ pressed }) => [styles.arrow, pressed && styles.arrowPressed]}
              >
                <Text style={styles.arrowGlyph}>‹</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setMonth(monthKey(today));
                  setSelected(today);
                }}
                accessibilityRole="button"
                style={({ pressed }) => [styles.todayPill, pressed && styles.arrowPressed]}
              >
                <Text style={styles.todayText}>오늘</Text>
              </Pressable>
              <Pressable
                onPress={() => setMonth(shiftMonth(month, 1))}
                accessibilityLabel="다음 달"
                style={({ pressed }) => [styles.arrow, pressed && styles.arrowPressed]}
              >
                <Text style={styles.arrowGlyph}>›</Text>
              </Pressable>
            </View>
          </View>

          {loading ? <ActivityIndicator style={styles.refreshing} size="small" color={colors.primary} /> : null}

          <MonthGrid
            month={month}
            cellHeight={CELL_HEIGHT}
            onPressDate={(date) => {
              setSelected(date);
              if (monthKey(date) !== month) setMonth(monthKey(date));
            }}
            labelFor={(d) => {
              const n = rowsOn(d).length;
              return `${monthDayLabel(d)} ${weekdayLabel(d)}요일${n ? `, 일정 ${n}개` : ''}`;
            }}
            renderCell={(date, { inMonth }) => {
              const list = rowsOn(date);
              const isToday = date === today;
              const isSelected = date === selected;
              return (
                <View style={styles.cell}>
                  <View
                    style={[styles.dateBubble, isToday && !isSelected && styles.dateBubbleToday, isSelected && styles.dateBubbleOn]}
                  >
                    <Text
                      style={[
                        styles.cellDate,
                        !inMonth && styles.cellDateOut,
                        isToday && !isSelected && styles.cellDateToday,
                        isSelected && styles.cellDateOn,
                      ]}
                    >
                      {Number(date.slice(8, 10))}
                    </Text>
                  </View>
                  <View style={styles.dots}>
                    {list.slice(0, MAX_DOTS).map((r) => (
                      <View key={r.key} style={[styles.dot, { backgroundColor: r.color }, r.cancelled && styles.dotOff]} />
                    ))}
                    {list.length > MAX_DOTS ? <Text style={styles.more}>+{list.length - MAX_DOTS}</Text> : null}
                  </View>
                </View>
              );
            }}
          />

          {legend.length > 1 ? (
            <View style={styles.legend}>
              {legend.map((g) => (
                <View key={g.id} style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: g.color }]} />
                  <Text style={styles.legendText} numberOfLines={1}>
                    {g.name}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>

        {failed ? (
          <Pressable onPress={() => fetchMonth(month)} accessibilityRole="button" style={styles.staleBanner}>
            <Text style={styles.staleText}>일부 모임을 불러오지 못했어요 · 다시 시도</Text>
          </Pressable>
        ) : null}

        <View style={styles.listHead}>
          <Text style={styles.listTitle}>{monthDayLabel(selected)}</Text>
          <Text style={styles.listWeekday}>{weekdayLabel(selected)}요일</Text>
          {selected === today ? (
            <View style={styles.todayBadge}>
              <Text style={styles.todayBadgeText}>오늘</Text>
            </View>
          ) : null}
          <View style={styles.flex} />
          {dayList.length ? <Text style={styles.listCount}>{dayList.length}개</Text> : null}
        </View>

        {dayList.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>🗓</Text>
            <Text style={styles.emptyTitle}>이날은 일정이 없어요</Text>
            <Text style={styles.emptyBody}>
              {monthRows.length ? '점이 찍힌 날짜를 눌러 보세요.' : '이 달에는 아직 잡힌 일정이 없어요.'}
            </Text>
          </View>
        ) : (
          dayList.map((row) => (
            <Pressable
              key={row.key}
              onPress={() => nav.push({ name: 'groupCalendar', groupId: row.groupId, focusDate: row.date })}
              accessibilityRole="button"
              accessibilityLabel={`${row.groupName} ${row.title} 열기`}
              style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
            >
              <View style={styles.cardText}>
                <View style={styles.groupRow}>
                  <View style={[styles.groupDot, { backgroundColor: row.color }]} />
                  <Text style={styles.cardGroup} numberOfLines={1}>
                    {row.groupName}
                  </Text>
                </View>
                <Text style={[styles.cardTitle, row.cancelled && styles.cardTitleOff]} numberOfLines={1}>
                  {row.title}
                </Text>
                <Text style={styles.cardMeta}>
                  {row.cancelled ? '취소된 일정' : row.places ? `📍 장소 ${row.places}곳` : '아직 장소가 없어요'}
                </Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </Pressable>
          ))
        )}
      </ScrollView>

      <View style={styles.tabBar}>
        <Tab icon="👥" label="모임" onPress={() => nav.home()} />
        <Tab icon="🗓" label="달력" active />
        <Tab icon="👤" label="마이페이지" onPress={() => nav.push({ name: 'myPage' })} />
      </View>

      <Toast message={toast.message} bottom={160} />
    </ScreenFrame>
  );
}

function Tab({ icon, label, active, onPress }: { icon: string; label: string; active?: boolean; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="tab" accessibilityState={{ selected: Boolean(active) }} style={styles.tab}>
      <Text style={[styles.tabIcon, !active && styles.tabIconOff]}>{icon}</Text>
      <Text style={[styles.tabLabel, active && styles.tabLabelOn]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },

  topBar: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: GUTTER, paddingTop: 10, paddingBottom: 8 },
  topTitle: { fontSize: 20, fontWeight: '800', color: colors.text, letterSpacing: -0.4 },
  topSub: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  monthCount: { backgroundColor: colors.primarySoft, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 7 },
  monthCountText: { fontSize: 12, fontWeight: '800', color: colors.primary },

  content: { paddingHorizontal: GUTTER, paddingBottom: 24, gap: 14 },

  calendarCard: { backgroundColor: colors.surface, borderRadius: radius.card, paddingHorizontal: 10, paddingTop: 6, paddingBottom: 10 },
  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 6, paddingVertical: 8 },
  monthTitle: { fontSize: 17, fontWeight: '800', color: colors.text, letterSpacing: -0.3 },
  monthNav: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  arrow: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  arrowPressed: { backgroundColor: colors.surfaceStrong },
  arrowGlyph: { fontSize: 18, fontWeight: '700', color: colors.textSub, marginTop: -2 },
  todayPill: { backgroundColor: colors.bg, borderRadius: radius.pill, paddingHorizontal: 12, height: 32, justifyContent: 'center' },
  todayText: { fontSize: 12, fontWeight: '800', color: colors.textSub },
  refreshing: { position: 'absolute', right: 16, top: 16, zIndex: 1 },

  cell: { flex: 1, alignItems: 'center', paddingTop: 5, gap: 5 },
  dateBubble: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  dateBubbleToday: { backgroundColor: colors.primarySoft },
  dateBubbleOn: { backgroundColor: colors.primary },
  cellDate: { fontSize: 13, fontWeight: '600', color: colors.text },
  cellDateOut: { color: colors.textMuted, opacity: 0.45 },
  cellDateToday: { color: colors.primary, fontWeight: '800' },
  cellDateOn: { color: colors.onPrimary, fontWeight: '800' },
  dots: { flexDirection: 'row', alignItems: 'center', gap: 3, minHeight: 7 },
  dot: { width: 5, height: 5, borderRadius: 3 },
  dotOff: { opacity: 0.3 },
  more: { fontSize: 9, fontWeight: '700', color: colors.textMuted, marginLeft: 1 },

  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: 6, paddingTop: 10 },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.bg,
    borderRadius: radius.pill,
    paddingHorizontal: 9,
    paddingVertical: 5,
    maxWidth: 150,
  },
  legendDot: { width: 6, height: 6, borderRadius: 3 },
  legendText: { flexShrink: 1, fontSize: 11, fontWeight: '700', color: colors.textSub },

  staleBanner: { backgroundColor: colors.primarySoft, borderRadius: radius.item, padding: 11, alignItems: 'center' },
  staleText: { fontSize: 12, fontWeight: '700', color: colors.primaryPressed },

  listHead: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2, paddingHorizontal: 2 },
  listTitle: { fontSize: 17, fontWeight: '800', color: colors.text, letterSpacing: -0.3 },
  listWeekday: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  todayBadge: { backgroundColor: colors.primary, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 3 },
  todayBadgeText: { fontSize: 10, fontWeight: '800', color: colors.onPrimary },
  listCount: { fontSize: 12, fontWeight: '700', color: colors.textMuted },

  empty: { backgroundColor: colors.surface, borderRadius: radius.card, paddingVertical: 36, alignItems: 'center', gap: 6 },
  emptyIcon: { fontSize: 28, marginBottom: 2 },
  emptyTitle: { fontSize: 15, fontWeight: '800', color: colors.text },
  emptyBody: { fontSize: 12.5, color: colors.textMuted, textAlign: 'center' },

  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: radius.card },
  cardPressed: { backgroundColor: colors.surfaceStrong },
  cardText: { flex: 1, paddingVertical: 14, paddingLeft: 16, gap: 4 },
  groupRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  groupDot: { width: 7, height: 7, borderRadius: 4 },
  cardGroup: { flexShrink: 1, fontSize: 11.5, fontWeight: '800', color: colors.textSub },
  cardTitle: { fontSize: 16, fontWeight: '700', color: colors.text, letterSpacing: -0.2 },
  cardTitleOff: { color: colors.textMuted, textDecorationLine: 'line-through' },
  cardMeta: { fontSize: 12.5, color: colors.textMuted },
  chevron: { fontSize: 22, color: colors.textMuted, paddingHorizontal: 14 },

  tabBar: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: colors.line, backgroundColor: colors.bg },
  tab: { flex: 1, minHeight: MIN_TOUCH, alignItems: 'center', justifyContent: 'center', gap: 3, paddingVertical: 6 },
  tabIcon: { fontSize: 18 },
  tabIconOff: { opacity: 0.45 },
  tabLabel: { fontSize: 11, fontWeight: '600', color: colors.textMuted },
  tabLabelOn: { color: colors.primary, fontWeight: '800' },
});
