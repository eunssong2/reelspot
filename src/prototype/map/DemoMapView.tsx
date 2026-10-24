import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Line, Polyline } from 'react-native-svg';

import { DEMO_SAMPLE_PLACES } from '../../demo/demoData';
import { searchSampleByCategory, searchSamplePlaces } from '../../demo/sampleSearch';
import { colors } from '../styles/tokens';
import { styleForCategory } from './placeStyle';
import { SEOUL_CITY_HALL } from './seoul';
import type { CategoryKey, MapEvent, MapHandle, Place } from './types';

interface Props {
  onEvent: (event: MapEvent) => void;
}

/** 한강을 단순화한 예시 선(경도, 위도). 실제 지형과 다르며 위치 감을 주기 위한 그림일 뿐이다. */
const RIVER: [number, number][] = [
  [126.8, 37.585],
  [126.86, 37.572],
  [126.9, 37.552],
  [126.93, 37.535],
  [126.97, 37.522],
  [127.02, 37.52],
  [127.07, 37.527],
  [127.12, 37.537],
  [127.18, 37.552],
];

const PIN_BOX_WIDTH = 116;
/** 위도 1도 ≈ 경도 1도 × (1 / cos(37.55°)). 가로 방향을 이 비율로 줄여 대략적인 모양을 맞춘다. */
const LNG_SCALE = Math.cos((37.55 * Math.PI) / 180);

/**
 * 인터넷·지도 키 없이 쓰는 "예시 지도". 실제 지도가 아니라 예시 장소(DEMO_SAMPLE_PLACES)의 핀을
 * 간단한 그림 위에 배치한다. KakaoMapView 와 같은 MapHandle/MapEvent 계약을 지켜
 * 장소 검색 화면이 지도 종류를 구분하지 않고 쓸 수 있다.
 */
export const DemoMapView = forwardRef<MapHandle, Props>(function DemoMapView({ onEvent }, ref) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [padding, setPadding] = useState(0);
  const [markers, setMarkers] = useState<Place[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const emit = useRef(onEvent);
  emit.current = onEvent;

  // 마운트 직후 "지도 준비됨"과 기준 위치(서울시청)를 알린다. 거리 정렬이 이 위치를 기준으로 쓴다.
  useEffect(() => {
    emit.current({ type: 'ready' });
    emit.current({ type: 'tilesLoaded' });
    emit.current({ type: 'viewChanged', lat: SEOUL_CITY_HALL.lat, lng: SEOUL_CITY_HALL.lng, level: 7 });
  }, []);

  const finishSearch = useCallback((places: Place[]) => {
    setMarkers(places);
    setSelectedId(null);
    // 실제 지도처럼 결과를 비동기로 전달한다.
    setTimeout(
      () =>
        emit.current({
          type: 'searchResult',
          status: places.length > 0 ? 'done' : 'empty',
          places,
          excluded: 0,
        }),
      0,
    );
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      search: (keyword: string) => finishSearch(searchSamplePlaces(DEMO_SAMPLE_PLACES, keyword)),
      searchCategory: (key: CategoryKey) => finishSearch(searchSampleByCategory(DEMO_SAMPLE_PLACES, key)),
      clear: () => {
        setMarkers([]);
        setSelectedId(null);
      },
      select: (id) => setSelectedId(id),
      setPadding: (bottom) => setPadding(bottom),
      locate: () => emit.current({ type: 'locateError', message: '예시 지도에서는 현재 위치를 쓰지 않아요' }),
    }),
    [finishSearch],
  );

  /** 위경도 → 화면 좌표. 보이는 핀(없으면 전체 예시 장소)이 시트에 가리지 않는 영역에 꽉 차도록 맞춘다. */
  const project = useMemo(() => {
    const basis = markers.length > 0 ? markers : DEMO_SAMPLE_PLACES;
    const lats = basis.map((p) => p.lat);
    const lngs = basis.map((p) => p.lng);
    const spanLat = Math.max(Math.max(...lats) - Math.min(...lats), 0.02);
    const spanLng = Math.max(Math.max(...lngs) - Math.min(...lngs), 0.02);
    const centerLat = (Math.max(...lats) + Math.min(...lats)) / 2;
    const centerLng = (Math.max(...lngs) + Math.min(...lngs)) / 2;

    const visibleH = Math.max(size.height - padding, 120);
    const scale = Math.min((size.width * 0.72) / (spanLng * LNG_SCALE), (visibleH * 0.6) / spanLat);
    return (lat: number, lng: number) => ({
      x: size.width / 2 + (lng - centerLng) * LNG_SCALE * scale,
      y: visibleH / 2 + 24 - (lat - centerLat) * scale,
    });
  }, [markers, size.width, size.height, padding]);

  const riverPoints = useMemo(
    () => RIVER.map(([lng, lat]) => { const { x, y } = project(lat, lng); return `${x},${y}`; }).join(' '),
    [project],
  );

  const gridLines = useMemo(() => {
    const lines: { x1: number; y1: number; x2: number; y2: number }[] = [];
    for (let i = 1; i < 6; i += 1) {
      lines.push({ x1: (size.width / 6) * i, y1: 0, x2: (size.width / 6) * i + 30, y2: size.height });
      lines.push({ x1: 0, y1: (size.height / 6) * i, x2: size.width, y2: (size.height / 6) * i - 20 });
    }
    return lines;
  }, [size.width, size.height]);

  return (
    <View style={styles.root} onLayout={(e) => setSize(e.nativeEvent.layout)}>
      {size.width > 0 ? (
        <>
          <Svg width={size.width} height={size.height} style={StyleSheet.absoluteFill}>
            {gridLines.map((l, i) => (
              <Line key={i} {...l} stroke="#DDE5D6" strokeWidth={2} />
            ))}
            <Polyline points={riverPoints} fill="none" stroke="#BFDDF0" strokeWidth={26} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>

          {markers.map((place) => {
            const { x, y } = project(place.lat, place.lng);
            const style = styleForCategory(place.category);
            const selected = place.id === selectedId;
            return (
              <Pressable
                key={place.id}
                accessibilityRole="button"
                accessibilityLabel={`${place.name} 핀`}
                onPress={() => {
                  setSelectedId(place.id);
                  emit.current({ type: 'markerPress', place });
                }}
                style={[styles.pinBox, { left: x - PIN_BOX_WIDTH / 2, top: y - 32, zIndex: selected ? 2 : 1 }]}
              >
                <View style={[styles.pinDot, { backgroundColor: style.tint }, selected && styles.pinDotSelected]}>
                  <Text style={styles.pinEmoji}>{style.emoji}</Text>
                </View>
                <Text style={[styles.pinLabel, selected && styles.pinLabelSelected]} numberOfLines={1}>
                  {place.name}
                </Text>
              </Pressable>
            );
          })}
        </>
      ) : null}

      <Pressable
        accessibilityLabel="빈 곳"
        onPress={() => {
          setSelectedId(null);
          emit.current({ type: 'mapPress' });
        }}
        style={[StyleSheet.absoluteFill, styles.backdropPress]}
      />

      <View style={styles.watermark} pointerEvents="none">
        <Text style={styles.watermarkText}>예시 지도 (실제 아님)</Text>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#EEF3E9', overflow: 'hidden' },
  // 핀 아래에 깔려 빈 곳 터치만 받는다(핀이 위에 있어 핀 터치를 가로채지 않는다).
  backdropPress: { zIndex: 0 },
  pinBox: { position: 'absolute', width: PIN_BOX_WIDTH, alignItems: 'center', gap: 3 },
  pinDot: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
    boxShadow: '0px 2px 6px rgba(25, 31, 40, 0.25)',
  },
  pinDotSelected: { borderColor: colors.primary, transform: [{ scale: 1.2 }] },
  pinEmoji: { fontSize: 17 },
  pinLabel: {
    maxWidth: PIN_BOX_WIDTH,
    fontSize: 11,
    fontWeight: '700',
    color: colors.text,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 1,
    overflow: 'hidden',
  },
  pinLabelSelected: { backgroundColor: colors.primary, color: colors.onPrimary },
  watermark: {
    position: 'absolute',
    left: 12,
    top: 10,
    backgroundColor: 'rgba(25, 31, 40, 0.72)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  watermarkText: { color: '#fff', fontSize: 11, fontWeight: '700' },
});
