import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { IS_DEMO_BUILD } from '../../demo/config';
import { NoticeModal } from '../../demo/NoticeModal';
import { countMedia, recordsForVisit, type MediaCounts } from '../../demo/records';
import { AppHeader } from '../components/AppHeader';
import { CoverEditSheet } from '../components/CoverEditSheet';
import { ItineraryCoverBanner } from '../components/ItineraryCoverBanner';
import { MemberAvatarStack } from '../components/MemberAvatarStack';
import { ScreenFrame } from '../components/ScreenFrame';
import { TRIPS, membersFor, type Itinerary, type ItineraryDay } from '../mock/tripData';
import type { Nav } from '../navigation/routes';
import { usePrototype } from '../state/PrototypeProvider';
import { colors, GUTTER, radius, shadow } from '../styles/tokens';
import { monthDayLabel, tripRangeLabel } from '../utils/date';

interface Props {
  nav: Nav;
  tripId: string;
  /** usePrototype() 의 itineraries 에서 찾은 일정. 못 찾으면 null(잘못된 id 조합 등). */
  itinerary: Itinerary | null;
}

/** 그 날짜 모든 장소의 사진·동영상 개수(방문 단위로 세므로 다른 날짜의 같은 장소 기록이 섞이지 않는다). */
const mediaFor = (itineraryId: string, day: ItineraryDay): MediaCounts =>
  day.places.reduce<MediaCounts>(
    (sum, place) => {
      const c = countMedia(recordsForVisit(itineraryId, day.id, place));
      return { photos: sum.photos + c.photos, videos: sum.videos + c.videos, total: sum.total + c.total };
    },
    { photos: 0, videos: 0, total: 0 },
  );

const mediaLabel = (m: MediaCounts): string =>
  m.total === 0 ? '미디어 없음' : `미디어 ${m.total}개 (사진 ${m.photos}·동영상 ${m.videos})`;

/**
 * 1→2. 모임에서 고른 "이미 생성된 일정"을 조회하는 화면.
 * 일정 이름·기간·참여 인원과, 날짜별 카드(장소 수·사진 수 또는 빈 날 안내)를 보여준다.
 * 일정 생성 폼은 여기 없다 — 일정은 이미 만들어져 있다고 가정하고 읽기만 한다.
 */
export function ItinerarySummaryScreen({ nav, tripId, itinerary }: Props) {
  const trip = TRIPS.find((t) => t.id === tripId);
  const { resetDemo, covers, setCover } = usePrototype();
  const [coverSheet, setCoverSheet] = useState(false);
  const [coverError, setCoverError] = useState<string | null>(null);

  if (!trip || !itinerary) {
    return (
      <ScreenFrame>
        <AppHeader title="일정" onBack={nav.back} />
        <View style={styles.missing}>
          <Text style={styles.missingText}>일정을 찾을 수 없어요.</Text>
        </View>
      </ScreenFrame>
    );
  }

  /**
   * 앨범에서 사진을 골라 대표 사진으로 저장한다(data URI 로 보관).
   * 기기마다 모양이 다른 시스템 자르기 화면은 쓰지 않고, 배너가 가운데를 16:9로 꽉 채워 보여준다.
   */
  const pickCover = async () => {
    setCoverSheet(false);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.4,
        base64: true,
      });
      if (result.canceled || result.assets.length === 0) return;
      const asset = result.assets[0];
      if (!asset.base64) {
        setCoverError('사진을 불러오지 못했어요. 다른 사진을 골라 보세요.');
        return;
      }
      const uri = 'data:' + (asset.mimeType ?? 'image/jpeg') + ';base64,' + asset.base64;
      // AsyncStorage(Android)는 값 하나가 2MB 를 넘으면 읽지 못할 수 있어 여유를 두고 제한한다.
      if (uri.length > 1_400_000) {
        setCoverError('사진 용량이 너무 커요. 더 작은 사진을 골라 보세요.');
        return;
      }
      setCover(itinerary.id, uri);
    } catch {
      setCoverError('사진을 열지 못했어요. 사진 접근 권한을 확인해 주세요.');
    }
  };

  const members = membersFor(trip);

  return (
    <ScreenFrame onDemoReset={IS_DEMO_BUILD ? resetDemo : undefined}>
      <AppHeader
        title="AT THAT PLACE"
        titleStyle={styles.brandTitle}
        onBack={nav.back}
      />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.bannerBleed}>
          <ItineraryCoverBanner
            kind={trip.cover}
            imageUri={covers[itinerary.id]}
            onEdit={() => setCoverSheet(true)}
            square
          />
        </View>

        <View style={styles.intro}>
          <Text style={styles.name}>{itinerary.name}</Text>
          <View style={styles.metaRow}>
            <Text style={styles.metaText}>
              📅 {tripRangeLabel(itinerary.startDate, itinerary.endDate)} · {members.length}명
            </Text>
            <MemberAvatarStack members={members} size={22} max={4} />
          </View>
        </View>

        {itinerary.days.map((day) => (
          <DaySummaryCard
            key={day.id}
            day={day}
            media={mediaFor(itinerary.id, day)}
            onOpen={() => nav.push({ name: 'itineraryDay', tripId, itineraryId: itinerary.id, dayId: day.id })}
            onAddPlaces={() => nav.push({ name: 'placeSearch', tripId, itineraryId: itinerary.id, dayId: day.id })}
          />
        ))}
      </ScrollView>

      <CoverEditSheet
        visible={coverSheet}
        hasCustom={!!covers[itinerary.id]}
        onPick={pickCover}
        onReset={() => {
          setCover(itinerary.id, null);
          setCoverSheet(false);
        }}
        onClose={() => setCoverSheet(false)}
      />
      <NoticeModal
        visible={coverError !== null}
        title="배경 사진"
        message={coverError ?? ''}
        onConfirm={() => setCoverError(null)}
      />
    </ScreenFrame>
  );
}

function DaySummaryCard({
  day,
  media,
  onOpen,
  onAddPlaces,
}: {
  day: ItineraryDay;
  media: MediaCounts;
  onOpen: () => void;
  onAddPlaces: () => void;
}) {
  const hasPlaces = day.places.length > 0;
  const title = day.title ?? `${monthDayLabel(day.date)}의 장소`;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title} 열기`}
      onPress={onOpen}
      style={({ pressed }) => [styles.dayCard, pressed && styles.pressed]}
    >
      <View style={styles.dayCardRow}>
        <Text style={styles.dayDate}>{monthDayLabel(day.date)}</Text>
      </View>

      <View style={styles.dayCardBody}>
        <View style={styles.dayCardInfo}>
          <Text style={styles.dayTitle} numberOfLines={1}>
            {title}
          </Text>
          {hasPlaces ? (
            <Text style={styles.dayStats}>
              장소 {day.places.length}곳 · {mediaLabel(media)}
            </Text>
          ) : (
            <Text style={styles.dayEmptyText}>아직 정한 장소가 없어요</Text>
          )}
        </View>

        <Text style={styles.chevron}>›</Text>
      </View>

      {!hasPlaces ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${title}에 장소 담기`}
          onPress={(e) => {
            e.stopPropagation();
            onAddPlaces();
          }}
          style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}
        >
          <Text style={styles.addButtonText}>＋ 장소 담기</Text>
        </Pressable>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.bg },
  switcher: { gap: 8 },
  switchChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: colors.surface },
  switchChipActive: { backgroundColor: colors.primary },
  switchText: { fontSize: 13, fontWeight: '700', color: colors.textSub },
  switchTextActive: { color: colors.onPrimary },
  // 긴 브랜드명이 뒤로가기·아바타 묶음 사이 좁은 가운데 영역에서 잘리지 않도록 기본 제목보다 줄였다.
  brandTitle: { fontSize: 14, fontWeight: '900', letterSpacing: 0.2 },
  missing: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  missingText: { fontSize: 14, color: colors.textSub },
  content: { paddingHorizontal: GUTTER, paddingBottom: 32, gap: 16 },
  // 좌우 여백(GUTTER)을 상쇄해 배너가 화면 가로 끝까지 닿게 한다.
  bannerBleed: { marginHorizontal: -GUTTER },
  intro: { gap: 8 },
  name: { fontSize: 24, fontWeight: '900', letterSpacing: -0.5, color: colors.text },
  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  metaText: { fontSize: 13, fontWeight: '600', color: colors.textSub },
  dayCard: {
    backgroundColor: colors.bg,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 14,
    gap: 10,
    boxShadow: shadow.soft,
  },
  pressed: { opacity: 0.85 },
  dayCardRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dayDate: { fontSize: 13, fontWeight: '700', color: colors.textSub },
  dayCardBody: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dayCardInfo: { flex: 1, gap: 3 },
  dayTitle: { fontSize: 16, fontWeight: '800', color: colors.text },
  dayStats: { fontSize: 12, color: colors.textSub },
  dayEmptyText: { fontSize: 12, color: colors.textMuted },
  chevron: { fontSize: 24, color: colors.textMuted },
  addButton: {
    backgroundColor: colors.primarySoft,
    borderRadius: radius.item,
    paddingVertical: 11,
    alignItems: 'center',
  },
  addButtonText: { fontSize: 14, fontWeight: '700', color: colors.primary },
});
