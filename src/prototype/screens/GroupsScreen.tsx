import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ActionButton, Pill } from '../components/FormParts';
import { ScreenFrame } from '../components/ScreenFrame';
import { Toast, useToast } from '../components/Toast';
import { MAX_MEMBERS, type Group, type Schedule } from '../mock/groupData';
import type { Nav } from '../navigation/routes';
import { commonErrorText, representativeSchedule, useFlash, useGroups } from '../state/GroupsProvider';
import { colors, GUTTER, MIN_TOUCH, radius } from '../styles/tokens';
import { diffDays, todayKst } from '../utils/calendar';

const SUMMARY_PREFIX = { ongoing: '진행 중', next: '다음 일정', recent: '최근 일정' } as const;

/**
 * UI03 내 모임. 디자인: docs/stitch/UI03_내_모임_목록.html
 * 서버가 준 순서(최근 공동 활동순)를 그대로 쓰고, 열람만으로 순서가 바뀌지 않는다.
 */
export function GroupsScreen({ nav }: { nav: Nav }) {
  const { groups, schedulesOf, logout, loadGroups } = useGroups();
  const toast = useToast();
  useFlash(toast.show);
  /** 조회가 끝나기 전에는 "모임 없음"으로 단정하지 않는다. 실패는 빈 목록과 다른 문구로 보여 준다. */
  const [status, setStatus] = useState<'loading' | 'ok' | 'error'>('loading');
  const [errorText, setErrorText] = useState('');

  const refresh = useCallback(async () => {
    const result = await loadGroups();
    if (result.ok) setStatus('ok');
    else {
      setErrorText(commonErrorText(result.error));
      setStatus('error');
    }
  }, [loadGroups]);

  // 화면에 돌아올 때마다 다시 조회한다(스크롤 위치는 그대로).
  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  return (
    <ScreenFrame>
      <View style={styles.topBar}>
        <Text style={styles.topTitle}>내 모임</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.head}>
          <View style={styles.flex}>
            <Text style={styles.title}>함께하는 모임</Text>
            <Text style={styles.sub}>
              {status !== 'ok'
                ? ' '
                : groups.length
                  ? `총 ${groups.length}개의 모임에 참여하고 있어요`
                  : '참여 중인 모임이 없어요'}
            </Text>
          </View>
          {/* 정렬은 한 가지뿐이라 고르는 버튼이 아니라 이름표로 둔다 */}
          <View style={styles.sortPill}>
            <Text style={styles.sortText}>최근 공동 활동순</Text>
          </View>
        </View>

        {status === 'loading' ? (
          <View style={styles.empty}>
            <ActivityIndicator color={colors.primary} accessibilityLabel="모임 목록을 불러오는 중" />
          </View>
        ) : status === 'error' ? (
          <View style={styles.failBox} accessibilityRole="alert">
            <Text style={styles.failTitle}>모임 목록을 불러오지 못했어요</Text>
            <Text style={styles.failBody}>{errorText}</Text>
            <ActionButton
              label="다시 시도"
              tone="secondary"
              onPress={() => {
                setStatus('loading');
                refresh();
              }}
              style={styles.failRetry}
            />
          </View>
        ) : groups.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>아직 함께하는 모임이 없어요</Text>
            <Text style={styles.emptyBody}>모임을 만들거나 받은 초대 코드로 참여해 보세요.</Text>
          </View>
        ) : (
          groups.map((g) => (
            <GroupCard
              key={g.id}
              group={g}
              schedules={schedulesOf(g.id)}
              onOpen={() => nav.push({ name: 'groupCalendar', groupId: g.id })}
            />
          ))
        )}

        {/* 프로토타입 전용: 처음(로그인)부터 다시 보기 */}
        <Pressable onPress={logout} style={styles.demoReset} accessibilityRole="button">
          <Text style={styles.demoResetText}>예시: 로그아웃하고 처음부터 보기</Text>
        </Pressable>
      </ScrollView>

      <View style={styles.actionBar}>
        <Pressable
          onPress={() => nav.push({ name: 'inviteJoin' })}
          accessibilityRole="button"
          style={({ pressed }) => [styles.action, styles.actionSecondary, pressed && styles.pressed]}
        >
          <Text style={styles.actionIcon}>🔑</Text>
          <Text style={styles.actionSecondaryText}>초대 코드로 참여</Text>
        </Pressable>
        <Pressable
          onPress={() => nav.push({ name: 'groupCreate' })}
          accessibilityRole="button"
          style={({ pressed }) => [styles.action, styles.actionPrimary, pressed && styles.actionPrimaryPressed]}
        >
          <Text style={styles.actionPrimaryText}>＋ 모임 만들기</Text>
        </Pressable>
      </View>

      <View style={styles.tabBar}>
        <Tab icon="👥" label="모임" active />
        <Tab icon="📖" label="내 기록" onPress={() => toast.show('내 기록(UI22)은 다른 담당 화면이에요')} />
        <Tab icon="⚙️" label="설정" onPress={() => nav.push({ name: 'settings' })} />
      </View>

      <Toast message={toast.message} bottom={160} />
    </ScreenFrame>
  );
}

function GroupCard({ group, schedules: list, onOpen }: { group: Group; schedules: Schedule[]; onOpen: () => void }) {
  const rep = representativeSchedule(list);
  const today = todayKst();
  // 보관 만료 7일 전·1일 전 안내(앱 안 안내만, 푸시 없음)
  const expiring = list
    .filter((sc) => sc.retentionLastDate)
    .map((sc) => diffDays(today, sc.retentionLastDate!))
    .filter((d) => d >= 0 && d <= 7)
    .sort((a, b) => a - b)[0];

  return (
    <Pressable
      onPress={onOpen}
      accessibilityRole="button"
      accessibilityLabel={`${group.name} 열기`}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
    >
      <View style={styles.cardRow}>
        <View style={styles.thumb}>
          {group.cover ? (
            <Image source={group.cover} style={styles.thumbImg} resizeMode="cover" />
          ) : (
            <Text style={styles.thumbFallback}>{group.name.slice(0, 1)}</Text>
          )}
        </View>
        <View style={styles.cardText}>
          <View style={styles.nameRow}>
            <Pill label={group.myRole === 'owner' ? '방장' : '참여자'} tone={group.myRole === 'owner' ? 'coral' : 'gray'} />
            <Text style={styles.name} numberOfLines={1}>
              {group.name}
            </Text>
          </View>
          <Text style={styles.meta} numberOfLines={1}>
            <Text style={styles.metaStrong}>
              {group.members.length}/{MAX_MEMBERS}명
            </Text>
            {'  ·  '}
            {rep ? (
              `${SUMMARY_PREFIX[rep.kind]}: ${rep.schedule.title}`
            ) : (
              <Text style={styles.metaEmpty}>아직 일정이 없어요</Text>
            )}
          </Text>
        </View>
        <Text style={styles.chevron}>›</Text>
      </View>
      {expiring !== undefined ? (
        <View style={styles.retention}>
          <Text style={styles.retentionText} numberOfLines={1}>
            ⏱ {expiring <= 1 ? '내일 보관이 끝나는 기록이 있어요' : '보관 안내 · 만료 7일 전 기록이 있어요'}
          </Text>
          <Text style={styles.retentionLink}>확인</Text>
        </View>
      ) : null}
    </Pressable>
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
  topBar: { height: 52, justifyContent: 'center', paddingHorizontal: GUTTER },
  topTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  content: { paddingHorizontal: GUTTER, paddingBottom: 24, gap: 12 },
  head: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginBottom: 4 },
  title: { fontSize: 22, fontWeight: '800', letterSpacing: -0.4, color: colors.text },
  sub: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  sortPill: { backgroundColor: colors.surface, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 6 },
  sortText: { fontSize: 11, fontWeight: '600', color: colors.textSub },
  card: { backgroundColor: colors.surface, borderRadius: radius.card, overflow: 'hidden' },
  cardPressed: { backgroundColor: colors.surfaceStrong },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16 },
  thumb: {
    width: 64,
    height: 64,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbImg: { width: '100%', height: '100%' },
  thumbFallback: { fontSize: 24, fontWeight: '800', color: colors.primary },
  cardText: { flex: 1, gap: 6 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { flexShrink: 1, fontSize: 17, fontWeight: '700', color: colors.text },
  meta: { fontSize: 13, color: colors.textSub },
  metaStrong: { fontWeight: '700', color: colors.text },
  metaEmpty: { color: colors.textMuted },
  chevron: { fontSize: 24, color: colors.textMuted },
  retention: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 12,
    marginBottom: 12,
    marginTop: -4,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 12,
    backgroundColor: colors.primarySoft,
  },
  retentionText: { flex: 1, fontSize: 12, fontWeight: '700', color: colors.primaryPressed },
  retentionLink: { fontSize: 11, fontWeight: '700', color: colors.primary, textDecorationLine: 'underline', marginLeft: 8 },
  failBox: { backgroundColor: colors.surface, borderRadius: radius.card, padding: 20, gap: 8, alignItems: 'center' },
  failTitle: { fontSize: 16, fontWeight: '800', color: colors.text },
  failBody: { fontSize: 13, lineHeight: 19, color: colors.textSub, textAlign: 'center' },
  failRetry: { alignSelf: 'stretch', marginTop: 6 },
  empty: { alignItems: 'center', paddingVertical: 64, gap: 8 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  emptyBody: { fontSize: 14, color: colors.textMuted, textAlign: 'center' },
  demoReset: {
    alignSelf: 'center',
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
  },
  demoResetText: { fontSize: 12, fontWeight: '600', color: colors.textSub },
  actionBar: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: GUTTER,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    backgroundColor: colors.bg,
  },
  action: {
    flex: 1,
    minHeight: MIN_TOUCH,
    borderRadius: radius.button,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  actionSecondary: { backgroundColor: colors.surface },
  actionSecondaryText: { fontSize: 15, fontWeight: '700', color: colors.text },
  actionIcon: { fontSize: 15 },
  actionPrimary: { backgroundColor: colors.primary },
  actionPrimaryPressed: { backgroundColor: colors.primaryPressed },
  actionPrimaryText: { fontSize: 16, fontWeight: '800', color: colors.onPrimary },
  pressed: { backgroundColor: colors.surfaceStrong },
  tabBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    height: 62,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    backgroundColor: colors.bg,
  },
  tab: { minWidth: 64, minHeight: 48, alignItems: 'center', justifyContent: 'center', gap: 2 },
  tabIcon: { fontSize: 20 },
  tabIconOff: { opacity: 0.45 },
  tabLabel: { fontSize: 11, fontWeight: '600', color: colors.textMuted },
  tabLabelOn: { color: colors.primary, fontWeight: '800' },
});
