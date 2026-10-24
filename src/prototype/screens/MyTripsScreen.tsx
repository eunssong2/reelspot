import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { CoverThumb } from '../components/CoverThumb';
import { ScreenFrame } from '../components/ScreenFrame';
import { Toast, useToast } from '../components/Toast';
import { itinerariesForTrip, TRIPS } from '../mock/tripData';
import type { Nav } from '../navigation/routes';
import { colors, GUTTER, radius } from '../styles/tokens';

const TABS = [
  { key: 'trips', label: '내 스팟', icon: '◉' },
  { key: 'log', label: '모아보기', icon: '▦' },
  { key: 'alarm', label: '알림', icon: '🔔' },
  { key: 'me', label: '마이페이지', icon: '👤' },
];

/** 1. 내 스팟: 일상을 함께 기록하는 모임 목록. */
export function MyTripsScreen({ nav }: { nav: Nav }) {
  const toast = useToast();
  const [tab, setTab] = useState('trips');

  return (
    <ScreenFrame>
      <View style={styles.top}>
        <View style={styles.brand}>
          <Text style={styles.brandIcon}>●</Text>
          <Text style={styles.brandText}>AT THAT PLACE</Text>
        </View>
        <Pressable
          onPress={() => toast.show('새 모임 만들기는 아직 준비 중이에요')}
          accessibilityRole="button"
          accessibilityLabel="새 모임 만들기"
          style={({ pressed }) => [styles.plus, pressed && styles.pressed]}
        >
          <Text style={styles.plusGlyph}>+</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <Text style={styles.eyebrow}>WITH MY SPOT CREW</Text>
          <Text style={styles.title}>우리의 하루를{`\n`}한 스팟씩 남겨요</Text>
          <Text style={styles.subtitle}>여행이 아니어도 괜찮아요. 함께한 평범한 순간이 기록이 되니까요.</Text>
        </View>

        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>내 스팟 모임</Text>
          <Text style={styles.sectionCount}>{TRIPS.length}개</Text>
        </View>

        {TRIPS.map((trip) => (
          <Pressable
            key={trip.id}
            accessibilityRole="button"
            accessibilityLabel={`${trip.name} 열기`}
            onPress={() => {
              const itinerary = itinerariesForTrip(trip.id)[0];
              if (itinerary) {
                nav.push({ name: 'itinerarySummary', tripId: trip.id, itineraryId: itinerary.id });
              } else {
                toast.show(`${trip.name}에는 아직 만든 일정이 없어요`);
              }
            }}
            style={({ pressed }) => [styles.card, pressed && styles.pressed]}
          >
            <CoverThumb kind={trip.cover} />
            <View style={styles.info}>
              <Text style={styles.name}>{trip.name}</Text>
              <Text style={styles.dest} numberOfLines={1}>
                {trip.destination}
              </Text>
              <Text style={styles.meta} numberOfLines={1}>
                👥 {trip.memberCount}명   ·   {trip.period}
              </Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
        ))}

        <View style={styles.promptCard}>
          <Text style={styles.promptIcon}>✨</Text>
          <View style={styles.promptCopy}>
            <Text style={styles.promptTitle}>오늘은 어떤 하루였나요?</Text>
            <Text style={styles.promptText}>자주 가는 카페, 산책길, 퇴근길도 스팟이 될 수 있어요.</Text>
          </View>
        </View>
      </ScrollView>

      <View style={styles.tabBar}>
        {TABS.map((t) => {
          const active = t.key === tab;
          return (
            <Pressable
              key={t.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              onPress={() => {
                setTab(t.key);
                if (t.key !== 'trips') toast.show(`${t.label} 화면은 아직 준비 중이에요`);
              }}
              style={styles.tab}
            >
              <Text style={[styles.tabIcon, !active && styles.tabIconOff]}>{t.icon}</Text>
              <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{t.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <Toast message={toast.message} bottom={92} />
    </ScreenFrame>
  );
}

const styles = StyleSheet.create({
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 10,
    paddingHorizontal: GUTTER,
    minHeight: 60,
  },
  // "+" 버튼(오른쪽에 절대배치, 너비 44)과 겹치지 않도록 좌우 여백을 두고, 긴 이름에 맞춰 자간을 줄였다.
  brand: { alignItems: 'center', maxWidth: '62%' },
  brandIcon: { fontSize: 12, color: colors.primary },
  brandText: { fontSize: 11, fontWeight: '900', color: colors.text, letterSpacing: 1, marginTop: 3 },
  plus: {
    position: 'absolute',
    right: GUTTER,
    top: 10,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plusGlyph: { color: colors.onPrimary, fontSize: 28, lineHeight: 32, fontWeight: '500' },
  pressed: { opacity: 0.85 },
  content: { paddingHorizontal: GUTTER, paddingTop: 12, paddingBottom: 28, gap: 14 },
  hero: { paddingVertical: 10, gap: 8 },
  eyebrow: { fontSize: 11, fontWeight: '800', color: colors.primary, letterSpacing: 1.3 },
  title: { fontSize: 30, lineHeight: 39, letterSpacing: -1, fontWeight: '900', color: colors.text },
  subtitle: { fontSize: 14, lineHeight: 21, color: colors.textSub, maxWidth: 330 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  sectionTitle: { fontSize: 17, fontWeight: '800', color: colors.text },
  sectionCount: { fontSize: 12, fontWeight: '700', color: colors.textMuted },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: colors.bg,
    borderRadius: radius.card,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.line,
    boxShadow: '0px 6px 18px rgba(25, 31, 40, 0.06)',
  },
  info: { flex: 1, gap: 3 },
  name: { fontSize: 17, fontWeight: '700', color: colors.text },
  dest: { fontSize: 13, color: colors.textSub },
  meta: { fontSize: 12, color: colors.textSub, marginTop: 2 },
  chevron: { fontSize: 28, color: colors.textMuted, marginRight: 4, marginTop: -3 },
  promptCard: { flexDirection: 'row', gap: 12, backgroundColor: '#FFF7F1', borderRadius: radius.card, padding: 16, marginTop: 4 },
  promptIcon: { fontSize: 20 },
  promptCopy: { flex: 1, gap: 3 },
  promptTitle: { fontSize: 14, fontWeight: '800', color: colors.text },
  promptText: { fontSize: 12, lineHeight: 18, color: colors.textSub },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: colors.bg,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingTop: 10,
    paddingBottom: 8,
  },
  tab: { flex: 1, alignItems: 'center', gap: 2, paddingVertical: 4 },
  tabIcon: { fontSize: 22 },
  tabIconOff: { opacity: 0.45 },
  tabLabel: { fontSize: 11, color: colors.textMuted, fontWeight: '600' },
  tabLabelActive: { color: colors.primary },
});
