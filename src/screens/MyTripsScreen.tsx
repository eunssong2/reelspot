import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { CoverThumb } from '../components/CoverThumb';
import { ScreenFrame } from '../components/ScreenFrame';
import { Toast, useToast } from '../components/Toast';
import { TRIPS } from '../mock/tripData';
import type { Nav } from '../navigation/routes';
import { colors, GUTTER, radius, shadow } from '../styles/tokens';

const TABS = [
  { key: 'trips', label: '내 모임', icon: '🏠' },
  { key: 'log', label: '여행 기록', icon: '📓' },
  { key: 'alarm', label: '알림', icon: '🔔' },
  { key: 'me', label: '마이페이지', icon: '👤' },
];

/** 1. 내 모임: 모임 카드 목록. 여행모임 1 을 누르면 여행 일정으로 이동한다. */
export function MyTripsScreen({ nav }: { nav: Nav }) {
  const toast = useToast();
  const [tab, setTab] = useState('trips');

  return (
    <ScreenFrame>
      <View style={styles.top}>
        <View style={styles.brand}>
          <Text style={styles.brandIcon}>🏔️</Text>
          <Text style={styles.brandText}>Travel Together</Text>
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
        <Text style={styles.title}>내 모임</Text>
        <Text style={styles.subtitle}>함께하는 여행이 더 특별해요!</Text>

        {TRIPS.map((trip) => (
          <Pressable
            key={trip.id}
            accessibilityRole="button"
            accessibilityLabel={`${trip.name} 열기`}
            onPress={() =>
              trip.id === 'trip1'
                ? nav.push({ name: 'itinerary', tripId: trip.id })
                : toast.show(`${trip.name}은 프로토타입에서 여행모임 1만 연결돼 있어요`)
            }
            style={({ pressed }) => [styles.card, pressed && styles.pressed]}
          >
            <CoverThumb kind={trip.cover} />
            <View style={styles.info}>
              <Text style={styles.name}>{trip.name}</Text>
              <Text style={styles.dest} numberOfLines={1}>
                {trip.destination}
              </Text>
              <Text style={styles.meta} numberOfLines={1}>
                👥 {trip.memberCount}명   📅 {trip.period}
              </Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
        ))}
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
  brand: { alignItems: 'center' },
  brandIcon: { fontSize: 22 },
  brandText: { fontSize: 13, fontStyle: 'italic', fontWeight: '600', color: colors.primary, letterSpacing: 0.4 },
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
    boxShadow: shadow.float,
  },
  plusGlyph: { color: colors.onPrimary, fontSize: 28, lineHeight: 32, fontWeight: '500' },
  pressed: { opacity: 0.85 },
  content: { paddingHorizontal: GUTTER, paddingTop: 8, paddingBottom: 24, gap: 14 },
  title: { fontSize: 28, fontWeight: '800', color: colors.text },
  subtitle: { fontSize: 14, color: colors.textSub, marginTop: -8, marginBottom: 4 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    padding: 12,
    boxShadow: shadow.card,
  },
  info: { flex: 1, gap: 3 },
  name: { fontSize: 17, fontWeight: '700', color: colors.text },
  dest: { fontSize: 13, color: colors.textSub },
  meta: { fontSize: 12, color: colors.textSub, marginTop: 2 },
  chevron: { fontSize: 28, color: '#9DB3C7', marginRight: 4, marginTop: -3 },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 10,
    paddingBottom: 8,
    boxShadow: '0px -4px 16px rgba(36, 100, 160, 0.10)',
  },
  tab: { flex: 1, alignItems: 'center', gap: 2, paddingVertical: 4 },
  tabIcon: { fontSize: 22 },
  tabIconOff: { opacity: 0.45 },
  tabLabel: { fontSize: 11, color: '#7B8FA3', fontWeight: '600' },
  tabLabelActive: { color: colors.primary },
});
