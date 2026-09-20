/**
 * WebView 안에서 카카오 지도 JavaScript SDK 를 띄우는 HTML.
 * - 장소 검색은 SDK 의 `services` 라이브러리(kakao.maps.services.Places)를 쓰므로
 *   REST API 키가 앱에 필요하지 않다. (JS 키 + 등록된 Web 도메인으로 동작)
 * - 장소명·주소는 외부 데이터이므로 innerHTML 을 쓰지 않고, JS 로 만든 값은 전부 JSON 으로만 RN 에 넘긴다.
 */

import { kakaoSdkUrl } from './kakaoSdk';
import { CATEGORY_RULES, FALLBACK_STYLE } from './placeStyle';
import { PIN_STYLE } from './pinStyle';
import {
  SEOUL_ADDRESS_PATTERN,
  SEOUL_CITY_HALL,
  SEOUL_INITIAL_LEVEL,
  SEOUL_SEARCH_BOUNDS,
} from './seoul';

/** 스크립트 태그 안에 안전하게 넣을 수 있도록 JSON 을 이스케이프한다. */
function jsLiteral(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .split(String.fromCharCode(0x2028))
    .join('\\u2028')
    .split(String.fromCharCode(0x2029))
    .join('\\u2029');
}

export function buildKakaoMapHtml(jsKey: string): string {
  const sdkUrl = kakaoSdkUrl(jsKey);

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
<style>
  html, body, #map { margin: 0; padding: 0; width: 100%; height: 100%; }
</style>
</head>
<body>
<div id="map"></div>
<script>
  function post(msg) {
    // 실제 요청 출처(카카오가 도메인 검사에 쓰는 값)를 함께 보고한다.
    msg.origin = window.location.origin;
    window.ReactNativeWebView.postMessage(JSON.stringify(msg));
  }
  window.onerror = function (message) {
    post({ type: 'sdkError', message: String(message) });
  };
</script>
<script src="${sdkUrl}" onerror="post({ type: 'sdkError', message: 'SDK 스크립트를 불러오지 못했습니다(키 형식·종류, 도메인 등록, 네트워크 확인).' })"></script>
<script>
  (function () {
    if (!window.kakao || !window.kakao.maps) {
      post({ type: 'sdkError', message: '카카오 지도 SDK 가 로드되지 않았습니다. JavaScript 키와 Web 플랫폼 도메인 등록을 확인하세요.' });
      return;
    }
    kakao.maps.load(function () {
      var map = new kakao.maps.Map(document.getElementById('map'), {
        center: new kakao.maps.LatLng(${SEOUL_CITY_HALL.lat}, ${SEOUL_CITY_HALL.lng}),
        level: ${SEOUL_INITIAL_LEVEL}
      });
      // 확대·축소 버튼(+/-). 핀치 줌과 드래그 이동은 기본으로 켜져 있다.
      map.addControl(new kakao.maps.ZoomControl(), kakao.maps.ControlPosition.RIGHT);
      // 지도 타일이 실제로 그려졌을 때 (키·도메인이 유효하다는 증거)
      kakao.maps.event.addListener(map, 'tilesloaded', function () {
        post({ type: 'tilesLoaded' });
      });
      // 이동·확대/축소가 끝날 때마다 현재 중심과 확대 레벨을 알린다.
      kakao.maps.event.addListener(map, 'idle', function () {
        var c = map.getCenter();
        post({ type: 'viewChanged', lat: c.getLat(), lng: c.getLng(), level: map.getLevel() });
      });
      var places = new kakao.maps.services.Places();
      // 검색 결과는 서울특별시 안의 장소만 표시한다. (지도 이동은 제한하지 않는다)
      var SEOUL = new RegExp(${jsLiteral(SEOUL_ADDRESS_PATTERN)});
      var SEOUL_BOUNDS = new kakao.maps.LatLngBounds(
        new kakao.maps.LatLng(${SEOUL_SEARCH_BOUNDS.sw.lat}, ${SEOUL_SEARCH_BOUNDS.sw.lng}),
        new kakao.maps.LatLng(${SEOUL_SEARCH_BOUNDS.ne.lat}, ${SEOUL_SEARCH_BOUNDS.ne.lng})
      );
      function isSeoul(p) { return SEOUL.test(p.roadAddress) || SEOUL.test(p.address); }
      var RULES = ${jsLiteral(CATEGORY_RULES)};
      var FALLBACK = ${jsLiteral(FALLBACK_STYLE)};
      var PIN = ${jsLiteral(PIN_STYLE)};
      var pins = [];
      var padBottom = 0;

      function styleFor(cat) {
        for (var i = 0; i < RULES.length; i++) {
          if (new RegExp(RULES[i].pattern).test(cat)) return RULES[i];
        }
        return FALLBACK;
      }
      function setStyle(el, s) { for (var k in s) el.style[k] = s[k]; }

      function toPlace(d) {
        return {
          id: d.id,
          name: d.place_name,
          address: d.address_name,
          roadAddress: d.road_address_name,
          lat: Number(d.y),
          lng: Number(d.x),
          category: d.category_name,
          phone: d.phone
        };
      }

      function clearMarkers() {
        pins.forEach(function (p) { p.overlay.setMap(null); });
        pins = [];
      }

      // 선택한 핀을 강조하고 z-index 를 올린다.
      function highlight(id) {
        pins.forEach(function (p) {
          var on = p.place.id === id;
          setStyle(p.dot, PIN.dot);
          setStyle(p.label, PIN.label);
          if (on) { setStyle(p.dot, PIN.dotSelected); setStyle(p.label, PIN.labelSelected); }
          p.overlay.setZIndex(on ? 10 : 1);
        });
      }

      // 핀이 시트에 가리지 않게, 보이는 영역의 가운데로 지도를 옮긴다.
      function focusOn(pos) {
        try {
          var proj = map.getProjection();
          var pt = proj.containerPointFromCoords(pos);
          map.panTo(proj.coordsFromContainerPoint(new kakao.maps.Point(pt.x, pt.y + padBottom / 2)));
        } catch (e) {
          map.panTo(pos);
        }
      }

      // 이모지 원 + 이름표 핀. 장소명은 외부 데이터이므로 textContent 로만 넣는다.
      function addPin(place) {
        var style = styleFor(place.category);
        var wrap = document.createElement('div');
        setStyle(wrap, PIN.wrap);
        var dot = document.createElement('div');
        setStyle(dot, PIN.dot);
        dot.style.background = style.tint;
        dot.textContent = style.emoji;
        var label = document.createElement('div');
        setStyle(label, PIN.label);
        label.textContent = place.name;
        wrap.appendChild(dot);
        wrap.appendChild(label);

        var pos = new kakao.maps.LatLng(place.lat, place.lng);
        // 핀을 누르거나 끌 때 지도 자체의 클릭·드래그로 넘어가지 않게 한다.
        ['mousedown', 'touchstart', 'dblclick'].forEach(function (t) {
          wrap.addEventListener(t, function (e) { e.stopPropagation(); });
        });
        wrap.addEventListener('click', function (e) {
          e.stopPropagation();
          highlight(place.id);
          focusOn(pos);
          post({ type: 'markerPress', place: place });
        });
        var overlay = new kakao.maps.CustomOverlay({ map: map, position: pos, content: wrap, xAnchor: 0.5, yAnchor: 0.3, zIndex: 1 });
        pins.push({ place: place, overlay: overlay, dot: dot, label: label });
        return pos;
      }

      function onResult(data, status) {
        if (status === kakao.maps.services.Status.ZERO_RESULT) {
          post({ type: 'searchResult', status: 'empty', places: [], excluded: 0 });
          return;
        }
        if (status !== kakao.maps.services.Status.OK) {
          post({ type: 'searchResult', status: 'error', places: [], excluded: 0 });
          return;
        }
        var all = data.map(toPlace);
        var list = all.filter(isSeoul);
        var excluded = all.length - list.length;
        if (list.length === 0) {
          post({ type: 'searchResult', status: 'empty', places: [], excluded: excluded });
          return;
        }
        var bounds = new kakao.maps.LatLngBounds();
        list.forEach(function (p) { bounds.extend(addPin(p)); });
        map.setBounds(bounds, 40, 24, padBottom + 16, 24);
        post({ type: 'searchResult', status: 'done', places: list, excluded: excluded });
      }

      window.reelspot = {
        search: function (keyword) {
          clearMarkers();
          places.keywordSearch(keyword, onResult, { size: 15, bounds: SEOUL_BOUNDS });
        },
        // 카테고리 그룹 코드(AT4 관광명소, FD6 음식점, CE7 카페, AD5 숙박)로 현재 지도 중심 주변을 검색
        category: function (code) {
          clearMarkers();
          places.categorySearch(code, onResult, {
            location: map.getCenter(),
            radius: 2000,
            sort: kakao.maps.services.SortBy.DISTANCE,
            size: 15
          });
        },
        clear: function () {
          clearMarkers();
        },
        select: function (id) {
          highlight(id);
          if (id === null) return;
          for (var i = 0; i < pins.length; i++) {
            if (pins[i].place.id === id) { focusOn(new kakao.maps.LatLng(pins[i].place.lat, pins[i].place.lng)); break; }
          }
        },
        setPadding: function (bottom) {
          padBottom = Number(bottom) || 0;
        }
      };

      kakao.maps.event.addListener(map, 'click', function () {
        post({ type: 'mapPress' });
      });

      // 'idle' 은 첫 로드에는 오지 않으므로 초기 중심·레벨을 직접 알린다.
      var c0 = map.getCenter();
      post({ type: 'viewChanged', lat: c0.getLat(), lng: c0.getLng(), level: map.getLevel() });
      post({ type: 'ready' });
    });
  })();
</script>
</body>
</html>`;
}

/** RN → WebView 로 검색을 요청하는 스크립트. keyword 는 JSON 리터럴로만 삽입한다. */
export function searchScript(keyword: string): string {
  return `window.reelspot && window.reelspot.search(${jsLiteral(keyword)}); true;`;
}

/** 카테고리 그룹 코드는 고정된 영문/숫자 값만 허용한다. */
export function categoryScript(code: string): string {
  return `window.reelspot && window.reelspot.category(${jsLiteral(code)}); true;`;
}

export const clearScript = 'window.reelspot && window.reelspot.clear(); true;';

/** 핀 선택(강조 + 이동). id 가 null 이면 선택 해제. */
export function selectScript(id: string | null): string {
  return `window.reelspot && window.reelspot.select(${jsLiteral(id)}); true;`;
}

/** 시트가 지도 아래를 가리는 높이(px). 숫자만 삽입한다. */
export function paddingScript(bottom: number): string {
  return `window.reelspot && window.reelspot.setPadding(${Number.isFinite(bottom) ? Math.max(0, Math.round(bottom)) : 0}); true;`;
}
