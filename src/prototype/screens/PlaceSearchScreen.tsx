import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Keyboard, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { AppHeader } from '../components/AppHeader';
import { PlaceDetailPanel } from '../components/PlaceDetailPanel';
import { PlaceResultSheet, SHEET_COLLAPSED_HEIGHT, type SortKey } from '../components/PlaceResultSheet';
import { PrimaryButton } from '../components/PrimaryButton';
import { ScreenFrame } from '../components/ScreenFrame';
import { Toast, useToast } from '../components/Toast';
import { IS_DEMO_BUILD } from '../../demo/config';
import { missingMapConfig } from '../config/env';
import { DemoMapView } from '../map/DemoMapView';
import { distanceMeters } from '../map/geo';
import { KakaoMapView } from '../map/KakaoMapView';
import { toItineraryPlace } from '../map/placeStyle';
import { CATEGORIES, type CategoryKey, type MapEvent, type MapHandle, type Place, type SearchStatus } from '../map/types';
import type { Itinerary, ItineraryDay, ItineraryPlace } from '../mock/tripData';
import type { Nav } from '../navigation/routes';
import { colors, GUTTER, radius, shadow } from '../styles/tokens';
import { fullDateLabel } from '../utils/date';

/** 지도 타일이 이 시간 안에 그려지지 않으면 설정 문제로 보고 안내한다. */
const TILES_TIMEOUT_MS = 15000;
/** 결과 시트를 펼쳤을 때 지도 영역에서 차지하는 비율 */
const SHEET_RATIO = 0.5;

type Stage = 'loading' | 'sdk' | 'tiles' | 'error';
type Filter = 'all' | CategoryKey;
type LastQuery = { type: 'keyword'; keyword: string } | { type: 'category'; key: CategoryKey } | null;

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: '전체' },
  ...CATEGORIES.map((c) => ({ key: c.key, label: c.label })),
];

interface Props {
  nav: Nav;
  tripId: string;
  itinerary: Itinerary;
  day: ItineraryDay;
  /** 담았으면 true, 이미 그 날짜에 있어 담지 않았으면 false(반환값이 없는 기존 구현은 담은 것으로 본다). */
  onAddPlace: (place: ItineraryPlace) => boolean | void;
}

/**
 * 3. 장소 추가: 실제 카카오 지도(웹은 HTML div, 앱은 WebView) 위에 이름표가 붙은 핀을 표시하고,
 * 아래 결과 시트에 목록을 보여 준다(네이버 지도 스타일).
 * - 마커나 목록 항목을 고르면 아래가 그 장소의 상세 패널로 바뀌고, "이 날의 장소로 추가"로 저장한다.
 * - 결과 목록의 '+ 장소 추가' 버튼으로도 바로 담을 수 있다.
 * 지도를 못 띄우면 임시 지도로 대체하지 않고 카카오가 돌려준 실제 오류를 보여 준다.
 */
export function PlaceSearchScreen({ nav, itinerary, day, onAddPlace }: Props) {
  const toast = useToast();
  const mapRef = useRef<MapHandle>(null);
  const tilesShown = useRef(false);
  /** 지도 중심의 최신 좌표. 검색을 시작할 때의 값을 거리 계산 기준으로 쓴다. */
  const centerRef = useRef<{ lat: number; lng: number } | null>(null);
  const lastQueryRef = useRef<LastQuery>(null);

  const [attempt, setAttempt] = useState(0);
  const [stage, setStage] = useState<Stage>('loading');
  const [error, setError] = useState<string | null>(null);
  const [mapHeight, setMapHeight] = useState(0);

  const [keyword, setKeyword] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [status, setStatus] = useState<SearchStatus>('idle');
  const [excluded, setExcluded] = useState(0);
  const [results, setResults] = useState<Place[]>([]);
  const [origin, setOrigin] = useState<{ lat: number; lng: number } | null>(null);
  const [sort, setSort] = useState<SortKey>('relevance');
  const [sheetOpen, setSheetOpen] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailPlace, setDetailPlace] = useState<Place | null>(null);
  const [saving, setSaving] = useState(false);
  /**
   * 데모 빌드는 인터넷·키 없이도 체험할 수 있게 "예시 검색"(오프라인)으로 시작하고,
   * 지도 키가 있으면 "실제 지도"(카카오, 인터넷 필요)로 바꿔 볼 수 있다. 일반 빌드는 항상 실제 지도다.
   */
  const [mapMode, setMapMode] = useState<'sample' | 'kakao'>(IS_DEMO_BUILD ? 'sample' : 'kakao');
  const sampleMode = IS_DEMO_BUILD && mapMode === 'sample';

  const ready = sampleMode || stage === 'sdk' || stage === 'tiles';
  const keyMissing = !sampleMode && missingMapConfig.length > 0;

  const sheetHeight = Math.round((mapHeight || 600) * SHEET_RATIO);
  const hasResults = results.length > 0;
  const dateLabel = fullDateLabel(day.date);

  const addedIds = useMemo(() => new Set(day.places.map((p) => p.id)), [day]);

  const distances = useMemo(() => {
    const map: Record<string, number> = {};
    if (origin) for (const p of results) map[p.id] = distanceMeters(origin, p);
    return map;
  }, [results, origin]);

  const sorted = useMemo(
    () => (sort === 'distance' ? [...results].sort((a, b) => (distances[a.id] ?? 0) - (distances[b.id] ?? 0)) : results),
    [results, sort, distances],
  );

  const handleEvent = useCallback((event: MapEvent) => {
    switch (event.type) {
      case 'ready':
        setStage((s) => (s === 'tiles' ? s : 'sdk'));
        break;
      case 'tilesLoaded':
        tilesShown.current = true;
        setStage('tiles');
        setError(null);
        break;
      case 'viewChanged':
        centerRef.current = { lat: event.lat, lng: event.lng };
        break;
      case 'sdkError':
        // 이미 지도가 뜬 뒤의 사소한 스크립트 오류는 무시한다.
        if (!tilesShown.current) {
          setError(event.message);
          setStage('error');
        }
        break;
      case 'searchResult':
        setStatus(event.status);
        setExcluded(event.excluded);
        setResults(event.places);
        setSelectedId(null);
        setDetailPlace(null);
        setSheetOpen(true);
        break;
      case 'markerPress':
        Keyboard.dismiss();
        setSelectedId(event.place.id);
        setDetailPlace(event.place);
        break;
      case 'mapPress':
        setSelectedId(null);
        setDetailPlace(null);
        mapRef.current?.select(null);
        break;
      case 'locateResult':
        setOrigin({ lat: event.lat, lng: event.lng });
        break;
      case 'locateError':
        toast.show(event.message);
        break;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** 데모: 예시 검색 ↔ 실제 지도 전환. 이전 모드의 검색 상태는 모두 지운다. */
  const switchMapMode = (next: 'sample' | 'kakao') => {
    if (next === mapMode) return;
    tilesShown.current = false;
    lastQueryRef.current = null;
    centerRef.current = null;
    setMapMode(next);
    setStage('loading');
    setError(null);
    setKeyword('');
    setFilter('all');
    setResults([]);
    setOrigin(null);
    setSelectedId(null);
    setDetailPlace(null);
    setStatus('idle');
    setAttempt((n) => n + 1);
  };

  const retry = () => {
    tilesShown.current = false;
    setStage('loading');
    setError(null);
    setResults([]);
    setSelectedId(null);
    setDetailPlace(null);
    setStatus('idle');
    setAttempt((n) => n + 1);
  };

  useEffect(() => {
    if (sampleMode || keyMissing || stage === 'tiles' || stage === 'error') return;
    const timer = setTimeout(() => {
      setError('지도가 제한 시간 안에 표시되지 않았습니다.');
      setStage('error');
    }, TILES_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [stage, attempt, keyMissing, sampleMode]);

  /** 검색 직전 공통 준비: 시트에 가리지 않게 여백을 알리고, 거리 기준점을 잡는다. */
  const startSearching = () => {
    Keyboard.dismiss();
    mapRef.current?.setPadding(sheetHeight);
    // "현재 위치"로 정한 기준이 있으면 그대로 두고, 없으면 지도 중심을 기준으로 거리를 보여준다.
    setOrigin((prev) => prev ?? centerRef.current);
    setStatus('searching');
    setExcluded(0);
    setResults([]);
    setSelectedId(null);
    setDetailPlace(null);
  };

  const searchKeyword = () => {
    const q = keyword.trim();
    if (!q || !ready) return;
    setFilter('all');
    startSearching();
    lastQueryRef.current = { type: 'keyword', keyword: q };
    mapRef.current?.search(q);
  };

  const pickFilter = (next: Filter) => {
    if (!ready) return;
    setFilter(next);
    if (next === 'all') {
      // '전체'는 카테고리 검색을 풀고, 검색어가 있으면 그 검색어로 다시 찾는다.
      const q = keyword.trim();
      if (q) {
        startSearching();
        lastQueryRef.current = { type: 'keyword', keyword: q };
        mapRef.current?.search(q);
      } else {
        mapRef.current?.clear();
        setResults([]);
        setSelectedId(null);
        setDetailPlace(null);
        setStatus('idle');
        lastQueryRef.current = null;
      }
      return;
    }
    setKeyword('');
    startSearching();
    lastQueryRef.current = { type: 'category', key: next };
    mapRef.current?.searchCategory(next);
  };

  /** 지도를 옮긴 뒤 같은 검색을 현재 지도 범위에서 다시 실행한다. */
  const researchHere = () => {
    const q = lastQueryRef.current;
    if (!q || !ready) return;
    startSearching();
    if (q.type === 'keyword') mapRef.current?.search(q.keyword);
    else mapRef.current?.searchCategory(q.key);
  };

  const locateMe = () => {
    if (!ready) return;
    mapRef.current?.locate();
  };

  const selectResult = (place: Place) => {
    setSelectedId(place.id);
    setDetailPlace(place);
    mapRef.current?.select(place.id);
  };

  const commitAddPlace = (place: Place) => {
    if (addedIds.has(place.id) || saving) return;
    setSaving(true);
    const item = toItineraryPlace(place);
    // 프로토타입은 실제 저장 API가 없어 지연을 흉내 내지 않고 바로 반영한다(실패를 꾸며내지 않는다).
    const added = onAddPlace(item);
    setSaving(false);
    if (added === false) {
      toast.show(`${item.name}은(는) 이미 ${dateLabel} 장소에 담겨 있어요`);
      return;
    }
    // 담으면 곧바로 그 날짜의 장소 목록으로 돌아가 추가된 것을 확인하게 한다(목록에서 "추가됨"으로 강조된다).
    nav.back();
  };

  const excludedNote = excluded > 0 ? ` (서울 밖 ${excluded}곳 제외)` : '';
  const message =
    status === 'searching'
      ? '검색 중…'
      : status === 'empty'
        ? sampleMode
        ? '예시 장소 중에 찾는 결과가 없어요. 다른 검색어를 입력해 보세요'
        : `서울특별시 안의 검색 결과가 없어요${excludedNote}`
        : status === 'error'
          ? '검색에 실패했어요. 잠시 후 다시 시도해 주세요.'
          : sampleMode
            ? '예시 장소를 검색하거나 카테고리를 눌러 보세요 (예: 카페, 성수, 호텔)'
            : '장소를 검색하거나 카테고리를 눌러 보세요';

  return (
    <ScreenFrame>
      <AppHeader title="장소 추가" subtitle={`${itinerary.name} · ${dateLabel}`} onBack={nav.back} />

      <View style={styles.searchArea}>
        <View style={styles.searchBox}>
          <Pressable onPress={searchKeyword} hitSlop={8} accessibilityRole="button" accessibilityLabel="검색">
            <Text style={styles.searchIcon}>🔍</Text>
          </Pressable>
          <TextInput
            style={styles.input}
            value={keyword}
            onChangeText={setKeyword}
            placeholder="장소를 검색하세요 (예: 성수 카페)"
            placeholderTextColor={colors.textMuted}
            returnKeyType="search"
            onSubmitEditing={searchKeyword}
            editable={ready}
            accessibilityLabel="장소 검색"
          />
          {keyword ? (
            <Pressable onPress={() => setKeyword('')} hitSlop={10} accessibilityLabel="검색어 지우기">
              <Text style={styles.clear}>✕</Text>
            </Pressable>
          ) : null}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {FILTERS.map((f) => {
            const active = f.key === filter;
            return (
              <Pressable
                key={f.key}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                onPress={() => pickFilter(f.key)}
                style={[styles.chip, active && styles.chipActive, !ready && styles.chipDisabled]}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{f.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {IS_DEMO_BUILD ? (
        <View style={styles.modeRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: sampleMode }}
            onPress={() => switchMapMode('sample')}
            style={[styles.modeChip, sampleMode && styles.modeChipActive]}
          >
            <Text style={[styles.modeText, sampleMode && styles.modeTextActive]}>예시 검색 (오프라인)</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: !sampleMode }}
            onPress={() => switchMapMode('kakao')}
            style={[styles.modeChip, !sampleMode && styles.modeChipActive]}
          >
            <Text style={[styles.modeText, !sampleMode && styles.modeTextActive]}>실제 지도 (인터넷 필요)</Text>
          </Pressable>
        </View>
      ) : null}
      {sampleMode ? (
        <Text style={styles.sampleNotice}>※ 아래 결과는 데모용 예시 장소예요. 실제 지도 검색 결과가 아닙니다.</Text>
      ) : null}

      <View style={styles.mapWrap} onLayout={(e) => setMapHeight(e.nativeEvent.layout.height)}>
        {sampleMode ? (
          <DemoMapView key={`sample-${attempt}`} ref={mapRef} onEvent={handleEvent} />
        ) : keyMissing ? (
          <View style={styles.notice}>
            <Text style={styles.noticeTitle}>카카오 지도 키가 아직 없어요</Text>
            <Text style={styles.noticeBody}>
              {IS_DEMO_BUILD
                ? '이 테스트 앱에는 카카오 지도 키가 들어 있지 않아요. 예시 검색으로 장소 추가를 체험해 보세요.'
                : '프로젝트 폴더의 .env 에 EXPO_PUBLIC_KAKAO_JS_KEY 를 채운 뒤 npx expo start -c 로 다시 시작하세요.'}
            </Text>
            {IS_DEMO_BUILD ? <PrimaryButton label="예시 검색으로 체험하기" onPress={() => switchMapMode('sample')} /> : null}
          </View>
        ) : (
          <KakaoMapView key={attempt} ref={mapRef} onEvent={handleEvent} />
        )}

        {!sampleMode && !keyMissing && (stage === 'loading' || stage === 'sdk') ? (
          <View style={styles.loading}>
            <Text style={styles.loadingText}>지도를 불러오는 중…</Text>
          </View>
        ) : null}

        {ready && lastQueryRef.current ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="이 지역 다시 검색"
            onPress={researchHere}
            style={({ pressed }) => [styles.research, pressed && styles.pressed]}
          >
            <Text style={styles.researchText}>⟳ 이 지역 다시 검색</Text>
          </Pressable>
        ) : null}

        {ready ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="현재 위치로 이동"
            onPress={locateMe}
            style={({ pressed }) => [styles.locateBtn, pressed && styles.pressed]}
          >
            <Text style={styles.locateGlyph}>⦿</Text>
          </Pressable>
        ) : null}

        {stage === 'error' ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorTitle}>{error}</Text>
            <ScrollView style={styles.errorScroll}>
              <Text style={styles.errorBody}>
                {[
                  '카카오 콘솔에서 확인할 것',
                  '• [앱] > [플랫폼 키] > JavaScript 키 > JavaScript SDK 도메인에 위 출처가 있는지',
                  '• [카카오맵] > [사용 설정] 이 ON 인지',
                  '• .env 의 키가 JavaScript 키(REST API 키 아님)인지',
                ].join('\n')}
              </Text>
            </ScrollView>
            <PrimaryButton label="다시 시도" onPress={retry} />
            {IS_DEMO_BUILD ? <PrimaryButton label="예시 검색으로 체험하기" onPress={() => switchMapMode('sample')} /> : null}
          </View>
        ) : null}

        {detailPlace ? (
          <PlaceDetailPanel
            place={detailPlace}
            dateLabel={dateLabel}
            added={addedIds.has(detailPlace.id)}
            saving={saving}
            onClose={() => {
              setDetailPlace(null);
              setSelectedId(null);
              mapRef.current?.select(null);
            }}
            onAdd={() => commitAddPlace(detailPlace)}
          />
        ) : hasResults ? (
          <PlaceResultSheet
            places={sorted}
            distances={distances}
            selectedId={selectedId}
            sort={sort}
            onToggleSort={() => setSort((s) => (s === 'relevance' ? 'distance' : 'relevance'))}
            open={sheetOpen}
            onToggleOpen={() => setSheetOpen((o) => !o)}
            height={sheetHeight}
            dayNumber={day.dayNumber}
            addedIds={addedIds}
            onPressPlace={selectResult}
            onAdd={commitAddPlace}
          />
        ) : ready ? (
          <View style={styles.hint}>
            <Text style={styles.hintText}>{message}</Text>
          </View>
        ) : null}
      </View>

      <Toast
        message={toast.message}
        bottom={(detailPlace ? 220 : hasResults ? (sheetOpen ? sheetHeight : SHEET_COLLAPSED_HEIGHT) : 0) + 24}
      />
    </ScreenFrame>
  );
}

const styles = StyleSheet.create({
  searchArea: { paddingHorizontal: GUTTER, gap: 10, paddingBottom: 12 },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.surface,
    borderRadius: radius.item,
    paddingHorizontal: 14,
    minHeight: 48,
    boxShadow: shadow.soft,
  },
  searchIcon: { fontSize: 15 },
  input: { flex: 1, fontSize: 15, color: colors.text, paddingVertical: 10, outlineWidth: 0 },
  clear: { fontSize: 14, color: colors.textSub },
  chips: { gap: 8 },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipDisabled: { opacity: 0.5 },
  modeRow: { flexDirection: 'row', gap: 8, paddingHorizontal: GUTTER, paddingBottom: 8 },
  modeChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 7,
    borderRadius: radius.item,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.bg,
  },
  modeChipActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  modeText: { fontSize: 12, fontWeight: '700', color: colors.textSub },
  modeTextActive: { color: colors.primary },
  sampleNotice: { fontSize: 12, fontWeight: '600', color: colors.primary, paddingHorizontal: GUTTER, paddingBottom: 8 },
  chipText: { fontSize: 13, fontWeight: '600', color: colors.textSub },
  chipTextActive: { color: colors.onPrimary },

  mapWrap: {
    flex: 1,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#F1EFE7',
  },

  notice: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 10 },
  noticeTitle: { fontSize: 17, fontWeight: '800', color: colors.text },
  noticeBody: { fontSize: 14, color: colors.textSub, textAlign: 'center', lineHeight: 21 },

  loading: { position: 'absolute', pointerEvents: 'none', top: 16, left: 0, right: 0, alignItems: 'center', zIndex: 10 },
  loadingText: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
    overflow: 'hidden',
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSub,
  },

  research: {
    position: 'absolute',
    top: 16,
    alignSelf: 'center',
    backgroundColor: colors.bg,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: radius.pill,
    boxShadow: shadow.float,
    zIndex: 9,
  },
  researchText: { fontSize: 12, fontWeight: '700', color: colors.text },
  pressed: { opacity: 0.85 },

  locateBtn: {
    position: 'absolute',
    right: 12,
    bottom: 100,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: shadow.float,
    zIndex: 9,
  },
  locateGlyph: { fontSize: 17, color: colors.primary },

  errorCard: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 16,
    padding: 16,
    gap: 12,
    borderRadius: radius.card,
    backgroundColor: colors.bg,
    boxShadow: shadow.float,
    zIndex: 10,
  },
  errorScroll: { maxHeight: 200 },
  errorTitle: { fontSize: 14, fontWeight: '700', color: colors.danger, lineHeight: 20 },
  errorBody: { fontSize: 13, color: colors.textSub, lineHeight: 20 },

  hint: { position: 'absolute', pointerEvents: 'none', left: 0, right: 0, bottom: 20, alignItems: 'center', zIndex: 10 },
  hintText: {
    backgroundColor: 'rgba(35,39,47,0.82)',
    color: colors.onPrimary,
    fontSize: 13,
    fontWeight: '600',
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: radius.pill,
    overflow: 'hidden',
    maxWidth: '92%',
    textAlign: 'center',
  },
});
