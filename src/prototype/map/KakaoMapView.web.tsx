import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';

import { env } from '../config/env';
import { buildFailureMessage, diagnoseSdkAccess, kakaoSdkUrl } from './kakaoSdk';
import { PIN_STYLE } from './pinStyle';
import { styleForCategory } from './placeStyle';
import { isSeoulPlace, SEOUL_CITY_HALL, SEOUL_INITIAL_LEVEL, SEOUL_SEARCH_BOUNDS } from './seoul';
import { CATEGORIES, type MapEvent, type MapHandle, type Place } from './types';

interface Props {
  onEvent: (event: MapEvent) => void;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Kakao = any;

/** 브라우저 페이지에 카카오 SDK <script> 를 한 번만 넣고 kakao.maps.load 까지 기다린다. */
let sdkPromise: Promise<Kakao> | null = null;
function loadKakaoSdk(): Promise<Kakao> {
  if (sdkPromise) return sdkPromise;
  sdkPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = kakaoSdkUrl(env.kakaoJsKey);
    script.async = true;
    script.onerror = () => {
      sdkPromise = null; // 재시도할 수 있게 초기화
      reject(new Error('SDK 스크립트 요청이 거부되었거나 실패했습니다.'));
    };
    script.onload = () => {
      const kakao = (window as unknown as { kakao?: Kakao }).kakao;
      if (!kakao?.maps) {
        sdkPromise = null;
        reject(new Error('SDK 는 받았지만 kakao.maps 가 없습니다.'));
        return;
      }
      kakao.maps.load(() => resolve(kakao));
    };
    document.head.appendChild(script);
  });
  return sdkPromise;
}

/**
 * PC 웹: HTML div 에 카카오 JavaScript SDK 로 지도를 직접 그린다. (WebView 아님)
 * 임시 지도로 대체하지 않는다. 실패하면 실제 오류를 onEvent(sdkError)로 올린다.
 * 장소 검색은 SDK 의 services 라이브러리(Places)로 하고 결과를 마커로 표시한다. (앱 WebView 쪽 kakaoMapHtml.ts 와 같은 동작)
 */
export const KakaoMapView = forwardRef<MapHandle, Props>(function KakaoMapView({ onEvent }, ref) {
  const container = useRef<HTMLDivElement>(null);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  // 지도가 준비되면 채워지는 검색·마커 조작 함수들
  const api = useRef<{
    search(k: string): void;
    category(code: string): void;
    clear(): void;
    select(id: string | null): void;
    setPadding(bottom: number): void;
  } | null>(null);

  useImperativeHandle(ref, () => ({
    search: (keyword) => api.current?.search(keyword),
    searchCategory: (key) => {
      const code = CATEGORIES.find((c) => c.key === key)?.code;
      if (code) api.current?.category(code);
    },
    clear: () => api.current?.clear(),
    select: (id) => api.current?.select(id),
    setPadding: (bottom) => api.current?.setPadding(bottom),
  }));

  useEffect(() => {
    let disposed = false;
    const origin = window.location.origin;

    loadKakaoSdk()
      .then((kakao) => {
        if (disposed || !container.current) return;
        const map = new kakao.maps.Map(container.current, {
          center: new kakao.maps.LatLng(SEOUL_CITY_HALL.lat, SEOUL_CITY_HALL.lng),
          level: SEOUL_INITIAL_LEVEL,
        });
        // 확대·축소 버튼(+/-). 마우스 휠 줌과 드래그 이동은 기본으로 켜져 있다.
        map.addControl(new kakao.maps.ZoomControl(), kakao.maps.ControlPosition.RIGHT);
        kakao.maps.event.addListener(map, 'tilesloaded', () =>
          onEventRef.current({ type: 'tilesLoaded' }),
        );
        kakao.maps.event.addListener(map, 'idle', () => {
          const c = map.getCenter();
          onEventRef.current({
            type: 'viewChanged',
            lat: c.getLat(),
            lng: c.getLng(),
            level: map.getLevel(),
          });
        });
        // ── 장소 검색 · 마커 ──
        const places = new kakao.maps.services.Places();
        // 검색 결과는 서울특별시 안의 장소만 표시한다. (지도 이동은 제한하지 않는다)
        const seoulBounds = new kakao.maps.LatLngBounds(
          new kakao.maps.LatLng(SEOUL_SEARCH_BOUNDS.sw.lat, SEOUL_SEARCH_BOUNDS.sw.lng),
          new kakao.maps.LatLng(SEOUL_SEARCH_BOUNDS.ne.lat, SEOUL_SEARCH_BOUNDS.ne.lng),
        );
        interface Pin {
          place: Place;
          overlay: Kakao;
          dot: HTMLDivElement;
          label: HTMLDivElement;
        }
        let pins: Pin[] = [];
        let padBottom = 0;
        const setStyle = (el: HTMLElement, style: Record<string, string>) => Object.assign(el.style, style);
        const clearMarkers = () => {
          pins.forEach((p) => p.overlay.setMap(null));
          pins = [];
        };
        // 선택한 핀을 강조하고 z-index 를 올린다.
        const highlight = (id: string | null) =>
          pins.forEach((p) => {
            const on = p.place.id === id;
            setStyle(p.dot, PIN_STYLE.dot);
            setStyle(p.label, PIN_STYLE.label);
            if (on) {
              setStyle(p.dot, PIN_STYLE.dotSelected);
              setStyle(p.label, PIN_STYLE.labelSelected);
            }
            p.overlay.setZIndex(on ? 10 : 1);
          });
        // 핀이 시트에 가리지 않게, 보이는 영역의 가운데로 지도를 옮긴다.
        const focusOn = (pos: Kakao) => {
          try {
            const proj = map.getProjection();
            const pt = proj.containerPointFromCoords(pos);
            map.panTo(proj.coordsFromContainerPoint(new kakao.maps.Point(pt.x, pt.y + padBottom / 2)));
          } catch {
            map.panTo(pos);
          }
        };
        const toPlace = (d: Record<string, string>): Place => ({
          id: d.id,
          name: d.place_name,
          address: d.address_name,
          roadAddress: d.road_address_name,
          lat: Number(d.y),
          lng: Number(d.x),
          category: d.category_name,
          phone: d.phone,
        });
        // 이모지 원 + 이름표 핀. 장소명은 외부 데이터이므로 textContent 로만 넣는다.
        const addPin = (place: Place): Kakao => {
          const style = styleForCategory(place.category);
          const wrap = document.createElement('div');
          setStyle(wrap, PIN_STYLE.wrap);
          const dot = document.createElement('div');
          setStyle(dot, PIN_STYLE.dot);
          dot.style.background = style.tint;
          dot.textContent = style.emoji;
          const label = document.createElement('div');
          setStyle(label, PIN_STYLE.label);
          label.textContent = place.name;
          wrap.append(dot, label);

          const pos = new kakao.maps.LatLng(place.lat, place.lng);
          // 핀을 누르거나 끌 때 지도 자체의 클릭·드래그로 넘어가지 않게 한다.
          for (const type of ['mousedown', 'touchstart', 'dblclick']) {
            wrap.addEventListener(type, (e) => e.stopPropagation());
          }
          wrap.addEventListener('click', (e) => {
            e.stopPropagation();
            highlight(place.id);
            focusOn(pos);
            onEventRef.current({ type: 'markerPress', place });
          });
          const overlay = new kakao.maps.CustomOverlay({ map, position: pos, content: wrap, xAnchor: 0.5, yAnchor: 0.3, zIndex: 1 });
          pins.push({ place, overlay, dot, label });
          return pos;
        };
        const onResult = (data: Record<string, string>[], status: string) => {
          if (status === kakao.maps.services.Status.ZERO_RESULT) {
            onEventRef.current({ type: 'searchResult', status: 'empty', places: [], excluded: 0 });
            return;
          }
          if (status !== kakao.maps.services.Status.OK) {
            onEventRef.current({ type: 'searchResult', status: 'error', places: [], excluded: 0 });
            return;
          }
          const all = data.map(toPlace);
          const list = all.filter(isSeoulPlace);
          const excluded = all.length - list.length;
          if (list.length === 0) {
            onEventRef.current({ type: 'searchResult', status: 'empty', places: [], excluded });
            return;
          }
          const bounds = new kakao.maps.LatLngBounds();
          list.forEach((place) => bounds.extend(addPin(place)));
          map.setBounds(bounds, 40, 24, padBottom + 16, 24);
          onEventRef.current({ type: 'searchResult', status: 'done', places: list, excluded });
        };
        kakao.maps.event.addListener(map, 'click', () => onEventRef.current({ type: 'mapPress' }));
        api.current = {
          search: (keyword) => {
            clearMarkers();
            places.keywordSearch(keyword, onResult, { size: 15, bounds: seoulBounds });
          },
          category: (code) => {
            clearMarkers();
            places.categorySearch(code, onResult, {
              location: map.getCenter(),
              radius: 2000,
              sort: kakao.maps.services.SortBy.DISTANCE,
              size: 15,
            });
          },
          clear: clearMarkers,
          select: (id) => {
            highlight(id);
            const pin = id === null ? undefined : pins.find((p) => p.place.id === id);
            if (pin) focusOn(new kakao.maps.LatLng(pin.place.lat, pin.place.lng));
          },
          setPadding: (bottom) => {
            padBottom = Number.isFinite(bottom) ? Math.max(0, Math.round(bottom)) : 0;
          },
        };
        // 'idle' 은 첫 로드에는 오지 않으므로 초기 중심·레벨을 직접 알린다.
        const c0 = map.getCenter();
        onEventRef.current({
          type: 'viewChanged',
          lat: c0.getLat(),
          lng: c0.getLng(),
          level: map.getLevel(),
        });
        onEventRef.current({ type: 'ready', origin });
      })
      .catch(async (err: Error) => {
        if (disposed) return;
        const access = await diagnoseSdkAccess(origin);
        if (disposed) return;
        onEventRef.current({
          type: 'sdkError',
          message: buildFailureMessage(err.message, origin, access),
          origin,
        });
      });

    return () => {
      disposed = true;
      api.current?.clear();
      api.current = null;
    };
  }, []);

  // 카카오 지도 내부 레이어의 z-index 가 화면 오버레이(검색창·패널)를 덮지 않도록 자체 stacking context 로 가둔다.
  return (
    <div
      ref={container}
      style={{ position: 'relative', zIndex: 0, overflow: 'hidden', flex: 1, width: '100%', height: '100%', minHeight: 0 }}
    />
  );
});
