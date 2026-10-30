# 지도 API 조사와 선택안

확인일: 2026-10-30 · 대상: 대한민국 Android 1차 출시 · 상태: 공식 문서 조사 완료, 월 0원 우선 확정, 무료 쿼터 자격·실연동 검수 대기

## 1. 이번 판단

사용자 결정: **지도 API 요금 월 0원 우선, 무료 한도 소진 시 검색 일시 중단 허용**. 개인 서버의 전기·회선 등 전체 운영비가 0원이라는 뜻은 아니다. 유료 추가 호출이나 결제 활성화를 기본값으로 두지 않는다.

**현재 F09의 카카오맵을 유지하고 무료 한도 안에서 시작하는 안을 우선 권장한다.** 국내 장소 검색 요구사항을 그대로 활용하고 기존 설계 변경을 줄일 수 있다는 판단이다. 실제 검색 품질을 비교 측정한 결론은 아니다. 운영자 계정의 무료 쿼터 적용 여부·예상 호출량·장소 데이터 보관 조건을 확인한 뒤 확정한다.

**지도 표시만 완전 무료로 제공하는 서비스는 있다.** OpenFreeMap은 공개 서버의 지도 조회·요청 수 제한과 API 키 없이 무료 제공한다고 안내한다. 다만 장소 검색까지 포함하는 통합 대체품은 아니며 SLA를 제공하지 않는다. ‘무료 지도’와 ‘무료로 맛집·카페 검색까지 운영’은 구분해야 한다. [OpenFreeMap 공식 안내](https://openfreemap.org/)

Google 전환은 가능하지만 검색 요금·데이터 보관·표시 조건에 맞춘 설계 변경이 필요하다. 회의록의 Google Maps 조사를 곧바로 공급자 변경 결정으로 해석하지 않았다. 구체적인 요청·저장·오류 처리는 [연동 설계안](../../1차%20개발%20설계서/참고%20자료/지도_API_연동_설계안.md)에 정리했다.

## 2. 우리 앱에서 필요한 것

기준: [기능명세서 F09~F11](../기능명세서.md).

| 기능 | 실제 요구 | 별도 구분 |
| --- | --- | --- |
| 지도 표시 | 지도 이동, 마커·목록 선택 연동, 핀 지정 | 지도 SDK |
| 장소 검색 | 이름·주소, 관광지·맛집·카페·숙소, 지도 영역 재검색 | 장소/검색 API |
| 거리 | 검색 당시 지도 중심과 장소 사이 거리 | 직선거리로 설계하면 길찾기 API 불필요 |
| 현재 위치 | 버튼을 누른 때에만 OS에서 획득 | 기기 권한·개인위치정보 처리 검토 |
| 장소 보관 | 모임의 방문 일정·기록과 장소 연결 | 공급자 데이터 저장 허용 범위 확인 |
| 직접 등록 | 이름 필수, 주소·좌표 선택 | 외부 검색 장애 때에도 좌표 없는 등록 가능 |

‘맛집’은 우선 음식점 분류로 해석하며 인기 순위·평점 조회를 자동 추가하지 않는다. 길찾기·내비게이션·리뷰·장소 사진·Street View는 현재 요구에 없으므로 조사 비용 예시에 포함하지 않는다.

## 3. 후보 비교

| 후보 | 무료 범위·비용 | F09에 대한 판단 |
| --- | --- | --- |
| 카카오맵 + 장소 REST API | 자격 있는 앱의 무료 일간·월간 쿼터. 초과 사용은 유료 설정 필요 | 현행 기준. 최소 변경으로 진행할 우선 후보 |
| Google Maps SDK + Places API (New) | 기본 Maps SDK SKU는 무료 사용량 Unlimited. 장소 검색은 별도 SKU | Google 전환 시 검색 비용과 저장 모델 변경 필요 |
| MapLibre + OpenFreeMap | 지도 표시 공개 서비스 무료, MapLibre Native는 BSD-2-Clause | 지도 표시 후보. 검색 제공자 또는 직접 운영 검색 시스템은 따로 필요 |
| OpenStreetMap 공용 타일 + 공용 Nominatim | 무료 데이터가 무제한 공용 서버 사용권을 뜻하지 않음 | 일반 사용자용 앱의 무제한 검색 기반으로 채택하지 않음 |
| 네이버 지도 + 지역 검색 | 지도와 지역 검색이 별도 API·조건 | 추가 후보. 기존 영역 검색·분류 요구의 동등성 검증 필요 |

근거: [카카오 쿼터](https://developers.kakao.com/docs/ko/getting-started/quota), [Google 가격표](https://developers.google.com/maps/billing-and-pricing/pricing), [MapLibre Native](https://github.com/maplibre/maplibre-native), [OpenFreeMap](https://openfreemap.org/), [네이버 지도](https://www.ncloud.com/product/applicationService/maps), [네이버 지역 검색](https://developers.naver.com/docs/serviceapi/search/local/local.md).

### 카카오의 무료 조건

공식 표 기준 Android/iOS 지도 SDK는 일 300,000건, 키워드 검색과 카테고리 검색은 각각 일 100,000건이다. 전체 API의 무료 월간 쿼터 3,000,000건도 함께 확인한다. 일간 한도를 한 달 내내 각각 전부 쓸 수 있다는 뜻이 아니다. 유료 추가 쿼터의 지도 SDK는 건당 0.1원, 키워드·카테고리 검색은 건당 2원이다. 실제 적용 조건과 청구 내역은 콘솔에서 확인한다. [공식 쿼터·단가](https://developers.kakao.com/docs/ko/getting-started/quota)

2026-07-21 이후 방식에서는 **개발자 계정 기준 카카오맵 API를 처음 활성화한 앱에만 무료 쿼터**를 제공한다. 두 번째 이후 앱은 비즈월렛·유료 설정이 필요하다. 앱 정보의 무료 쿼터 배지를 확인하고 개발용 앱을 먼저 활성화하기 전에 운영용 구성을 정한다. 무료 쿼터 소진 시 429가 발생하므로 유료를 사용하지 않는 운영안에는 검색 중단·직접 등록 경로가 필요하다. [카카오맵 사용 방법·정책](https://developers.kakao.com/docs/ko/kakaomap/common)

장소 이름·주소·좌표를 영구 저장하거나 다른 지도에 표시할 수 있는지는 이 쿼터 문서만으로 확정할 수 없다. 실제 보관 항목과 용도를 정리하여 약관·정책 또는 공식 답변으로 확인하기 전, 무료 호출이라는 이유로 저장 권리까지 확보했다고 표시하지 않는다.

### Google의 비용

기본 Android Maps SDK의 무료 SKU와 Places 검색 비용은 별개다. 결제 계정 활성화가 필요하며, 다른 지도 SKU·웹 지도·Street View를 사용하면 해당 가격이 적용된다. 과거의 월 $200 크레딧을 현재 무료 기준으로 계산하지 않는다. [Android SDK 과금 안내](https://developers.google.com/maps/documentation/android-sdk/usage-and-billing)

2026-10-30 공식 글로벌 종량제 가격표의 관련 항목은 다음과 같다. USD이며 세금·환율·별도 계약 할인은 제외한다.

| SKU | 월 무료 사용량 | 무료 초과~100,000건 구간의 1,000건당 가격 |
| --- | --- | --- |
| Maps SDK | Unlimited | 해당 기본 SKU 무료 |
| Text Search Pro | 5,000건 | $32 |
| Nearby Search Pro | 5,000건 | $32 |
| Place Details Pro | 5,000건 | $17 |
| Place Details Essentials | 10,000건 | $5 |
| Text Search Essentials (IDs Only) | Unlimited | ID 중심 결과. 장소명·주소 목록을 대체하지 못함 |

[Google 공식 가격표](https://developers.google.com/maps/billing-and-pricing/pricing)

예를 들어 **한 결제 계정에서 Text Search Pro만 월 10,000회** 사용하면 `(10,000 - 5,000) / 1,000 × $32 = $160`이다. 20,000회면 $480이다. 앱 이용자 수가 아니라 실제 과금 이벤트 수를 계산하며, 재검색·다음 페이지·추가 상세 조회와 같은 비용을 별도로 합산한다. 같은 결제 계정에 연결된 다른 프로젝트의 사용량도 고려한다. 이는 위 가격표로 계산한 예시이지 실제 청구액이나 현재 이용량이 아니다.

`places.name`은 장소 표시 이름이 아니라 리소스 이름이다. 표시 이름·주소·좌표가 필요한 검색은 `places.displayName`, `places.formattedAddress`, `places.location` 등 Pro 필드를 요청하므로 ID 전용 무료 검색과 혼동하면 안 된다. [Text Search 필드·SKU](https://developers.google.com/maps/documentation/places/web-service/text-search)

예산 알림은 지출을 자동 차단하지 않는다. 가능한 공급자 쿼터 제한과 서버의 요청 한도·동시성 제어·차단 기능을 함께 설계한다. 비용을 절대 0원으로 보장하는 장치라고 표현하지 않는다. [Google 비용 관리](https://developers.google.com/maps/billing-and-pricing/manage-costs)

### Google 데이터 저장의 영향

Places의 `place_id`는 장기 보관 예외가 있지만, 이를 장소명·주소·좌표 전체의 무제한 저장 허가로 확대할 수 없다. 비EEA 계약의 Places API 위·경도 임시 캐시는 최대 연속 30일 후 삭제 조건이 있다. 다른 필드는 각 적용 조건을 확인하고, 최초 연동은 장기 저장하지 않는 설계로 시작한다. [Places 정책](https://developers.google.com/maps/documentation/places/web-service/policies), [서비스별 약관 제14항](https://cloud.google.com/maps-platform/terms/maps-service-terms)

따라서 기존 `places` 테이블에 Google 결과를 복사해 계속 남기는 구현은 그대로 채택하지 않는다. 사용자의 방문일·예정 시각·직접 입력 정보와 공급자 결과의 출처·보관을 나눠야 한다. 서비스의 미디어 보관 3개월과 지도 데이터의 캐시 조건도 별개다.

Places API 결과를 지도 위에 표시할 때에는 Google 지도를 사용해야 하며 지도 없는 표시에도 지정된 출처 표시가 필요하다. 공개 이용약관·처리방침에 요구되는 Google 관련 안내도 확인한다. 이 결론은 **Places API**에 관한 것이며 별도 상품인 Places UI Kit까지 동일 조건이라고 단정하지 않는다. [Places 표시 정책](https://developers.google.com/maps/documentation/places/web-service/policies)

### 오픈소스·무료 지도 서비스의 한계

OpenFreeMap과 MapLibre를 사용하면 지도 표시의 공급자 호출 요금을 없애는 구성이 가능하다. 그러나 국내 장소 검색·카테고리·주소 변환은 별도다. 직접 검색 서버를 운영하면 데이터 구축·업데이트·저장장치·메모리·회선 비용과 라이선스 준수가 필요하다. 개인 PC에 사진 서버와 함께 올리는 것이 항상 더 저렴하거나 안정적이라고 판단하지 않는다. 이는 운영 구조에 대한 판단이며 실제 부하 검증은 하지 않았다.

공용 Nominatim은 전체 앱 기준 최대 초당 1요청, 식별 가능한 User-Agent/Referer, 출처 표시 등을 요구하고 자동완성·체계적 POI 수집을 금지한다. 공개 정책은 개발자가 충분히 이해하고 직접 책임지는 선택을 요구한다. 이번 설계에서 자동 연결하거나 기본 검색 제공자로 지정하지 않는다. [Nominatim 사용 정책](https://operations.osmfoundation.org/policies/nominatim/)

OSM 공용 타일 서버도 무제한 상용 호스팅 보장이 없으며 캐시·표시·요청 식별 정책과 대량 다운로드 금지가 있다. OpenFreeMap의 별도 공개 서버 조건과 혼동하지 않는다. [OSM 타일 정책](https://operations.osmfoundation.org/policies/tiles/)

## 4. 선택 전에 남은 확인

- 비용 방침은 확정: 월 0원 우선·한도 소진 시 검색 중단 허용. 카카오 유료 추가 사용 OFF 확인과 수기 입력 유지가 적용 조건.
- 카카오: 실제 앱의 무료 쿼터 배지, 월간 다른 API 사용량, 장소 데이터 보관·표시 허용 범위 확인.
- 품질: 동일한 국내 장소·주소·분류·지도 영역 사례로 공급자별 검색 결과를 실측. 이번에는 인증된 API 호출을 하지 않음.
- Google: 전환 참고안으로 보류. 향후 비용 방침을 변경할 때 결제·SKU·조회량·저장 구조·공개 약관·국외 처리 흐름을 검토.
- OpenFreeMap: 검색 기능의 별도 공급 또는 축소 여부, 실제 Android 연동·한글 표시·장애 대체·라이선스 표시 검증.

공급자 선택 후 연동 설계안을 기능명세·API·DB 원천에 반영하고 관련 산출물을 재생성한다. 현재 문서는 조사·선택 자료이며 전환 완료나 무료 운영 보증이 아니다.
