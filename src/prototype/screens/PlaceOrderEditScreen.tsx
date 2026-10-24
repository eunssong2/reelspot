import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { AppHeader } from '../components/AppHeader';
import { PrimaryButton } from '../components/PrimaryButton';
import { TimeEditModal } from '../components/TimeEditModal';
import { ScreenFrame } from '../components/ScreenFrame';
import type { Itinerary, ItineraryDay, ItineraryPlace } from '../mock/tripData';
import type { Nav } from '../navigation/routes';
import { colors, GUTTER, radius, shadow } from '../styles/tokens';
import { monthDayLabel, dayOfWeekLabel } from '../utils/date';

const MEMO_MAX = 100;
const TITLE_MAX = 30;
/** 입력 중인 "HH:mm" 문자열이 올바른 시각인지 확인한다. */
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/** 숫자만 남기고 "HH:mm" 형태로 다듬는다. 4자리를 넘으면 자른다. */
function normalizeTimeInput(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
}

interface Props {
  nav: Nav;
  tripId: string;
  itinerary: Itinerary;
  day: ItineraryDay;
  onSave: (places: ItineraryPlace[], memo: string, title: string) => void;
}

/**
 * 4. 방문 순서 편집: 순서 번호 · 장소 · 방문 시간을 한 화면에서 고치고 메모와 함께 저장한다.
 * 드래그 대신 위/아래 버튼으로 순서를 바꾼다 — 터치·마우스·키보드 어디서나 똑같이 동작하는
 * 대체 조작이며, 실제로 동작하지 않는 드래그 핸들을 흉내 내지 않는다.
 */
export function PlaceOrderEditScreen({ nav, itinerary, day, onSave }: Props) {
  const [places, setPlaces] = useState<ItineraryPlace[]>(day.places);
  const [memo, setMemo] = useState(day.memo ?? '');
  const [title, setTitle] = useState(day.title ?? '');
  const [saving, setSaving] = useState(false);
  /** 방문 시간을 고치는 중인 장소 id */
  const [timeTargetId, setTimeTargetId] = useState<string | null>(null);
  const timeTarget = places.find((p) => p.id === timeTargetId);

  const subtitle = `${monthDayLabel(day.date)} ${dayOfWeekLabel(day.date)}요일`;

  const move = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= places.length) return;
    setPlaces((prev) => {
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const setTime = (id: string, raw: string) => {
    const normalized = normalizeTimeInput(raw);
    setPlaces((prev) => prev.map((p) => (p.id === id ? { ...p, visitTime: normalized || undefined } : p)));
  };

  const commitTime = (id: string) => {
    setPlaces((prev) =>
      prev.map((p) => (p.id === id && p.visitTime && !TIME_RE.test(p.visitTime) ? { ...p, visitTime: undefined } : p)),
    );
  };

  const save = () => {
    setSaving(true);
    onSave(places, memo.trim(), title.trim());
    nav.back();
  };

  return (
    <ScreenFrame>
      <AppHeader title="장소 순서 편집" subtitle={subtitle} onBack={nav.back} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.titleBlock}>
          <Text style={styles.memoLabel}>날짜 제목</Text>
          <TextInput
            value={title}
            onChangeText={(text) => setTitle(text.slice(0, TITLE_MAX))}
            placeholder="예: 빵 먹고 전시 보고 저녁까지"
            placeholderTextColor={colors.textMuted}
            maxLength={TITLE_MAX}
            style={styles.titleInput}
            accessibilityLabel="날짜 제목"
          />
          <Text style={styles.memoCount}>
            {title.length}/{TITLE_MAX} · 비워 두면 "{monthDayLabel(day.date)}의 장소"로 보여요
          </Text>
        </View>

        <View style={styles.banner}>
          <Text style={styles.bannerText}>
            {places.length > 0
              ? '위·아래 버튼으로 방문 순서를 바꾸세요.'
              : '아직 담은 장소가 없어요. 장소를 담으면 여기서 순서와 시간을 바꿀 수 있어요.'}
          </Text>
        </View>

        {places.map((place, index) => (
          <View key={place.id} style={styles.row}>
            <View style={styles.orderBadge}>
              <Text style={styles.orderBadgeText}>{index + 1}</Text>
            </View>

            <View style={styles.info}>
              <Text style={styles.name} numberOfLines={1}>
                {place.name}
              </Text>
              <Text style={styles.address} numberOfLines={1}>
                {place.address}
              </Text>
              <View style={styles.timeRow}>
                <Text style={styles.timeLabel}>방문 시간</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${place.name} 방문 시간 수정`}
                  onPress={() => setTimeTargetId(place.id)}
                  style={({ pressed }) => [styles.timeInput, pressed && styles.pressed]}
                >
                  <Text style={[styles.timeValue, !place.visitTime && styles.timeValueEmpty]}>
                    {place.visitTime ?? '시간 미정'} ✎
                  </Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.moveCol}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${place.name} 위로`}
                disabled={index === 0}
                onPress={() => move(index, -1)}
                hitSlop={6}
                style={({ pressed }) => [styles.moveBtn, index === 0 && styles.moveBtnDisabled, pressed && styles.pressed]}
              >
                <Text style={[styles.moveGlyph, index === 0 && styles.moveGlyphDisabled]}>▲</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${place.name} 아래로`}
                disabled={index === places.length - 1}
                onPress={() => move(index, 1)}
                hitSlop={6}
                style={({ pressed }) => [
                  styles.moveBtn,
                  index === places.length - 1 && styles.moveBtnDisabled,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={[styles.moveGlyph, index === places.length - 1 && styles.moveGlyphDisabled]}>▼</Text>
              </Pressable>
            </View>
          </View>
        ))}

        <View style={styles.memoBlock}>
          <Text style={styles.memoLabel}>장소 메모</Text>
          <TextInput
            value={memo}
            onChangeText={(text) => setMemo(text.slice(0, MEMO_MAX))}
            placeholder="이 날의 장소 구성에 대해 적어 보세요"
            placeholderTextColor={colors.textMuted}
            multiline
            maxLength={MEMO_MAX}
            style={styles.memoInput}
            accessibilityLabel="장소 메모"
          />
          <Text style={styles.memoCount}>
            {memo.length}/{MEMO_MAX}
          </Text>
        </View>
      </ScrollView>

      <TimeEditModal
        visible={!!timeTarget}
        placeName={timeTarget?.name ?? ''}
        value={timeTarget?.visitTime}
        onSave={(time) => {
          if (timeTargetId) setPlaces((prev) => prev.map((p) => (p.id === timeTargetId ? { ...p, visitTime: time } : p)));
          setTimeTargetId(null);
        }}
        onClose={() => setTimeTargetId(null)}
      />

      <View style={styles.footer}>
        <PrimaryButton label="변경 저장" onPress={save} disabled={saving} />
      </View>
    </ScreenFrame>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: GUTTER, paddingTop: 6, paddingBottom: 24, gap: 10 },
  banner: { backgroundColor: colors.primarySoft, borderRadius: radius.item, padding: 12 },
  bannerText: { fontSize: 13, fontWeight: '700', color: colors.primary, textAlign: 'center' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.bg,
    borderRadius: radius.item,
    padding: 10,
    boxShadow: shadow.soft,
  },
  orderBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orderBadgeText: { fontSize: 11, fontWeight: '800', color: colors.onPrimary },
  info: { flex: 1, gap: 2 },
  name: { fontSize: 14, fontWeight: '700', color: colors.text },
  address: { fontSize: 11, color: colors.textSub },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  timeLabel: { fontSize: 11, color: colors.textMuted },
  timeValue: { fontSize: 13, fontWeight: '700', color: colors.text },
  timeValueEmpty: { color: colors.textMuted },
  timeInput: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
    minWidth: 64,
    outlineWidth: 0,
  },
  moveCol: { gap: 4 },
  moveBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moveBtnDisabled: { opacity: 0.35 },
  moveGlyph: { fontSize: 12, color: colors.text, fontWeight: '800' },
  moveGlyphDisabled: { color: colors.textMuted },
  pressed: { opacity: 0.8 },
  titleBlock: { gap: 6 },
  titleInput: { minHeight: 48, backgroundColor: colors.surface, borderRadius: radius.item, paddingHorizontal: 12, fontSize: 14, color: colors.text, outlineWidth: 0 },
  memoBlock: { marginTop: 8, gap: 6 },
  memoLabel: { fontSize: 14, fontWeight: '700', color: colors.text },
  memoInput: {
    minHeight: 72,
    backgroundColor: colors.surface,
    borderRadius: radius.item,
    padding: 12,
    fontSize: 14,
    color: colors.text,
    textAlignVertical: 'top',
    outlineWidth: 0,
  },
  memoCount: { fontSize: 11, color: colors.textMuted, textAlign: 'right' },
  footer: { paddingHorizontal: GUTTER, paddingTop: 10, paddingBottom: 16 },
});
