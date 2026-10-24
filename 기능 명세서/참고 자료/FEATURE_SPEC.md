> **이전 설계 문서:** 이 문서는 개인 촬영·편집 앱을 기준으로 작성한 과거 설계다. 새로 개발할 At that place의 현재 기능 명세는 [현재 기능명세서](../기능명세서.md)를 따른다. 2026-10-16 확정 범위는 **1차 공동 기록·감상, 2차 자동 영상 생성·사진 및 영상 편집**이다. 아래의 과거 MVP·기술 선택·공유 범위를 현재 개발 지시로 사용하지 않는다.

# 기능 설계서 — 사진·영상 촬영/편집/일상 기록 앱

- 작성일: 2026-10-12
- 입력 문서
  - A: `FEATURE_RESEARCH.md` (OEM·소셜·전문 앱·RN 라이브러리 조사, 구현 가능성 표기)
  - B: `photo_video_app_feature_research.md` (기능 ID·우선순위 P0~P2·출처 중심 조사)
- 기술 스택: React Native + Expo (TypeScript), Expo Router, react-native-skia, expo-camera → VisionCamera(2차)
- 산출물: 이 문서 + Expo 앱 소스(`mobile/`)

---

## 1. 제품 정의

**한 줄 정의**: "앱에서 사진과 짧은 영상을 찍고, 필요한 만큼 손본 뒤, 하루의 기록을 한 편으로 남긴다."

| 항목 | 결정 | 근거 |
|---|---|---|
| 1차 사용자 | 일상 기록 사용자 (개인 일기 + 소규모 친구 공유) | B §1, A §4.1 setlog 분석 |
| 핵심 흐름 | 촬영 → 간편 편집 → 날짜별 보관 → 하루 브이로그 자동 구성 → 공유 | 두 문서 공통 결론 |
| 첫 플랫폼 | Android + iOS 동시 (단일 코드베이스) | 사용자 요구 |
| AI 전략 | 온디바이스 마스크/분석 우선, 생성형은 클라우드 API, OEM 기능 호출은 전제하지 않음 | A §3, B §5.1~5.2: Galaxy AI·Apple Intelligence 공개 API 없음 |
| 공유 전략 | 1차는 시스템 공유 시트, 친구 그룹은 2차 | B §9.2 |

---

## 2. 공통 기능 추출

### 2.1 추출 기준

두 문서에 **모두 등장**하는 기능을 공통 기능으로 본다. 명칭이 달라도 동작이 같으면 동일 기능으로 묶었다. 문서 B의 ID(C/P/A/V/O/D/L)를 기준 ID로 쓰고, 문서 A의 해당 절을 병기한다. 우선순위는 B의 P0~P2를 기본으로 하되 A의 구현 가능성(✅/🔧/☁️/🔒)으로 보정했다.

- **P0 + ✅** → MVP에 포함
- **P0 + 🔧** → MVP에 포함하되 네이티브 모듈 필요 (개발 빌드)
- **P1** → 2차
- **P2 또는 ☁️/🔒** → 3차 이후

### 2.2 촬영 — 공통 기능 (24개)

| ID | 기능 | A 근거 | B 근거 | 구현 | 단계 |
|---|---|---|---|---|---|
| C01 | 앱 내 사진·영상 촬영, 모드 전환 | §1.1, §1.2 | §3.1 P0 | ✅ | **MVP** |
| C02 | 전·후면 전환 | §1.4 | §3.1 P0 | ✅ | **MVP** |
| C03 | 렌즈 선택(초광각/광각/망원) | §1.1 매크로, 렌즈 선택 | §3.2 P1 | ✅ | 2차 |
| C04 | 핀치/슬라이더 줌 | §1.1 스페이스 줌(디지털) | §3.1 P0 | ✅ | **MVP** |
| C05 | 터치 초점·노출 | §1.3 추적 AF | §3.1 P0 | 🔧 VisionCamera | 2차 (expo-camera 미지원) |
| C06 | 초점·노출 잠금 | §1.1 Pro | §3.1 P1 | 🔧 | 2차 |
| C07 | 노출 보정 | §1.1 Pro | §3.1 P0 | 🔧 VisionCamera | 2차 |
| C08 | 플래시·토치 | §1.1 Constant Color | §3.1 P0 | ✅ | **MVP** |
| C09 | 타이머 | §1.3 | §3.1 P0 | ✅ | **MVP** |
| C10 | 격자·수평계 | §1.3 구도 가이드 | §3.1 P0 | ✅ | **MVP** |
| C11 | 화면 비율 가이드 (1:1·4:5·9:16) | §1.3, §2.2 내보내기 | §3.1 P0 | ✅ | **MVP** |
| C13 | 촬영 후 빠른 검토 (재촬영/편집/저장) | §1.4 BeReal 재촬영 | §3.1 P0 | ✅ | **MVP** |
| C14 | 실시간 필터 미리보기 | §1.1 필터/필름 룩 | §3.1 P1 | ✅ Skia 프리뷰 | 2차 |
| C17 | 연속 촬영 | §1.1 버스트 | §3.2 P1 | ✅ | 2차 |
| C18 | HDR 사진 | §1.1 | §3.2 P1 | ✅/🔒 | 2차 |
| C19 | 야간 촬영 | §1.1 Night | §3.2 P1 | 🔒 (CameraX Ext 부분) | 3차 |
| C20 | 인물·보케 | §1.1 Portrait | §3.2 P1 | 🔧 깊이 매트 | 3차 |
| C22 | 파노라마 | §1.1 | §3.2 P2 | 🔧 | 3차 |
| C23 | Live Photo·모션 포토 | §1.1 | §3.2 P2 | ✅ | 3차 |
| C24 | RAW·ProRAW | §1.1 | §3.2 P2 | ✅ VisionCamera | 3차 |
| C25 | 수동 ISO·셔터·WB | §1.1 Pro | §3.2 P2 | ✅ VisionCamera | 3차 |
| C29 | 해상도·FPS 선택 | §1.2 | §3.3 P0 | ✅ | **MVP** (해상도) |
| C30 | 녹화 시간 표시 | — (공통 UI) | §3.3 P0 | ✅ | **MVP** |
| C31 | 짧은 클립 모드 (2초·5초) | §1.4 setlog | §3.3 P0 | ✅ | **MVP** |
| C32 | 일시정지·이어 찍기 | §1.2 | §3.3 P1 | ✅ iOS 18 | 2차 |
| C33 | 손떨림 보정 | §1.2 | §3.3 P1 | ✅ | 2차 |
| C34 | 슬로모션 | §1.2 | §3.3 P1 | ✅ VisionCamera fps | 2차 |
| C35 | 타임랩스 | §1.2 | §3.3 P1 | ✅ | 2차 |
| C36 | 전·후면 듀얼 촬영 | §1.2, §1.4 | §3.3 P2 | ✅ iOS 멀티캠 / Android 기기별 | 3차 |
| C39 | HDR·Log·고급 코덱 | §1.2 | §3.3 P2 | ✅ VisionCamera | 3차 |
| C41 | 텔레프롬프터 | §1.3 | §3.3 P1 | ✅ | 2차 |

### 2.3 사진 편집 — 공통 기능 (27개)

| ID | 기능 | A 근거 | B 근거 | 구현 | 단계 |
|---|---|---|---|---|---|
| P01 | 자르기·회전·반전 | §2.1 기하 | §4.1 P0 | ✅ image-manipulator | **MVP** |
| P02 | 수평·원근 보정 | §2.1 기하 | §4.1 P1 | ✅ Skia 변환 | 2차 |
| P03 | 밝기·노출·대비 | §2.1 색·광 | §4.1 P0 | ✅ Skia ColorMatrix | **MVP** |
| P04 | 하이라이트·그림자 | §2.1 | §4.1 P0 | ✅ SkSL | **MVP** |
| P05 | 화이트밸런스·틴트 | §2.1 | §4.1 P0 | ✅ | **MVP** |
| P06 | 채도·생동감 | §2.1 | §4.1 P0 | ✅ | **MVP** |
| P07 | HSL | §2.1 | §4.1 P1 | ✅ SkSL | 2차 |
| P08 | 커브·색조 분리 | §2.1 | §4.1 P2 | ✅ SkSL | 3차 |
| P09 | 선명도·디테일 | §2.1 | §4.1 P1 | ✅ | 2차 |
| P10 | 노이즈 감소·디헤이즈 | §2.1 | §4.1 P1 | 🔧 모델 | 2차 |
| P11 | 필터·프리셋 | §2.1 LUT/프리셋 | §4.1 P0 | ✅ | **MVP** |
| P12 | 필터 강도 | §2.1 | §4.1 P0 | ✅ | **MVP** |
| P13 | 그레인·비네팅·페이드 | §2.1 | §4.1 P1 | ✅ SkSL | 2차 |
| P14 | 편집 조합 저장 (Recipe) | §2.1 프리셋 저장 | §4.1 P1 | ✅ | 2차 |
| P15 | 일괄 보정·설정 복사 | §2.1 | §4.1 P1 | ✅ | 2차 |
| P16 | 브러시·선형·원형 마스크 | §2.1 선택·마스크 | §4.2 P1 | ✅ Skia Path | 2차 |
| P17 | 피사체·하늘·배경 자동 선택 | §2.1 AI 마스크 | §4.2 P1 | ✅ Vision/ML Kit | 2차 |
| P18 | 잡티·결점 복구 | §2.1 리터치 | §4.2 P1 | 🔧/☁️ | 3차 |
| P20 | 텍스트·스티커·그리기 | §2.1 효과·장식 | §4.2 P0 | ✅ Skia | **MVP** |
| P21 | 콜라주·프레임 | §2.1, §4.2 분할화면 | §4.2 P1 | ✅ | 2차 |
| P22 | 모자이크·블러 (민감 정보 가리기) | §2.1 모자이크/블러 | §4.2 P0 | ✅ Skia Blur + 마스크 | **MVP** |
| P23 | 원본·결과 비교 | §3.5 Before/After | §4.2 P0 | ✅ | **MVP** |
| P24 | 실행 취소·다시 실행 | §3.1 편집 기록 | §4.2 P0 | ✅ | **MVP** |
| P25 | 원본 보존·비파괴 편집 | §2.2 비파괴, §3.2 PhotoKit | §4.2 P0 | ✅ 편집 스택 JSON | **MVP** |
| P26 | 별도 사본·포맷 내보내기 | §2.2 내보내기 | §4.2 P0 | ✅ | **MVP** |
| P27 | RAW 현상 | §2.1 | §4.2 P2 | 🔧 | 3차 |

### 2.4 AI 편집 — 공통 기능 (20개)

| ID | 기능 | A 근거 | B 근거 | 구현 | 단계 |
|---|---|---|---|---|---|
| A01 | 원터치 자동 보정·리마스터 | §3.1 Remaster, §3.2 Enhance | §5.4 P1 | ✅ 히스토그램 기반 자동 + 🔧 | 2차 |
| A02 | 객체·사람 제거 | §3.6 객체 제거 | §5.4 P1 | ☁️ Gemini/Stability | 3차 |
| A03 | 객체 이동·크기 변경 | §3.1 Generative Edit | §5.4 P2 | ☁️ | 3차 |
| A04 | 생성형 배경 확장 | §3.6 생성 확장 | §5.4 P1 | ☁️ | 3차 |
| A05 | 배경 제거·투명 PNG | §3.6 배경 제거 | §5.4 P1 | ✅ Vision / ML Kit | 2차 |
| A06 | 배경 교체·생성 | §3.6 | §5.4 P2 | ✅ 마스크 + ☁️ | 3차 |
| A07 | 문장 기반 편집 | §3.6 자연어 편집 | §5.4 P2 | ☁️ | 3차 |
| A08 | 참조 이미지 기반 추가 | §3.1 Object Transfer | §5.4 P2 | ☁️ | 3차 |
| A09 | 영역별 자동 마스킹 | §2.1 AI 마스크 | §5.4 P1 | ✅ | 2차 |
| A10 | 심도·배경 흐림 | §2.1 Lens Blur | §5.4 P2 | 🔧 | 3차 |
| A11 | 고해상도화 | §3.6 리마스터·업스케일 | §5.4 P2 | ✅ Real-ESRGAN 온디바이스 | 3차 |
| A12 | 인물 결점 보정 | §2.1 리터치 | §5.4 P2 | 🔧 | 3차 |
| A13 | 스타일 변환 | §3.6 스타일 변환 | §5.4 P2 | ✅ ExecuTorch / ☁️ | 3차 |
| A15 | 자동 자막 | §2.2 텍스트·자막 | §5.4 P1 | ✅ Whisper 온디바이스 / ☁️ | 2차 |
| A16 | 자막 번역 | §2.2 | §5.4 P2 | ☁️ | 3차 |
| A18 | 자동 하이라이트 편집 | §3.6 자동 숏폼 | §5.4 P1 | 🔧 | 3차 |
| A19 | 소리 분리·제거·믹스 | §3.6 오디오 분리 | §5.4 P2 | ✅ iOS Audio Mix / 🔧 | 3차 |
| A21 | 영상 배경 제거 | §2.2 | §5.4 P2 | 🔧 | 3차 |
| A22 | 보간 슬로모션 | §3.6 슬로모 보간 | §5.4 P2 | 🔧 RIFE | 3차 |
| A25 | 얼굴·번호판 자동 가림 | §2.1 모자이크 + ML Kit 얼굴 탐지 | §5.4 P1 | ✅ ML Kit Face | 2차 |
| A27 | 그림자·반사 제거 | §3.1 | §5.4 P2 | ☁️ | 3차 |

### 2.5 영상·오디오 편집 — 공통 기능 (25개)

| ID | 기능 | A 근거 | B 근거 | 구현 | 단계 |
|---|---|---|---|---|---|
| V01 | 클립 가져오기·연결 | §2.2 컷 편집 | §6.1 P0 | 🔧 네이티브 합성 모듈 | **MVP** |
| V02 | 시작·끝 자르기 | §2.2 트림 | §6.1 P0 | 🔧 | **MVP** |
| V03 | 분할·삭제·복제·재배치 | §2.2 | §6.1 P0 | ✅ UI + 🔧 | **MVP** (삭제·재배치) |
| V04 | 자르기·회전·비율 변경 | §2.2 | §6.1 P0 | 🔧 | **MVP** (비율) |
| V05 | 배경 여백 (단색·블러) | §2.2 | §6.1 P0 | 🔧 | **MVP** (단색) |
| V06 | 사진을 영상에 넣기 | §2.2 | §6.1 P0 | 🔧 | 2차 |
| V07 | 전환 효과 | §2.2 | §6.1 P1 | 🔧 | 2차 |
| V08 | 속도 조정 | §2.2 | §6.1 P1 | 🔧 | 2차 |
| V09 | 속도 곡선 | §2.2 | §6.1 P2 | 🔧 | 3차 |
| V10 | 역재생·정지 프레임 | §2.2 | §6.1 P1 | 🔧 | 3차 |
| V11 | 텍스트·자막 꾸미기 | §2.2 | §6.1 P0 | ✅ UI + 🔧 오버레이 렌더 | **MVP** |
| V12 | 날짜·시간 오버레이 | §1.4 setlog 맥락 | §6.1 P0 | ✅ | **MVP** |
| V13 | 스티커·이미지 오버레이 | §2.2 | §6.1 P1 | 🔧 | 2차 |
| V14 | PIP·화면 분할 | §4.2 분할화면 | §6.1 P1 | 🔧 | 2차 |
| V15 | 다중 트랙 | §2.2 | §6.1 P2 | 🔧 | 3차 |
| V16 | 키프레임 | §2.2 | §6.1 P2 | 🔧 | 3차 |
| V17 | 마스크·크로마키 | §2.2 | §6.1 P2 | 🔧 | 3차 |
| V18 | 영상 색보정·LUT | §2.2 | §6.1 P1 | 🔧 | 2차 |
| V21 | 세로 영상 자동 구도 | §3.1 My FanCam | §6.1 P2 | 🔧 | 3차 |
| V22 | 자동 저장·프로젝트 복구 | — | §6.1 P0 | ✅ SQLite | **MVP** |
| V23 | 출력 품질 선택 | §2.2 내보내기 | §6.1 P0 | 🔧 | **MVP** |
| V24 | 렌더 진행·취소·재시도 | — | §6.1 P0 | ✅ | **MVP** |
| O01 | 원음 음량·음소거 | §2.2 오디오 | §6.2 P0 | 🔧 | **MVP** |
| O02 | 배경 음악 | §2.2 | §6.2 P0 | 🔧 | **MVP** (사용자 가져온 음원) |
| O04 | 내레이션 녹음 | §2.2 보이스오버 | §6.2 P1 | ✅ expo-audio | 2차 |
| O05 | 페이드 인·아웃 | §2.2 | §6.2 P1 | 🔧 | 2차 |
| O07 | 대화 중 음악 낮추기 (더킹) | §2.2 | §6.2 P1 | 🔧 | 2차 |
| O08 | 비트에 맞춘 컷 | §2.2 비트 감지 | §6.2 P1 | 🔧 | 3차 |
| O10 | TTS | §2.2 | §6.2 P2 | ☁️ | 3차 |

### 2.6 일상 기록·공유 — 공통 기능 (16개)

| ID | 기능 | A 근거 | B 근거 | 구현 | 단계 |
|---|---|---|---|---|---|
| D01 | 짧은 순간 기록 (2~5초) | §1.4, §4.1 setlog | §7.2 P0 | ✅ | **MVP** |
| D02 | 촬영 리마인더 | §4.2 일일/시간별 알림 | §7.2 P1 | ✅ expo-notifications 로컬 | **MVP** (로컬 알림만) |
| D03 | 하루 브이로그 자동 구성 | §4.1 setlog 자동 병합 | §7.2 P0 | 🔧 네이티브 합성 | **MVP** |
| D04 | 친구 그룹 공유 | §4.2 소규모 비공개 그룹 | §7.2 P1 | 서버 | 3차 |
| D05 | 공동 브이로그 (분할화면) | §4.1 setlog 분할 합성 | §7.2 P1 | 서버 + 🔧 | 3차 |
| D06 | 같은 순간 촬영 미션 | §1.4 BeReal | §7.2 P2 | 서버 | 3차 |
| D07 | 전·후면 순간 기록 | §1.4 BeReal | §7.2 P1 | ✅ 순차 촬영 | 2차 |
| D08 | 셀피 반응 | §4.2 RealMoji | §7.2 P2 | 서버 | 3차 |
| D09 | 개인 추억 보관함 | §4.2 자동 리캡 | §7.2 P0 | ✅ | **MVP** |
| D10 | 홈 화면 위젯 | §4.2 Locket | §7.2 P2 | 🔧 | 3차 |
| D12 | 캘린더형 영상 일기 | §4.2 1SE·Day One | §7.2 P0 | ✅ | **MVP** |
| D13 | 월간·연간 회고 | §4.2 자동 리캡 | §7.2 P1 | 🔧 | 2차 |
| D16 | 공개 범위 선택 | §4.2 | §7.2 P1 | 서버 | 3차 |
| D17 | 댓글·반응 | §4.2 반응 양식 | §7.2 P1 | 서버 | 3차 |
| D19 | 외부 공유·다운로드 | §4.2 외부 재공유 | §7.2 P0 | ✅ expo-sharing | **MVP** |
| D22 | 편집 표시·원본 선택 (AI 라벨) | §2.2 AI 생성물 표기 | §7.2 P1 | ✅ 메타데이터 | 2차 |

### 2.7 저장·기반 — 공통 기능 (9개)

| ID | 기능 | A 근거 | B 근거 | 단계 |
|---|---|---|---|---|
| L01 | 갤러리·파일 가져오기 | §5.1 expo-media-library | §8.1 P0 | **MVP** |
| L02 | 최소 권한 요청 | §5.1 Android 14 부분 접근 | §8.1 P0 | **MVP** |
| L03 | 원본·편집본·프로젝트 구분 | §2.2 비파괴 | §8.1 P0 | **MVP** |
| L04 | 오프라인 촬영·초안 | — | §8.1 P0 | **MVP** |
| L07 | 섬네일·미리보기 캐시 | — | §8.1 P0 | **MVP** |
| L08 | 저장 공간 정리 | §4.1 setlog 불만 | §8.1 P1 | 2차 |
| L09 | HDR·SDR 출력 처리 | §2.2 | §8.1 P1 | 2차 |
| L10 | 메타데이터 선택 (위치 제외) | — | §8.1 P0 | **MVP** |
| L12 | AI 처리 상태·실패 복구 | §5.2 크레딧 모델 | §8.1 P1 | 2차 |

### 2.8 한쪽 문서에만 있는 항목 (참고)

- A에만: Siri 카메라 모드·Visual Intelligence, Spatial Scenes, Reference Image, 젠록, APV 코덱, Creative Studio, 가상 반사판, Image Playground, Genmoji, 지연 공개(Lapse), Instagram 스티커 류 → 전부 3차 이후 또는 범위 외
- B에만: C42 저장 공간·발열 안내(P0 → MVP에 포함), V25 SRT 입출력, O09 EQ, D14 여행 프로젝트, D15·D18·D20·D21 그룹 관리 세부, L05·L06·L11 서버 항목 → 서버 도입 시 함께

---

## 3. MVP 범위 (1차 출시)

공통 기능 중 **P0 + 구현 가능(✅/🔧)** 항목이다. 총 44개.

| 영역 | 기능 ID | 개수 |
|---|---|---|
| 촬영 | C01 C02 C04 C08 C09 C10 C11 C13 C29 C30 C31 C42 | 12 |
| 사진 편집 | P01 P03 P04 P05 P06 P11 P12 P20 P22 P23 P24 P25 P26 | 13 |
| 영상 편집 | V01 V02 V03 V04 V05 V11 V12 V22 V23 V24 O01 O02 | 12 |
| 일상 기록 | D01 D02 D03 D09 D12 D19 | 6 |
| 기반 | L01 L02 L03 L04 L07 L10 | 6 |

MVP에서 제외한 P0 두 개와 이유:
- **C05 터치 초점, C07 노출 보정**: expo-camera가 지원하지 않는다. VisionCamera v5 전환(2차) 시 함께 추가한다.

---

## 4. 화면 설계

### 4.1 내비게이션 구조 (Expo Router)

```
app/
├── _layout.tsx              루트: 테마, DB 초기화, 권한 프로바이더
├── (tabs)/
│   ├── _layout.tsx          탭: 기록 · 보관함 · 설정  (+ 중앙 촬영 버튼)
│   ├── index.tsx            [기록] 오늘 타임라인 + 캘린더 (D12, D09)
│   ├── library.tsx          [보관함] 날짜별 미디어·프로젝트 (L03, L07)
│   └── settings.tsx         [설정] 알림, 저장, 메타데이터 (D02, L10, C42)
├── camera.tsx               [촬영] 전체화면 모달 (C01~C31)
├── review.tsx               [빠른 검토] 재촬영/편집/저장 (C13)
├── edit/
│   ├── photo/[id].tsx       [사진 편집] (P01~P26)
│   └── video/[id].tsx       [영상 편집] 타임라인 (V01~V24, O01~O02)
├── vlog/[date].tsx          [하루 브이로그] 자동 구성·내보내기 (D03)
└── export.tsx               [내보내기] 품질·메타데이터·공유 (V23, P26, D19, L10)
```

### 4.2 화면별 요소

**[촬영] camera.tsx**
- 상단 바: 플래시(끔/자동/켬/토치) · 비율(1:1/4:5/9:16/풀) · 격자 토글 · 타이머(끔/3/10초) · 설정
- 뷰파인더: 비율에 맞춘 마스크 오버레이, 3×3 격자, 수평계(가속도계), 핀치 줌 + 줌 슬라이더(1x/2x/5x 단계)
- 하단: 모드 셀렉터 [사진 | 영상 | 순간기록(2초/5초)] · 셔터(사진: 탭 / 영상: 탭 시작·정지 / 순간기록: 탭 후 자동 종료) · 전후면 전환 · 최근 촬영 섬네일
- 녹화 중: 상단 중앙 경과 시간(mm:ss), 빨간 점, 순간기록은 남은 시간 링 애니메이션
- 저장 공간 2GB 미만 또는 발열 경고 시 상단 배너 (C42)
- 타이머 카운트다운 오버레이, 종료 시 햅틱

**[빠른 검토] review.tsx**
- 촬영 결과 전체 표시(사진 / 영상 자동 재생)
- 버튼: 다시 찍기 · 편집 · 저장(기록에 추가) · 공유
- 순간기록 모드는 자동으로 오늘 기록에 저장 후 캡션 입력 1줄 제공

**[사진 편집] edit/photo/[id].tsx**
- 캔버스: Skia Canvas, 길게 누르면 원본 표시(P23), 핀치 확대
- 도구 탭: 보정 · 필터 · 자르기 · 텍스트 · 가리기
  - 보정: 노출 · 대비 · 하이라이트 · 그림자 · 색온도 · 틴트 · 채도 · 생동감 슬라이더 (-100~100)
  - 필터: 프리셋 썸네일 가로 스크롤 + 강도 슬라이더 (0~100)
  - 자르기: 비율 프리셋(자유/1:1/4:5/3:4/9:16/16:9), 90° 회전, 좌우/상하 반전
  - 텍스트: 입력, 폰트 3종, 색, 크기, 드래그 이동
  - 가리기: 블러/모자이크 브러시, 굵기, 지우개
- 상단: 취소 · 실행취소 · 다시실행 · 비교 · 저장
- 저장: 편집 스택 JSON을 DB에 보관(P25), 렌더 결과를 새 파일로 내보내기(P26)

**[영상 편집] edit/video/[id].tsx**
- 프리뷰: expo-video, 현재 클립의 트림 범위만 재생, 비율 미리보기(배경 단색)
- 타임라인: 클립 썸네일 스트립, 좌우 트림 핸들, 길게 눌러 순서 변경, 삭제
- 도구: 클립 추가(갤러리) · 비율(9:16/1:1/16:9) · 텍스트 오버레이(시작·끝 시간) · 날짜 스탬프 토글 · 오디오(원음 음량, 배경음악 가져오기·음량)
- 자동 저장: 모든 변경을 즉시 DB에 반영(V22)
- 내보내기: 1080p/720p 선택 → 네이티브 합성 모듈 → 진행률 · 취소 · 실패 시 재시도(V23, V24)

**[기록] (tabs)/index.tsx**
- 상단: 월 캘린더(기록 있는 날 점 표시), 날짜 탭 시 해당 날 타임라인
- 타임라인: 시간순 카드(섬네일 · 시각 · 캡션 · 종류 배지)
- 하단 고정: "오늘 브이로그 만들기" (클립 ≥ 1개일 때)
- 빈 상태: 다음 리마인더 시각 + 촬영 유도

**[하루 브이로그] vlog/[date].tsx**
- 자동 구성 규칙: 해당 날짜 순간기록 클립을 시각순 정렬 → 각 클립 최대 3초 → 날짜·시각 스탬프 → 비율 9:16 → 총 길이 상한 60초(초과 시 균등 트림)
- 미리보기(순차 재생) → "영상으로 저장" → 네이티브 합성 → 공유

**[설정] (tabs)/settings.tsx**
- 리마인더: 끔 / 매시간 / 3시간 / 하루 1회(시각 선택), 조용한 시간대
- 촬영 기본값: 기본 모드, 순간기록 길이(2/5초), 영상 해상도(1080p/720p/4K)
- 저장: 원본 보존 토글, 캐시 삭제, 사용 용량 표시
- 내보내기: 위치 메타데이터 제거(기본 켬), 촬영 날짜 유지
- 정보: 권한 상태, 버전

---

## 5. 아키텍처

```
mobile/
├── app/                     Expo Router 화면 (§4.1)
├── src/
│   ├── features/
│   │   ├── camera/          CameraView 래퍼, 컨트롤, 모드 상태머신, 타이머, 수평계
│   │   ├── photo-editor/    EditStack(비파괴), Skia 렌더러, 프리셋, 도구 패널
│   │   ├── video-editor/    Timeline 모델, 트림/정렬 리듀서, 프리뷰, 내보내기 큐
│   │   ├── daily-log/       기록 CRUD, 캘린더 집계, 브이로그 조립 규칙
│   │   ├── reminders/       로컬 알림 스케줄
│   │   └── export/          렌더 → 파일 → MediaLibrary → 공유, 메타데이터 정책
│   ├── services/
│   │   ├── db/              expo-sqlite 스키마·마이그레이션·리포지토리
│   │   ├── media/           파일 경로, 섬네일 캐시, 용량 계산
│   │   └── permissions/     카메라·마이크·미디어 권한 상태
│   ├── native/
│   │   └── video-composer/  네이티브 합성 모듈 JS 인터페이스 (+ 폴백)
│   ├── ui/                  공통 컴포넌트·테마·아이콘
│   └── utils/
├── modules/
│   └── video-composer/      Expo Module: iOS AVMutableComposition / Android Media3 Transformer
├── assets/
├── app.json / eas.json
└── __tests__/               순수 로직 단위 테스트 (EditStack, Timeline, VlogAssembler)
```

**계층 규칙**
- 화면(app/)은 features의 훅·컴포넌트만 사용한다. DB·파일 접근은 services 경유.
- 편집 로직(EditStack, Timeline, VlogAssembler)은 React·네이티브 의존 없는 순수 TS로 작성해 Jest로 검증한다.
- 네이티브 의존 기능은 `native/` 인터페이스 뒤에 두고, 모듈 부재 시(Expo Go) 명시적 오류 메시지와 폴백(순차 재생 미리보기)을 제공한다.

### 5.1 Expo Go vs 개발 빌드

| 기능 | Expo Go | 개발 빌드(EAS) |
|---|---|---|
| 촬영(expo-camera), 사진 편집(Skia), 기록·캘린더, 알림, 공유 | ✅ | ✅ |
| 영상 트림·연결·내보내기, 하루 브이로그 저장 | ✗ (미리보기만) | ✅ `modules/video-composer` |
| 터치 초점·노출 보정·RAW·고FPS (2차) | ✗ | ✅ VisionCamera v5 |

---

## 6. 데이터 모델 (SQLite)

```sql
-- 원본·편집본·프로젝트 구분 (L03)
CREATE TABLE media (
  id TEXT PRIMARY KEY,            -- uuid
  kind TEXT NOT NULL,             -- 'photo' | 'video'
  uri TEXT NOT NULL,              -- 앱 문서 디렉터리 내 원본 경로
  thumb_uri TEXT,                 -- 섬네일 캐시 (L07)
  width INTEGER, height INTEGER,
  duration_ms INTEGER,            -- video
  captured_at INTEGER NOT NULL,   -- epoch ms
  source TEXT NOT NULL,           -- 'camera' | 'import'
  has_location INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL
);

-- 일상 기록 항목 (D01, D12)
CREATE TABLE log_entries (
  id TEXT PRIMARY KEY,
  media_id TEXT NOT NULL REFERENCES media(id) ON DELETE CASCADE,
  log_date TEXT NOT NULL,         -- 'YYYY-MM-DD' (로컬 기준)
  caption TEXT,
  mode TEXT NOT NULL,             -- 'moment' | 'photo' | 'video'
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_log_date ON log_entries(log_date);

-- 비파괴 사진 편집 (P25)
CREATE TABLE photo_edits (
  id TEXT PRIMARY KEY,
  media_id TEXT NOT NULL REFERENCES media(id) ON DELETE CASCADE,
  stack_json TEXT NOT NULL,       -- EditStack 직렬화 (§6.1)
  exported_uri TEXT,              -- 마지막 내보내기 결과
  updated_at INTEGER NOT NULL
);

-- 영상 프로젝트 (V22)
CREATE TABLE video_projects (
  id TEXT PRIMARY KEY,
  title TEXT,
  timeline_json TEXT NOT NULL,    -- Timeline 직렬화 (§6.2)
  aspect TEXT NOT NULL,           -- '9:16' | '1:1' | '16:9'
  exported_uri TEXT,
  updated_at INTEGER NOT NULL
);

-- 설정 (키-값)
CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
```

### 6.1 EditStack (사진 편집 스택)

```ts
type EditOp =
  | { type: 'adjust'; exposure: number; contrast: number; highlights: number;
      shadows: number; temperature: number; tint: number; saturation: number; vibrance: number }
  | { type: 'filter'; presetId: string; intensity: number }        // 0..1
  | { type: 'crop'; rect: {x:number;y:number;w:number;h:number}; rotate: 0|90|180|270; flipH: boolean; flipV: boolean }
  | { type: 'text'; id: string; text: string; x: number; y: number; size: number; color: string; font: string }
  | { type: 'mask-blur'; id: string; path: string; radius: number; mode: 'blur'|'mosaic' };

interface EditStack { version: 1; ops: EditOp[]; cursor: number }  // cursor = undo 위치
```
- 모든 op는 append-only 히스토리이며, 유효 상태는 `ops[0..cursor)`를 접어서 계산한다(마지막 `adjust`·`filter`·`crop`이 이기고, `text`/`mask`는 id별 최신값, `remove-*`로 삭제). 슬라이더는 드래그 중 라이브 값을 쓰고 손을 뗄 때만 push하므로 히스토리가 폭발하지 않는다.
- 기하(crop/rotate/flip)는 expo-image-manipulator로 파생 이미지에 미리 구워 두고, Skia 파이프라인은 색·마스크·텍스트만 처리한다.
- 렌더 순서: crop(파생) → adjust+filter(단일 SkSL 패스) → mask(blur/mosaic) → text.

### 6.2 Timeline (영상 프로젝트)

```ts
interface Clip { id: string; mediaId: string; uri: string; srcDurationMs: number;
                 trimStartMs: number; trimEndMs: number; volume: number }
interface TextOverlay { id: string; text: string; startMs: number; endMs: number;
                        x: number; y: number; size: number; color: string }
interface Timeline {
  version: 1;
  clips: Clip[];
  overlays: TextOverlay[];
  dateStamp: boolean;
  music?: { uri: string; volume: number; startMs: number };
  aspect: '9:16' | '1:1' | '16:9';
  background: string;              // hex
}
```

---

## 7. 핵심 기능 상세 사양

### 7.1 촬영 모드 상태머신 (C01, C31)

```
idle ─(셔터, photo)──────────────▶ capturing ─▶ review
idle ─(셔터, video)──────────────▶ recording ─(셔터)─▶ stopping ─▶ review
idle ─(셔터, moment)─────────────▶ recording ─(N초 자동)─▶ stopping ─▶ autosave ─▶ idle(토스트)
idle ─(셔터, timer>0)────────────▶ countdown ─(0)─▶ 위 분기
countdown ─(셔터)────────────────▶ idle (취소)
```
- `moment` 모드 길이: 설정값 2초 또는 5초. 녹화 중 전후면 전환 불가(expo-camera 제한). 종료 후 오늘 기록에 자동 추가하고 캡션 입력 토스트 표시.
- 녹화 최대 길이: video 모드 10분, 저장 공간 2GB 미만이면 시작 전 경고(C42).

### 7.2 비율 가이드와 결과 크롭 (C11)

- 뷰파인더는 센서 비율(4:3 또는 16:9) 그대로 두고, 선택 비율 영역 밖을 반투명 마스크로 덮는다.
- 사진 저장 시 선택 비율로 중앙 크롭한 결과를 **별도 파일**로 저장하고 원본도 보존(L03). 영상은 프로젝트 `aspect`로 기록하고 내보내기 시 적용.

### 7.3 사진 보정 수식 (P03~P06)

Skia `ColorMatrix` + `RuntimeShader`(SkSL)로 단일 패스 처리.
- 노출: `rgb *= pow(2, exposure)` (exposure ∈ [-2, 2])
- 대비: `rgb = (rgb - 0.5) * (1 + c) + 0.5`
- 하이라이트/그림자: 휘도 `L` 기준 가중치 `w_h = smoothstep(0.5, 1.0, L)`, `w_s = 1 - smoothstep(0.0, 0.5, L)`; `rgb += highlights * w_h * 0.5`, `rgb += shadows * w_s * 0.5`
- 색온도/틴트: 온도는 R↑B↓(또는 반대), 틴트는 G 축 보정. 범위 ±0.3
- 채도: 휘도와 선형 보간. 생동감: 이미 채도 높은 픽셀일수록 적게 보정 `(1 - sat) * vibrance`
- 모든 슬라이더 UI 값 [-100, 100] → 내부 정규화.

### 7.4 필터 프리셋 (P11, P12)

MVP 프리셋 8종을 자체 ColorMatrix/파라미터로 정의한다(타사 필터 복제 아님): `원본`, `클린`, `웜 필름`, `쿨 필름`, `페이드`, `모노`, `세피아`, `비비드`. 강도는 원본 색과 `mix(original, filtered, intensity)`.

### 7.5 가리기 (P22)

- 브러시 경로를 `mask-blur` op로 저장(Skia Path SVG 문자열).
- 렌더: 마스크 영역에만 `Blur(radius)` 또는 모자이크(다운샘플 후 nearest 업샘플) 적용.
- 2차에서 ML Kit 얼굴 탐지로 자동 영역 제안(A25).

### 7.6 영상 내보내기 (V01~V05, V23, O01, O02)

입력: `Timeline` + 출력 해상도. 처리: `modules/video-composer`
- iOS: `AVMutableComposition`에 클립을 trim 범위로 순차 삽입, `AVMutableVideoComposition`으로 비율·배경색·회전 처리, 텍스트는 `CALayer` 합성(`AVVideoCompositionCoreAnimationTool`), 오디오 믹스는 `AVMutableAudioMix`, `AVAssetExportSession` preset 1080p/720p.
- Android: Media3 `Transformer` + `EditedMediaItemSequence`(클립 순차) + `Presentation.createForAspectRatio` + `OverlayEffect`(텍스트 비트맵) + 오디오 볼륨 `ChannelMixingAudioProcessor`/`Composition` 믹스.
- 진행률 콜백(0~1), 취소 토큰, 실패 시 오류 코드(`E_UNSUPPORTED_CODEC`, `E_NO_SPACE`, `E_CANCELLED`).
- Expo Go 폴백: 모듈 부재 시 순차 재생 미리보기만 제공하고 "개발 빌드 필요" 안내.

### 7.7 하루 브이로그 조립 (D03)

```
입력: 해당 날짜 log_entries (mode='moment' 또는 video), 설정(최대 클립 길이 3s, 총 상한 60s)
1. captured_at 오름차순 정렬
2. 각 클립 trim = [0, min(duration, 3000)]
3. 총합 > 60s 이면 각 클립 길이를 60s / n 으로 균등 축소 (최소 1s)
4. overlays = 각 클립 시작 시점에 "HH:mm" 스탬프 (dateStamp=true 이면 첫 클립에 "YYYY.MM.DD" 추가)
5. Timeline{aspect:'9:16', background:'#000'} 반환 → video_projects에 저장 → 내보내기
```

### 7.8 리마인더 (D02)

- `expo-notifications` 로컬 반복 알림. 매시간: 9~22시 정시, 3시간: 9/12/15/18/21시, 하루 1회: 사용자 지정 시각.
- 조용한 시간대(기본 23~08시) 제외. 알림 탭 → `camera?mode=moment` 딥링크.

### 7.9 메타데이터 정책 (L10)

- 내보내기 시 기본적으로 위치 EXIF 제거(이미지 재인코딩 경유). 촬영 일시는 유지.
- 설정에서 "위치 포함" 선택 시 원본 EXIF 유지.

---

## 8. 비기능 요구사항

| 항목 | 요구 |
|---|---|
| 권한 | 카메라·마이크는 촬영 화면 진입 시, 미디어 라이브러리는 가져오기/저장 시점에 요청. Android 14 부분 접근, iOS 제한 라이브러리 대응 |
| 오프라인 | 모든 MVP 기능은 네트워크 없이 동작 |
| 성능 | 편집 미리보기 2048px 다운샘플, 저장 시 원본 해상도 렌더. 뷰파인더 60fps 유지 |
| 저장 | 원본은 앱 문서 디렉터리, 섬네일은 캐시 디렉터리. 사용자 요청 시 MediaLibrary에 사본 저장 |
| 복구 | 편집·타임라인 변경은 300ms 디바운스 후 DB 저장. 앱 강제 종료 후 재진입 시 복원 |
| 접근성 | 모든 아이콘 버튼에 accessibilityLabel, 최소 터치 44pt |
| 다국어 | 1차 한국어, 문자열은 리소스 파일로 분리 |

---

## 9. 기술 스택 매핑

| 영역 | 패키지 | 비고 |
|---|---|---|
| 프레임워크 | expo (SDK 54+), expo-router, TypeScript strict | New Architecture |
| 카메라 | expo-camera (MVP) → react-native-vision-camera v5 (2차) | 추상화 인터페이스 `CameraDevice` 뒤에 배치 |
| 사진 렌더 | @shopify/react-native-skia | ColorMatrix·RuntimeShader·Path |
| 기하 변환 | expo-image-manipulator | 크롭·회전·반전·EXIF 제거 |
| 영상 재생 | expo-video | 트림 범위 재생 |
| 오디오 | expo-audio | 배경음악 미리듣기, 2차 내레이션 |
| 미디어 접근 | expo-media-library, expo-image-picker, expo-file-system | |
| 영상 합성 | `modules/video-composer` (로컬 Expo Module) | iOS AVFoundation / Android Media3 Transformer |
| DB | expo-sqlite | |
| 알림 | expo-notifications | 로컬 알림 |
| 공유 | expo-sharing | |
| 센서 | expo-sensors | 수평계 |
| 햅틱 | expo-haptics | |
| 상태 | zustand | 편집기·카메라 상태 |
| 테스트 | jest + jest-expo | 순수 로직 |
| 빌드 | EAS Build (development / preview / production 프로필) | Linux에서 iOS 빌드 |

---

## 10. 단계별 로드맵

| 단계 | 범위 | 완료 기준 |
|---|---|---|
| **1차 (MVP)** | §3의 44개 기능 | Expo Go에서 촬영·사진 편집·기록 동작, 개발 빌드에서 영상 내보내기·브이로그 저장 동작 |
| 2차 | VisionCamera 전환(C05 C07 C14 C32~C35), HSL·그레인·마스크(P07 P13 P16 P17), 자동 자막(A15), 배경 제거(A05), 얼굴 자동 블러(A25), 전환·속도·LUT(V07 V08 V18), 내레이션·더킹(O04 O07), 월간 회고(D13), 전후면 순간기록(D07) | 실기기 품질 검증 |
| 3차 | 클라우드 생성 편집(A02 A04 A07, 크레딧 과금), 친구 그룹·공동 브이로그(D04 D05, 서버), 다중 트랙·키프레임(V15 V16), 오디오 분리(A19) | 비용·지연·권한 모델 확정 |
| 장기 | RAW/Log/HDR 촬영, 멀티캠, 보간 슬로모, 위젯 | 기기 호환성 |

---

## 11. 검증 계획

| 대상 | 방법 | MVP 기준 |
|---|---|---|
| 편집 스택·타임라인·브이로그 조립 | Jest 단위 테스트 | 리듀서·직렬화·경계값 통과 |
| 타입 안전 | `tsc --noEmit` strict | 오류 0 |
| 번들 | `expo export --platform android,ios` | Metro 번들 성공 |
| 촬영 호환 | Galaxy S2x, 보급형 Android, iPhone 15/16 실기기 | 모드 전환·비율·저장 정상 |
| 영상 내보내기 | 세로/가로 혼합, 가변 FPS, HEVC/H.264 입력 | 1080p 출력, 오디오 싱크, 진행률·취소 |
| 복구 | 편집 중 강제 종료 | 재진입 시 상태 복원 |

---

## 12. 구현 현황 (2026-10-12)

- 소스: `mobile/` (Expo SDK 57, React Native 0.86, TypeScript strict). 실행·빌드 방법은 `mobile/README.md`.
- 검증: `tsc --noEmit` 오류 0, Jest 29개 통과(편집 스택·타임라인·브이로그 조립·카메라 상태머신·알림 스케줄·비율 계산), Metro 번들(android/ios) 성공.
- §3 MVP 44개 기능 전부 코드 반영. 영상 내보내기(V01~V05, V23, O01, O02, D03 저장)는 `modules/video-composer` 네이티브 모듈 경유이며 개발 빌드에서만 동작.
- 미검증: 네이티브 모듈 컴파일(Swift/Kotlin)과 실기기 동작. 이 환경에 Android SDK·Xcode가 없어 EAS 개발 빌드 후 확인 필요.

## 12.1 Android 네이티브 확장 (2026-10-14)

Android 우선 결정에 따라 🔧 항목 중 Android에서 가능한 기능을 로컬 Expo 모듈(Kotlin)로 구현했다. 전부 `mobile/modules/` 아래에 있고 iOS/Expo Go에서는 자동으로 비활성화된다(`src/native/android.ts`의 `is*Available`).

| 모듈 | 구현 기능 (ID) | 기술 |
|---|---|---|
| `camerax` | C05 터치 초점 · C06 초점/노출 잠금(길게 누르기) · C07 노출 보정 · C17 연속 촬영(3/5/10) · C18 HDR · C19 야간 · C20 인물 보케 · C24 RAW(DNG+JPEG) · C25 수동 ISO/셔터/WB · C29 FPS 선택(30/60/120) · C32 녹화 일시정지/재개 · C33 손떨림 보정 · C34 고FPS · C35 타임랩스(1초 간격 스틸 → 이미지 시퀀스) · C39 10비트 HLG HDR 영상 · C42 발열 경고(배너) | CameraX 1.6.2 + Extensions + Camera2 Interop, Expo View 모듈 |
| `video-composer` (확장) | V06 사진 클립 · V08 속도(0.25~4x, 오디오 피치 유지) · V13 이미지 스티커 · V18 색보정(밝기/대비/채도/색조)+Hald LUT · L09 HDR→SDR 톤매핑 · C35 타임랩스 조립 | Media3 1.11.1 Transformer/Effect |
| `mlkit` | A01 자동 보정 제안(히스토그램) · A05 배경 제거(PNG) · A09/P17 피사체 마스크 · A25 얼굴 자동 가림 · 문서 스캔 · 텍스트 영역 탐지(번호판 가림용 기반) | ML Kit Subject Segmentation(베타), Face Detection, Korean Text Recognition, Document Scanner |
| `home-widget` | D10 홈 화면 위젯(오늘 기록 섬네일 + 촬영 딥링크) | AppWidgetProvider + RemoteViews |
| `android-utils` | C42 PowerManager 발열 상태 · L10 EXIF 위치 제거(재인코딩 없이) | PowerManager, ExifInterface 1.4.2 |

- 카메라 화면은 Android 개발 빌드에서 `CameraXScreen`, 그 외에는 기존 expo-camera 화면을 사용한다(`src/app/camera.tsx`).
- 아직 미구현(🔧 중): C14 실시간 필터 프리뷰(CameraEffect/OpenGL 필요), C22 파노라마, C36 전후면 동시 녹화(ConcurrentCamera), V07 전환 효과, V10 역재생, V14 PIP, V19/V21 영상 안정화·자동 구도, A11 업스케일, A15 자동 자막, A19 오디오 분리, A22 보간 슬로모, O05/O07 페이드·더킹.
- 검증: 5개 모듈 Kotlin 컴파일 통과, APK 빌드 결과는 `BUILD.md` 참고. 실기기 동작(특히 Extensions·RAW·HDR 영상·세그멘테이션)은 기기별 지원이 달라 확인 필요.

## 13. 미결 사항

1. 영상 합성 모듈은 이 환경(Linux, Android SDK 없음)에서 컴파일 검증을 하지 못했다. EAS 개발 빌드 후 실기기 검증 필요.
2. 배경음악은 사용자가 가져온 음원만 지원한다. 라이선스 음원 라이브러리는 범위 외.
3. 친구 그룹은 서버 설계(인증, 권한, 삭제 전파)가 확정된 뒤 3차에서 진행한다.
4. 클라우드 생성 AI 공급자(Gemini 3.1 Flash Image vs Stability vs Replicate)는 품질·비용 실증 후 선택한다.
