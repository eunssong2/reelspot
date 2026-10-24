# 사진·영상 촬영/편집 앱 기능 조사

- 작성일: 2026-10-12
- 목적: React Native + Expo로 만들 **촬영 + 편집 앱**의 후보 기능을 빠짐없이 나열하고, 각 기능이 서드파티 앱에서 실제로 구현 가능한지 표시한다.
- 조사 범위
  1. 기본 카메라 앱 촬영 기능 (Galaxy S25/S26·Z Fold7/Flip7, iPhone 16/17/18 Pro)
  2. OEM AI 편집 기능 (Galaxy AI / One UI 8~9, Apple Intelligence / iOS 18~27, Google Photos·Pixel)
  3. 일상 공유 플랫폼 (setlog, BeReal, Locket, Instagram, TikTok, Snapchat, SNOW 계열, Dazz 등)
  4. 전문 편집 앱 (Lightroom, Snapseed, VSCO, Photoshop Mobile, Picsart, CapCut, VN, LumaFusion, DaVinci, Premiere Mobile 등)
  5. RN/Expo 라이브러리 현황과 구현 경로

### 구현 가능성 범례

| 표기 | 의미 |
|---|---|
| ✅ | 서드파티 앱에서 온디바이스로 구현 가능 (OS API 또는 RN 라이브러리 존재) |
| 🔧 | 가능하나 네이티브 모듈(Expo Modules/Nitro) 직접 작성 필요 |
| ☁️ | 클라우드 생성형 AI API로 구현 (Gemini 3.1 Flash Image, Stability, Replicate 등) |
| 🔒 | OEM 전용. 공개 API 없음. 대체 경로로만 유사 구현 |

---

## 1. 촬영 기능

### 1.1 사진 촬영

| 기능 | 설명 | 출처(기기/앱) | 구현 |
|---|---|---|---|
| 자동 사진 (Auto / Photo) | 장면 인식 후 노출·WB 자동. Galaxy는 Scene Optimizer, iPhone은 Deep Fusion/Smart HDR | Galaxy, iPhone | ✅ |
| 인물 사진 (Portrait) | 깊이 기반 배경 흐림, 조명 효과(Studio, Contour, Stage, High-Key Mono 등), 촬영 후 f값·초점 변경 | Galaxy, iPhone 15+ | 🔧 깊이·세그멘테이션 매트 API로 보케 직접 렌더 |
| 프로/수동 (Pro) | ISO·셔터·EV·WB·초점 수동, 히스토그램, 포커스 피킹, 프리셋 저장 | Galaxy Pro, iPhone 18 Pro Pro controls | ✅ VisionCamera v5 노출/초점/WB 잠금 |
| RAW / ProRAW | 16비트 DNG, 48MP ProRAW, ProRAW Max(JPEG-XL) | Galaxy Expert RAW, iPhone Pro | ✅ VisionCamera v5 DNG·ProRAW |
| 야간 (Night) | 다중 프레임 합성 저조도. One UI 8.5부터 사진 모드 토글 | Galaxy, iPhone | 🔒 자동 합성 파이프라인 비공개. Android CameraX Extensions Night 모드(정지사진 한정)로 부분 대체 |
| 고해상 (24/48/50/200MP) | 센서 풀해상도 또는 AI Fusion(12MP 멀티프레임+50MP 합성) | Galaxy, iPhone 48MP | ✅ 해상도 선택 가능. AI Fusion은 🔒 |
| 매크로 (Macro) | 초광각 자동 전환 근접 촬영 | iPhone, Galaxy | ✅ 렌즈 선택 |
| 포토그래픽 스타일 (Photographic Styles) | 톤·색상 2D 패드, 촬영 후에도 변경 가능, 텍스처·그레인(3세대) | iPhone 16+ | 🔒 캡처 파이프라인 비공개. Skia LUT/셰이더로 유사 효과 ✅ |
| 필터/필름 룩 실시간 프리뷰 | 아날로그 필름 필터, 강도·그레인 조절, CCD·일회용카메라·VHS 에뮬레이션, 빛샘·날짜 스탬프 | Galaxy Filters, Dazz, Huji, NOMO, Meitu AI Flash | ✅ VisionCamera Skia 프리뷰 + SkSL |
| 뷰티/메이크업 실시간 | 피부 보정, 윤곽·얼굴 폭·이중턱, 메이크업, 체형 슬라이더 | SNOW, SODA, B612, Ulike, Meitu | 🔧 얼굴 랜드마크(ML Kit/MediaPipe) + 메시 워핑 직접 구현 |
| AR 렌즈/스티커 | 얼굴 추적 AR 효과 | Snapchat, TikTok, SNOW | 🔧 Snap Camera Kit SDK(무료화) 또는 자체 구현 |
| 파노라마 (Panorama) | 가로/세로 연속 촬영 합성 | Galaxy, iPhone | 🔧 OpenCV 스티칭 등 직접 구현 |
| 싱글 테이크 (Single Take) | 15초 촬영 후 여러 렌즈의 사진·클립 AI 자동 선별 | Galaxy | 🔧 유사 구현 가능(연속 캡처 + 미학 점수 Vision API) |
| 음식 (Food) | 색감 강조·부분 흐림, 탑뷰 가이드, 음식 인식 | Galaxy, Foodie | ✅ 필터 + 가이드 UI |
| 모션 포토 / Live Photo | 셔터 전후 1.5초 클립. Auto 옵션(움직임 감지 시만) | Galaxy, iPhone | ✅ iOS livePhotoMovieFileURL, Android 직접 구현 |
| 버스트 (Burst) | 연속 촬영 | iPhone, Galaxy | ✅ |
| 공간 사진 (Spatial photo) | Vision Pro용 스테레오 사진 | iPhone 15 Pro+ | ✅ iOS 18 isSpatialPhotoCaptureEnabled |
| 문서 스캔 (Document Scan) | 문서 감지, 구김·손가락·모아레 제거, PDF 병합 | Galaxy, iOS Vision | ✅ VisionKit / ML Kit Document Scanner |
| 천체 사진 (Astro) | 장노출 스택, 하늘 가이드 | Galaxy Expert RAW | 🔧 장노출 수동 + 스택 직접 구현 |
| 다중 노출 (Multi-exposure) | 여러 장 합성 | Galaxy Expert RAW, Dazz | ✅ Skia 블렌드 |
| 가상 조리개 (Virtual Aperture) / 가변 조리개 | F1.4~F16 보케 시뮬레이션. 18 Pro는 물리 가변 조리개 | Galaxy Expert RAW, iPhone 18 Pro | 🔧 깊이맵 기반 시뮬레이션 가능. 물리 조리개 API는 🔒 |
| 가상 반사판 (Virtual Reflector) | 역광 피사체에 Silver/Gold 반사판 효과·방향 | Galaxy S26 Expert RAW | 🔧 인물 세그멘테이션 + 릴라이팅 |
| 스페이스 줌 / AI 초해상 줌 | 100x 디지털 줌, 멀티프레임 AI 디테일 복원 | Galaxy Ultra | 🔒 AI 줌. 광학 렌즈 선택과 디지털 줌은 ✅ |
| 플래시 Constant Color | 플래시 색 보정 | iOS 18 | ✅ |

### 1.2 영상 촬영

| 기능 | 설명 | 출처 | 구현 |
|---|---|---|---|
| 기본 영상 (4K60, 8K30) | 해상도·FPS 선택, Auto FPS 저조도 | Galaxy, iPhone | ✅ 기기 지원 범위 내 |
| 고프레임 (4K120, FHD240) | 슬로모·고속 촬영, 촬영 후 재생 속도 변경 | iPhone 16 Pro+, Galaxy | ✅ VisionCamera Constraints fps |
| 프로 영상 (Pro Video) | ISO·EV·WB·색조·마이크 지향성 수동 | Galaxy, Blackmagic Cam | ✅ |
| Log 영상 (Galaxy Log / Apple Log 2) | 플랫 프로파일, 촬영 중 LUT 미리보기, ACES | Galaxy S25+, iPhone 15 Pro+ | ✅ VisionCamera Dynamic Range Apple Log. LUT 프리뷰는 Skia |
| HDR 영상 (10비트 HLG / Dolby Vision / HDR10+) | 10비트 HDR 녹화 | Galaxy, iPhone | ✅ VisionCamera HDR |
| ProRes / ProRes RAW / APV 코덱 | 고품질 코덱. ProRes RAW·4K120 ProRes는 외장 저장 필수 | iPhone Pro, Galaxy S26 Ultra(APV) | 🔧 expo-camera ProRes 422/4444 지원, VisionCamera는 H.264/H.265. ProRes RAW·APV는 네이티브 |
| 시네마틱 모드 (Cinematic) | 깊이 영상 + 자동 랙 포커스, 촬영 후 초점 편집 | iPhone, Galaxy Portrait Video | ✅ iOS 26 Cinematic Video Capture API + Cinematic 프레임워크. Android는 🔧 |
| 슈퍼 스테디 / 액션 모드 | 강력한 EIS, 수평 고정(Horizontal Lock) | Galaxy, iPhone | ✅ cinematicExtendedEnhanced 안정화. 수평 고정은 🔧 |
| 하이퍼랩스 / 타임랩스 | 가변 프레임레이트 타임랩스, 야간 타임랩스 | Galaxy, iPhone | ✅ 프레임 샘플링 직접 구현 |
| 듀얼 녹화 (Dual Rec / Dual Capture) | 전·후면 동시 녹화 PIP, 레이아웃 선택 | Galaxy, iPhone 17+, Instagram Dual, BeReal | ✅ iOS AVCaptureMultiCamSession, VisionCamera 멀티캠. Android 기기별 |
| 공간 비디오 (Spatial video) | 1080p30 스테레오 영상 + 공간 오디오 | iPhone 15 Pro+ | ✅ iOS 18 isSpatialVideoCaptureEnabled |
| 공간 오디오 / 360 오디오 녹음 | 4마이크 APAC 공간 오디오 | iPhone 16+, Galaxy | ✅ iOS 26 multichannelAudioMode |
| 오디오 믹스 (Audio Mix) | In-frame/Studio/Cinematic 음성 강조, 바람 소음 감소 | iPhone 16+ | ✅ Cinematic 프레임워크 CNAssetSpatialAudioInfo |
| 줌인 마이크 (Zoom-in mic) | 줌 배율에 따라 오디오 지향성 | Galaxy | 🔧 |
| 녹화 일시정지/재개 | 한 파일로 이어 녹화 | iOS 18, Galaxy | ✅ |
| 녹화 중 렌즈 전환 | 끊김 없이 전환 | Galaxy, iPhone | ✅ VisionCamera 가상 디바이스 |
| 그린스크린 실시간 | 배경 교체 촬영 | TikTok, Instagram, Edits | 🔧 셀피 세그멘테이션 프레임 프로세서 + Skia |
| 젠록 / 타임코드 | 멀티캠 동기화 | iPhone 17 Pro + Blackmagic | 🔧 공개 API 존재(심볼 미확인) |

### 1.3 촬영 보조 / UX

| 기능 | 설명 | 출처 | 구현 |
|---|---|---|---|
| 구도 가이드 (Shot Suggestions) | 수평계·격자·구도 안내, 포즈 가이드, 탑뷰 가이드 | Galaxy, Ulike, Foodie | ✅ |
| 추적 AF / 스마트 초점 추적 | 피사체 두 번 탭 후 화면 이탈해도 추적 | Galaxy, iPhone 18 Pro | ✅ VisionCamera focusTo + Vision 객체 추적 |
| 자동 프레이밍 / Center Stage | 인원수에 맞춰 화각·회전 자동 | Galaxy, iPhone 17 전면 | ✅ iOS 26 AVCaptureSmartFramingMonitor. Android 🔧 |
| 렌즈 얼룩 감지 | 뷰파인더 얼룩 시 힌트 | iOS 26 | ✅ Vision DetectLensSmudgeRequest |
| 카메라 컨트롤 버튼 / AirPods 셔터 | 물리 버튼 반누름 AE/AF, 슬라이드 조정 | iPhone 16+ | ✅ AVCaptureControl, LockedCameraCapture |
| 음성/손바닥/볼륨 셔터, 플로팅 셔터 | 대체 촬영 방법 | Galaxy | ✅ 손바닥은 손 포즈 모델 |
| 타이머 / 핸즈프리 / 텔레프롬프터 | 카운트다운, 연속 촬영 타이머, 대본 스크롤 | 공통, Instagram Reels, Edits | ✅ |
| 미학 점수 / 베스트 샷 선별 | 촬영본 품질 자동 평가 | Galaxy Single Take, Lightroom Assisted Culling | ✅ Vision CalculateImageAestheticsScoresRequest |
| Siri 모드 / Visual Intelligence / AI Select | 뷰파인더 대상 식별·질문·검색 | iOS 27, Galaxy | 🔒 호출 불가. Foundation Models(이미지 입력)·Gemini로 자체 구현 ☁️ |
| 폴더블 FlexCam / Dual Preview | 커버 화면 프리뷰·핸즈프리 | Galaxy Z | 🔧 Jetpack WindowManager 폴딩 상태 대응 |
| Reference Image (촬영 서명) | 센서 데이터 서명으로 변조 검증 | iPhone 18 Pro | 🔒. C2PA Content Credentials 자체 삽입은 🔧 |

### 1.4 일상 공유 앱 특유의 캡처 방식

| 기능 | 설명 | 출처 | 구현 |
|---|---|---|---|
| 시간 제약 촬영 | 매시간 알림 → 2~3초 영상 즉시 촬영, 갤러리 업로드·재촬영·필터 금지 | **setlog** | ✅ 푸시 알림 + 카메라 전용 플로우 |
| 하루 1회 랜덤 알림 2분 내 촬영 | 전·후면 동시, 재촬영 횟수 표시, Late 표시 | BeReal | ✅ |
| 촬영 직전 몇 초 자동 기록 (BTS) | Live Photo식 비하인드 | BeReal, Locket | ✅ 링 버퍼 녹화 |
| 지연 공개 "현상" | 랜덤 시간 후 사진 공개, 36컷 롤 제한 | Lapse, Dispo, NOMO | ✅ |
| 위젯 즉시 전송 | 촬영 즉시 친구 홈 화면 위젯 표시 | Locket | 🔧 iOS WidgetKit / Android 위젯 네이티브 |
| 루프/부메랑, 레이아웃 콜라주 | 앞뒤 반복 루프, 3·4·6컷 콜라주 | Instagram | ✅ |
| 무보정 원칙 (편집 금지 설계) | 필터·편집 불가로 진정성 강조 | setlog, BeReal, Locket | 설계 선택 |

---

## 2. 기본 편집 기능 (비생성형)

### 2.1 사진 편집

**색·광 조정**
- 노출, 대비, 하이라이트, 섀도, 화이트, 블랙, 밝기
- 화이트밸런스(색온도/틴트), 생동감, 채도
- 톤 커브(RGB·채널별·포인트), 레벨
- HSL 컬러 믹서, Point Color(특정 색 선택 조정), Color Grading(3-way/분할톤)
- 텍스처, 명료도, 디헤이즈, 샤프닝, 노이즈 감소
- 비네트, 그레인, B&W 변환, 필름 에뮬레이션(VSCO Film X: 캐릭터/웜스)
- LUT(.cube) 적용·스택, 프리셋/Looks 저장·공유, 편집 복사·붙여넣기
- 자동 보정(Enhance / Remaster / ML Enhance), HDR 편집 + HDR Limit
- Adaptive Profiles(AI가 사진별 자동 프로파일 생성, Lightroom)
- 구현: ✅ **Skia ColorMatrix + SkSL 셰이더**로 전부 가능. 12~48MP 원본은 타일/다운샘플 전략 필요

**선택·마스크**
- 선형/방사형 그라디언트, 브러시, 색상·휘도·깊이 범위 선택
- AI 자동 마스크: 피사체, 하늘, 배경, 인물(피부·머리·눈·치아·입술 부위별), 객체(브러시·사각), 풍경 요소
- 원탭 Smart Masking / Object Brush(Snapseed, 온디바이스 Interactive Segmenter)
- 마스크 교집합·차집합·반전, 마스크별 커브
- Magic Grab(피사체 분리 이동), Magic Layers(평면 이미지 → 레이어 분해, Canva)
- 구현: ✅ 피사체/인물 마스크는 iOS Vision 또는 ExecuTorch·ML Kit 세그멘테이션. 하늘·부위별 마스크는 🔧 모델 준비 필요

**리터치**
- Heal / Spot Heal / Blemish Removal, Clone Stamp
- 얼굴 리터치(피부·눈·치아·Head Pose), 뷰티파이(형태 변형), 체형 슬라이더, 잔머리 제거
- Lens Blur(AI 깊이 보케, 초점 범위·보케 형태), 인물 조명 사후 적용
- 업스케일 / Super Resolution(2~4x), 옛 사진 복원, 언픽셀레이트, Photo Unblur, Denoise
- 구현: 🔧 Heal은 PatchMatch 등 직접 구현 또는 ☁️. 얼굴 리터치는 랜드마크 + 워핑. 업스케일은 ✅ ExecuTorch/TFLite 모델

**기하·구도**
- 자르기(비율 프리셋), 회전, 스트레이튼, 원근(Perspective), Fix Angle/Upright, 렌즈 보정
- Expand(캔버스 확장, 비생성형 채움은 미러/단색)
- 구현: ✅ expo-image-manipulator + Skia

**효과·장식**
- 더블 익스포저, 프레임/보더, 비네트, Glamour Glow, Tonal Contrast, Drama, HDR Scape, Retrolux, Grunge(Snapseed 계열)
- 텍스트(폰트·외곽선·그림자·자유 배치), 스티커, GIF, 손그림, 모자이크/블러, 날짜 스탬프
- 콜라주·템플릿(진/스크랩북 스타일, 캐러셀 커버 자동 생성), 워터마크
- Spatial Scene(2D 사진 깊이 패럴랙스, iOS 26) — 🔒 iOS API 없음, 깊이 추정 모델로 🔧 유사 구현
- 구현: ✅ Skia

**Live Photo / 모션 포토 효과**
- Live/Loop/Bounce/Long Exposure, 키 포토 변경, 영상으로 저장, Best Face(프레임 간 표정 교체)
- 구현: ✅ 프레임 추출 + 합성. Best Face는 🔧 얼굴 정합

### 2.2 영상 편집

**컷 편집**
- 트림, 분할, 멀티트랙(LumaFusion 6V+6A, Premiere Mobile 무제한), PiP, 레이어(사진·스티커·텍스트)
- 속도 0.1x~100x, 스피드 커브/램프, 리버스, 프리즈 프레임, 스톱모션
- 키프레임(위치·스케일·회전·불투명도 전 속성, 커브 에디터, 애니메이션 프리셋)
- 마스크, 블렌드 모드, 크로마키, 모션/바디/장면 추적
- 스태빌라이저, Auto Reframe(종횡비 자동), Auto Cut / Scene detect, 비트 감지·스냅
- 전환(트랜지션) 라이브러리, 템플릿(재사용 가능 클립 지정 + 원작자 크레딧)
- 구현: 🔧 **ffmpeg-kit 은퇴(2025.1)** 로 인해 iOS AVFoundation(AVMutableComposition + Core Image/Metal) 및 Android Media3 Transformer를 Expo Module로 래핑하는 것이 현실적. 트림·압축은 ✅ react-native-video-trim, react-native-compressor

**색·효과(영상)**
- LUT 임포트·스택, Log → LUT 변환(Correct Color), Dolby Vision HDR 편집, 실시간 스코프(파형/벡터)
- 필터, 글리치/VHS/필름 효과, 블러, Infinite Zoom
- 영상 배경 제거(그린스크린 불필요), Magic Mask(브러시·추적)
- 구현: ✅ Skia 프레임 단위 렌더 → 재인코딩 🔧

**오디오**
- 멀티 오디오 트랙, 보이스오버 녹음, 파형 표시, 더킹, 페이드
- 음악 라이브러리(상업용 라이선스), 효과음 200+, 비트 싱크, 분위기(vibe) 검색
- Enhance Speech / 노이즈 제거 / 바람 소리 제거, Vocal Separator, 라우드니스 매칭
- Audio Eraser(음성·음악·군중·자연·소음·바람 6종 분리 제거, Galaxy) — 🔒. Demucs류 모델 🔧 또는 ☁️
- TTS(다국어 음성), 보이스 클론, Voice Changer/음성 효과, 음성 스티커
- 구현: ✅ expo-audio 녹음/재생. 소스 분리·TTS는 🔧/☁️

**텍스트·자막**
- 자동 자막(ASR) + 자동 번역(15개 언어 이중 자막), 단어별 하이라이트/Dynamic Captions, 자막 스타일 템플릿
- 텍스트 키프레임 애니메이션, 폰트 가져오기(Adobe Fonts), AI 폰트 스타일링
- 음성 입력 캡션, 텔레프롬프터
- 구현: ✅ 온디바이스 STT(ExecuTorch Whisper) 또는 ☁️. 번역은 ☁️ 또는 iOS Translation API

**내보내기**
- 해상도(최대 4K), FPS(최대 60), 비트레이트, 코덱(H.264/HEVC) 선택, HDR(HLG/Dolby Vision) 출력
- JPEG/PNG/HEIF/TIFF/DNG/WebP, 품질·크기 지정
- 워터마크·테두리 일괄, 배치 내보내기, 백그라운드 내보내기
- 비파괴 편집(원본 보존·되돌리기, iOS PHAdjustmentData), 버전 관리, 클라우드 동기화
- 원탭 소셜 공유(릴스/쇼츠/틱톡), 데스크톱 핸드오프(FCPXML, Premiere)
- AI 생성물 표기(SynthID, C2PA Content Credentials, 워터마크, 메타데이터)
- 구현: ✅ 대부분. HDR 영상 인코딩은 🔧

---

## 3. AI 편집 기능

### 3.1 Galaxy AI (One UI 7 → 8.5 → 9.0)

| 기능 | 설명 | 서드파티 접근 | 대체 경로 |
|---|---|---|---|
| 생성형 편집 (Generative Edit / Photo Assist) | 객체 이동·삭제·크기 조정·각도 보정 후 배경 생성, 워터마크 | 🔒 | ☁️ Gemini 3.1 Flash Image / Stability Inpaint / FLUX Fill |
| 텍스트 프롬프트 편집 | "낮을 밤으로", 옷 색 변경, 얼룩 제거 등 문장 지시 (One UI 8.5), 음성 지시(One UI 9 보고) | 🔒 | ☁️ Gemini 이미지 편집 |
| 연속 생성·편집 기록 | 저장 없이 변형 반복, 기록에서 선택·되돌리기 | 🔒 | 자체 히스토리 UI ✅ |
| 객체 전송 (Object Transfer) | 한 사진의 인물·물체를 다른 사진으로 옮겨 합성 | 🔒 | ✅ 피사체 마스크 + ☁️ 다중 이미지 합성 |
| 삭제 제안 (Suggest Erases) | 행인 자동 감지 원탭 제거 | 🔒 | ✅ 인물 탐지 + ☁️ 인페인팅 |
| 객체/반사/그림자 지우개 | 선택 영역·유리 반사·그림자 제거 | 🔒 | ☁️ Erase API, 🔧 온디바이스 LaMa류 |
| 리마스터 (Remaster) | 선명도·노이즈 개선, 고배율 줌 사진 12MP 복원 | 🔒 | ✅ Real-ESRGAN·GFPGAN 온디바이스/☁️ |
| 편집 제안 (Suggested Edits) | 배경 흐림·Live effect·Remaster 원탭 추천 | 🔒 | ✅ 자체 휴리스틱 + Vision 분석 |
| 라이브 효과 (Live effect) | 정지 사진에 줌·팬·회전 모션 영상화 | 🔒 | ✅ Skia 애니메이션 렌더 |
| 스타일 (Styles) | 사진 전체·얼굴 전용 9종 스타일 변환 | 🔒 | ✅ ExecuTorch Style Transfer / ☁️ |
| 인물 스튜디오 (Portrait Studio) | 셀피·반려동물을 3D 카툰·코믹·스케치·수채화로 | 🔒 | ☁️ |
| 스케치 변환 (Sketch to Image) | 그린 도형을 사실적 객체로 생성·합성, 텍스트·음성 입력 | 🔒 | ☁️ ControlNet 계열(Replicate) |
| 드로잉 어시스트 (Drawing Assist) | 6스타일 생성형 드로잉 | 🔒 | ☁️ |
| 베스트 페이스 (Best Face) | 모션 포토 프레임에서 인물별 표정 교체 | 🔒 | 🔧 얼굴 정합 합성 |
| AI 셀렉트 (AI Select) + Rewind | 화면 분석 후 추출·검색·스티커 제안, 영상 놓친 장면 선택 | 🔒 | ✅ 피사체 리프트 + ☁️ 검색 |
| 크리에이티브 스튜디오 | 스케치·사진·프롬프트로 스티커·초대장·배경화면·프로필 생성 | 🔒 | ☁️ |
| 갤러리 자연어 검색 | 문장으로 사진 검색 | 🔒 | ✅ CLIP 임베딩(ExecuTorch) |
| 오디오 지우개 (Audio Eraser) | 6종 소리 분리 제거, 온디바이스 | 🔒 | 🔧 Demucs/Spleeter 모델, ☁️ |
| 인스턴트 슬로모 (Instant Slow-mo) | AI 프레임 보간 슬로모션 | 🔒 | 🔧 RIFE/FILM 프레임 보간 모델 |
| 자동 트림 (Auto Trim) | 최대 90분 영상에서 핵심 장면 숏폼 자동 생성 | 🔒 | 🔧 장면 감지 + 미학 점수 + ☁️ LLM 선별 |
| My FanCam (One UI 9) | 선택 인물 추적 자동 리프레임, 비율 선택 | 🔒 | ✅ 인물 추적 + 크롭 렌더 |
| Log 색 보정 (Correct Color) | Log 영상 LUT 적용·미리보기 | 🔒 | ✅ Skia LUT |

참고: Samsung Camera SDK는 2019년 지원 중단. CameraX Extensions(Night/HDR/Bokeh/Face Retouch)는 정지 사진 프리뷰·캡처만 가능하고 기기별 지원 상이. Android 17 벤더 정의 확장은 삼성 채택 선언 없음.

### 3.2 Apple Intelligence / Photos (iOS 18 → 26 → 27)

| 기능 | 설명 | 서드파티 접근 | 대체 경로 |
|---|---|---|---|
| 클린업 (Clean Up) | 방해 요소 제거. iOS 27에서 생성형 인페인팅 강화(Fast 온디바이스 / High Quality PCC) | 🔒 | ☁️ 인페인팅 |
| Extend (확장) | 가장자리 바깥 생성, 수평 보정 후 빈 영역 채움 | 🔒 | ☁️ Outpaint |
| Reframe / Spatial Reframing | 촬영 후 시점·구도 변경, 바뀐 영역만 생성 | 🔒 | ☁️ 제한적 |
| Spatial Scenes | 2D 사진 깊이 패럴랙스 | 🔒 iOS API 없음(visionOS 전용) | 🔧 깊이 추정 + 패럴랙스 렌더 |
| Image Playground | 애니메이션·일러스트·스케치, ChatGPT 스타일, iOS 27 포토리얼+자연어 수정 | ✅ `imagePlaygroundSheet`(UI 시트만, 헤드리스 ImageCreator deprecated) | — |
| Genmoji | 이모지 생성·믹싱 | ✅ NSAdaptiveImageGlyph 렌더 | — |
| Image Wand | 스케치·빈 공간을 이미지로 | 🔒 | ☁️ |
| Visual Intelligence / Siri 카메라 모드 | 대상 식별·질문·검색 | 🔒 호출 불가(App Intents로 결과 제공자만 참여) | Foundation Models 이미지 입력(iOS 27) ✅ / ☁️ |
| 메모리 무비 생성 | 텍스트 설명으로 스토리·음악 자동 | 🔒 | 🔧 자체 + ☁️ LLM |
| 자연어 사진 검색 | 영상 내 순간까지 검색 | 🔒 | ✅ CLIP 임베딩 |
| 포토그래픽 스타일 촬영 후 변경 | 톤·색 재조정 | 🔒 | ✅ Skia LUT |
| 시네마틱 영상 초점 편집 | 피사체 탭으로 초점 변경, 심도 조절 | ✅ Cinematic 프레임워크 | — |
| Audio Mix 사후 편집 | 음성 강조 3모드 | ✅ Cinematic + AUAudioMix | — |
| 피사체 들어올리기 (Lift subject) | 길게 눌러 배경 분리 스티커 | ✅ Vision ForegroundInstanceMask / VisionKit | — |
| Visual Look Up / Live Text | 식물·반려동물·랜드마크 식별, 텍스트 인식 | ✅ VisionKit ImageAnalysisInteraction | — |
| 인물 조명 편집 | 6종 조명 사후 적용 | 🔒 렌더러 비공개 | 🔧 세그멘테이션 매트 + 릴라이팅 |
| Writing Tools | 캡션 교정·재작성·요약 | ✅ UITextView 자동 노출 | — |
| Foundation Models | 온디바이스 3B LLM, iOS 27 이미지 입력, PCC 대형 모델 | ✅ Expo Module / @react-native-ai/apple | 캡션 생성·편집 명령 해석에 활용 |
| AI 편집 Content Credentials | iOS 27이 AI 편집 메타데이터 기록 | 🔒 | 🔧 C2PA 자체 삽입 |

### 3.3 Google Photos / Pixel

| 기능 | 설명 | 접근 | 대체 |
|---|---|---|---|
| Magic Editor / Magic Eraser | 객체 제거·이동·배경 교체·조명 | 🔒 | ☁️ |
| Reimagine | 선택 영역 프롬프트 생성 교체 | 🔒 | ☁️ Gemini 이미지 편집 |
| Auto Frame | AI 리프레이밍 + 생성 확장 | 🔒 | ✅ 미학 점수 크롭 + ☁️ Outpaint |
| Add Me | 촬영자 합성 단체사진 | 🔒 | 🔧 |
| Best Take / Auto Best Take | 최대 150프레임에서 표정 합성 | 🔒 | 🔧 |
| Help me edit / Ask Photos | 자연어 편집("선글라스 제거", "눈 뜨게") | 🔒 | ☁️ Gemini |
| Nano Banana Restyle / Remix | 르네상스 초상·애니·스케치·3D 스타일 | 🔒 | ☁️ Gemini 3.1 Flash Image |
| Photo to video (Veo) | 사진 → 6초 영상 | 🔒 | ☁️ Veo API / Replicate |
| Photo Unblur, Ultra HDR, Portrait Light | 복원·HDR·조명 | 🔒 | ✅/🔧 |
| Cinematic photos, Highlight videos, 콜라주 | 자동 생성 | 🔒 | 🔧 |
| ML Kit Subject Segmentation | 피사체 마스크(Android 베타) | ✅ | — |
| ML Kit GenAI (Gemini Nano) | 이미지 설명·요약·Prompt API(텍스트 출력만) | ✅ Pixel 9/10, S25 등 제한 | — |

### 3.4 전문 편집 앱의 AI 기능

- **생성형 제거·채움**: Generative Remove(Lightroom), Distraction Removal(People/Reflections), Content-Aware Fill, Generative Fill/Expand(Photoshop Mobile, Firefly), Cleanup/AI Replace/AI Expand(Picsart), VSCO AI Lab Remove(RAW 해상도 유지), Magic Eraser/Edit/Expand(Canva)
- **AI 마스크**: Lightroom(피사체·하늘·배경·인물 부위·객체·풍경 요소), Darkroom Smart Mask(4K 영상에도), Snapseed Smart Masking, DaVinci Magic Mask v2
- **자연어 편집**: Lightroom Prompt to Edit(2026.9, 크레딧), Remini Textual Editing
- **AI 보케**: Lightroom Lens Blur(초점 범위·보케 형태)
- **복원·업스케일**: Remini, Picsart AI Enhance(4x), Photomator ML Super Resolution, DaVinci SuperScale, KineMaster AI Upscaling, Lightroom Denoise
- **아바타·프로필**: Lensa Magic Avatars, Picsart AI Avatar, SNOW AI 프로필, EPIK AI 이어북, Snapchat Dreams, Remini AI Photos
- **스타일 변환**: Videoleap AI Effects, KineMaster AI Style, CapCut AI 효과, Meitu AI 아트
- **영상 생성**: Lightroom Photo to Video, Premiere Mobile Image-to-Video, CapCut Image-to-Video, Picsart Image-to-Video
- **오디오 AI**: Premiere Generative Sound Effects, Filmora AI Music/SFX 생성, KineMaster AI Music Match·Vocal Separator·Noise Removal, CapCut 보이스 클론·TTS·Lip Sync(13개 언어)
- **자막·스크립트**: CapCut Auto Captions+번역, DaVinci IntelliScript(스크립트→타임라인)·AI 애니메이션 자막, Filmora Dynamic Captions, Premiere Enhance Speech
- **자동 편집**: CapCut Auto Cut·Auto Reframe(Pro), Filmora AI Auto Cut, Instagram First Draft·Magic Cut, TikTok Smart Split
- **기타**: Face Swap(Meitu), Talking Photo/AI 아바타 토킹헤드(CapCut), AI Copilot(Filmora), Edits assistant(성과 기반 콘셉트 제안)
- **과금**: 대부분 크레딧제(Firefly, CapCut Pro, Picsart). 2K/4K 생성 결과 크레딧 차등

### 3.5 소셜 플랫폼의 AI 기능

- Instagram/Edits: Restyle(프롬프트 스타일 변환), Muse Image AI 효과, AI 클립 생성, 사진·영상 블렌딩, AI Extend, AI 가사 생성, Reels AI 번역·더빙, Before/After 스티커
- TikTok: AI Alive(사진→영상), Smart Split(장편→숏폼 자동 클립·리프레임·자막), AI Outline(제목·해시태그·훅), AI transitions, Tako Restyle, "Create with AI" 효과 제작, AI Pick for Me
- Snapchat: Imagine Lens(프롬프트 이미지 생성·수정), AI Clips(사진→5초 영상), Dreams, 비디오 생성 렌즈
- SNOW 계열: AI 프로필, AI 이어북, AI 헤어 컨설팅, Auto Beauty, 부분 지우개
- 공통: AI 생성물 라벨·워터마크·메타데이터, AI 리믹스 허용 프라이버시 설정

### 3.6 교차 비교: 핵심 AI 편집 기능과 구현 경로

| 기능 | Galaxy | iPhone | Google | 전문 앱 | 서드파티 구현 경로 |
|---|---|---|---|---|---|
| 객체 제거 | Generative Edit, Object Eraser | Clean Up | Magic Eraser | Lightroom, Picsart, VSCO | ☁️ Stability Erase(≈$0.05) / Gemini / FLUX Fill. 🔧 온디바이스 LaMa |
| 생성 확장 | — | Extend | Auto Frame | Lightroom Generative Expand, Photoshop | ☁️ Outpaint |
| 자연어 편집 | 텍스트 프롬프트 편집 | (iOS 27 테스트) | Help me edit | Lightroom Prompt to Edit | ☁️ Gemini 3.1 Flash Image($0.067/장) |
| 배경 제거·교체 | Portrait Studio 등 | Lift subject | Magic Editor | Picsart, Canva | ✅ Vision/ML Kit 마스크 + ☁️ 배경 생성 |
| 스타일 변환 | Styles, Portrait Studio | Image Playground | Remix, Nano Banana | Videoleap, Meitu | ✅ ExecuTorch Style Transfer / ☁️ |
| 사진→영상 | Live effect | — | Photo to video | Lightroom, CapCut | ☁️ Veo / Replicate |
| 리마스터·업스케일 | Remaster | Enhance | Photo Unblur | Remini, Picsart | ✅ Real-ESRGAN 온디바이스 |
| 오디오 분리 | Audio Eraser | Audio Mix | Audio Magic Eraser | KineMaster Vocal Separator | ✅ iOS Audio Mix(음성만), 🔧 Demucs |
| 슬로모 보간 | Instant Slow-mo | 4K120 속도 변경 | — | CapCut | 🔧 RIFE 모델 |
| 자동 숏폼 | Auto Trim, My FanCam | — | Highlight videos | TikTok Smart Split, Instagram First Draft | 🔧 장면 감지 + 추적 + LLM |
| 단체사진 합성 | Best Face | — | Add Me, Best Take | Meitu | 🔧 |
| 자연어 검색 | Gallery 검색 | Photos 검색 | Ask Photos | — | ✅ CLIP 임베딩 |
| 아바타·프로필 | Portrait Studio | Image Playground | — | SNOW, Lensa, EPIK | ☁️ |

---

## 4. 공유·소셜 기능

### 4.1 setlog 상세 (2025년 말 iOS, 2026-04 Android)

- 매시간(또는 3시간/끔) 알림 → 그 자리에서 2~3초 영상 + 짧은 캡션. 갤러리 업로드·재촬영·필터 불가. 전/후면 전환과 3초 타이머만 제공
- 하루 클립을 시간순 자동 병합 → 25초 이하 데일리 브이로그. 그룹원 동시간대 클립은 2·4·6분할 화면 자동 합성
- 공개 피드 없음. 초대 코드 기반 비공개 "로그"(기본 4명, 최대 12명). 이모지 반응·댓글·간단 채팅
- 분할화면 영상 내보내기 → 릴스/틱톡/쇼츠 재공유
- 2026-04 한국 App Store 1위, 5월 MAU 778만 추정, 20대 45%·여성 76%
- 불만: 저장 공간, 알림 놓치면 복구 불가, 또래 압박

### 4.2 교차 앱 공유 기능 목록

| 기능 | 출처 | 구현 |
|---|---|---|
| 소규모 비공개 그룹(≤12~20명) | setlog, BeReal RealGroups, Retro Journals, Locket, Instagram Close Friends | ✅ 백엔드 |
| 일일/시간별 프롬프트·알림 참여 | setlog, BeReal, Locket, Day One | ✅ 푸시 |
| 분할화면·콜라주 자동 생성 | setlog, Instagram Layout, TikTok Collage | ✅ 서버 또는 클라이언트 합성 |
| 자동 리캡(일/주/월/연) | setlog 데일리 브이로그, Locket 월말 리캡, BeReal Recap, Retro Rewind, Google Memories | ✅ |
| 소멸형 공유(24h) | Instagram Stories, Threads Ghost posts, Snapchat | ✅ |
| 반응 양식 | 이모지(setlog, Locket), 셀카 반응 RealMoji(BeReal), 스토리 공개 댓글, 리포스트 노트 | ✅ |
| 홈 화면 위젯 노출 | Locket, Retro | 🔧 네이티브 위젯 |
| 외부 재공유 내보내기 | setlog→릴스, Edits→Stories | ✅ 공유 시트 |
| 음악 첨부·Add Yours 음악 이어 붙이기 | Instagram, TikTok, BeReal Spotify | ✅ 라이선스 필요 |
| 템플릿 공유·크레딧 | Instagram/Edits, CapCut, Lemon8 | ✅ |
| 스크린샷 방지, 조회 확인, 보내기 취소 | Instagram, Locket | 🔧 iOS 제한적 |
| 공유 앨범(원본 해상도, 만료, 반응) | iOS 27 iCloud 공유 앨범, Google Photos | ✅ |
| 스트릭·출석·챌린지 | setlog, Snapchat Streaks | ✅ |
| 프리미엄 구독으로 기능 해제 | Instagram Plus, Snapchat+, Locket Gold, SNOW/EPIK 크레딧 | ✅ RevenueCat 등 |
| AI 생성물 라벨·메타데이터 | TikTok, Instagram, Google SynthID, iOS 27 | 🔧 C2PA |

---

## 5. React Native + Expo 구현 스택 (2026-10 기준)

### 5.1 권장 라이브러리

| 영역 | 선택 | 비고 |
|---|---|---|
| 카메라 | **react-native-vision-camera v5** (Nitro, New Arch 필수) | RAW/ProRAW, Apple Log, HDR, 수동 노출·초점·WB, 프레임 프로세서, 멀티캠, 깊이, Constraints API로 fps 협상. ProRes 미지원 |
| 카메라 실시간 효과 | react-native-vision-camera-skia + GPU Resizer | 셰이더 프리뷰, YUV→RGB 5배 빠른 리사이즈 |
| 간단 캡처 폴백 | expo-camera 57 | RAW·수동·fps·프레임 접근 없음. 프로 카메라에는 부적합 |
| 사진 편집 렌더 | **@shopify/react-native-skia 2.x** | ColorMatrix, SkSL RuntimeShader(커브·HSL·LUT·그레인), Blur, Path 브러시 마스크, 오프스크린 서피스. gl-react·image-filter-kit은 미유지 |
| 기하 변환·포맷 | expo-image-manipulator(객체형 API) | resize/crop/rotate/flip + JPEG/PNG/WebP 압축 |
| 영상 트림·압축 | react-native-video-trim 8.x, react-native-compressor 2.x | 프레임 정확 컷, 백그라운드 업로드 |
| 영상 합성·효과 | 🔧 Expo Module: iOS AVMutableComposition + AVVideoComposition(Core Image/Metal), Android Media3 Transformer/Effects | ffmpeg-kit은 2025.1 은퇴, 2026.7 아카이브. FFmpegKitNext는 소스 전용 |
| 재생 | expo-video, expo-audio | expo-av는 SDK 55에서 제거 |
| 미디어 라이브러리 | expo-media-library (+ /next 실험 API) | Android 14 부분 접근, iOS 제한 라이브러리 대응 |
| 온디바이스 ML | react-native-executorch 0.8(셀피/시맨틱/인스턴스 세그멘테이션, CLIP, OCR, Style Transfer, Whisper), react-native-fast-tflite | VisionCamera 프레임 프로세서 연동 |
| ML Kit | @infinitered/react-native-mlkit, @react-native-ml-kit/*, react-native-vision-camera-mlkit | 얼굴 탐지, 셀피 세그멘테이션, 문서 스캐너, Subject Segmentation(Android 베타) |
| iOS 전용 네이티브 | Expo Modules(Swift): Vision 피사체 리프트·인물 분할·미학 점수·얼룩 감지, Cinematic 프레임워크, Audio Mix, PhotoKit 비파괴 편집, Image Playground 시트, Foundation Models | 공식 RN 바인딩 없음. @react-native-ai/apple, react-native-image-playground 커뮤니티 |
| 클라우드 생성 편집 | Gemini 3.1 Flash Image($0.067/1K장), Gemini 3 Pro Image($0.134), Stability(Erase/Inpaint 5크레딧≈$0.05), Replicate/fal(FLUX Kontext $0.04~0.08, SAM2, BiRefNet, GFPGAN, Real-ESRGAN), remove.bg | gemini-2.5-flash-image는 2026-10-02 종료 |
| 빌드 | EAS Build | Linux 환경에서 iOS 빌드·TestFlight 제출 |

### 5.2 Expo 사용 시 주의

- VisionCamera v5, Skia, ExecuTorch, 네이티브 Expo Module은 모두 **Expo Go 불가**. 개발 빌드(expo-dev-client) 필수
- New Architecture 필수. SDK 57 권장(56은 Hermes V1 메모리 회귀 이슈)
- 12~48MP 원본 Skia 처리 시 GPU 텍스처 한계 → 편집 중 다운샘플, 저장 시 타일 렌더
- Galaxy AI·Apple Intelligence·Pixel 편집 기능은 **전부 서드파티 호출 불가**. 유사 기능은 "온디바이스 마스크 + 클라우드 생성" 조합으로 구현하고 크레딧 과금 모델을 전제

### 5.3 기능 우선순위 제안 (MVP → 확장)

1. **MVP**: VisionCamera 기본 촬영(사진/영상/전후면/줌/플래시/타이머), 필름 필터 실시간 프리뷰, Skia 기본 보정(노출·대비·WB·HSL·커브·LUT), 크롭/회전, 텍스트·스티커, 영상 트림·속도·음악, 소셜 공유 시트
2. **2단계**: RAW·Log·HDR·수동 모드, 피사체/인물 마스크 기반 선택 보정과 배경 흐림, 자동 자막(Whisper), 업스케일·노이즈 제거, 시간 제약 촬영·그룹 공유(setlog형) 또는 듀얼 캡처(BeReal형)
3. **3단계(클라우드 AI)**: 객체 제거, 생성 확장, 자연어 편집, 스타일 변환, 배경 교체, 사진→영상, AI 프로필. 크레딧 과금 + SynthID/C2PA 표기
4. **차별화 후보**: 자동 숏폼(장면 감지 + 인물 추적 리프레임), 오디오 소스 분리, 프레임 보간 슬로모, 멀티캠 동기 녹화

---

## 6. 출처

### Galaxy
- https://news.samsung.com/global/samsung-unveils-galaxy-s26-series-the-most-intuitive-galaxy-ai-phone-yet
- https://samsungmobilepress.com/articles/samsung-galaxy-z-fold7-raising-the-bar-for-smartphones
- https://www.samsung.com/us/support/answer/ANS10004601
- https://www.samsung.com/us/support/answer/ANS10006885/
- https://www.samsung.com/ca/support/mobile-devices/intelligent-photo-editing-on-your-samsung-galaxy/
- https://news.samsung.com/us/how-to-use-the-latest-galaxy-ai-features-on-one-ui-8
- https://www.sammobile.com/news/one-ui-8-5-changing-access-night-other-camera-modes/
- https://www.sammobile.com/news/four-hidden-galaxy-s26-ultra-camera-improvements/
- https://www.sammobile.com/news/samsung-camera-assistant-one-ui-8-5-new-features/
- https://www.sammobile.com/news/one-ui-9-samsung-galaxy-s26-plus-ultra-changes-features/
- https://www.androidcentral.com/phones/samsung-galaxy/the-galaxy-s26-gets-samsungs-clever-new-video-tool-in-one-ui-9-beta
- https://www.androidauthority.com/samsung-galaxy-s26-ultra-virtual-reflector-3649629
- https://www.androidsage.com/2025/12/04/samsung-one-ui-8-5-full-changelog-list-eligible-devices/
- https://www.tomsguide.com/phones/samsung-phones/how-galaxy-ai-takes-the-samsung-galaxy-s25-camera-to-the-next-level
- https://forum.developer.samsung.com/t/samsung-camera-sdk-issue/1343
- https://developer.android.com/media/camera/camerax/extensions-api
- https://android.gadgethacks.com/news/android-17-camera-features-in-every-app-how-vendor-extensions-work/

### iPhone / Apple
- https://www.apple.com/newsroom/2025/09/apple-debuts-iphone-17/
- https://www.apple.com/newsroom/2025/09/apple-unveils-iphone-17-pro-and-iphone-17-pro-max/
- https://www.apple.com/iphone-18-pro/
- https://www.macrumors.com/guide/ios-26-photos-app/
- https://macrumors.com/guide/ios-26-camera-app
- https://9to5mac.com/2026/06/16/heres-everything-new-for-apple-photos-in-ios-27/
- https://9to5mac.com/2026/09/15/ios-27-gives-camera-app-on-iphone-three-powerful-new-features/
- https://appleinsider.com/articles/26/08/19/whats-new-with-the-camera-app-in-ios-27-siri-mode-enhanced-controls-more
- https://support.apple.com/en-gb/guide/iphone/xy0grrlxue5w/27/ios/27
- https://developer.apple.com/videos/play/wwdc2026/375/ (Image Playground API)
- https://developer.apple.com/videos/play/wwdc2026/341/ (Center Stage 전면 카메라 API)
- https://developer.apple.com/videos/play/wwdc2025/319/ (Cinematic 영상 캡처 API)
- https://developer.apple.com/videos/play/wwdc2025/251/ (공간 오디오/Audio Mix)
- https://developer.apple.com/videos/play/wwdc2025/253/ (Camera Control)
- https://developer.apple.com/videos/play/wwdc2025/272/ (Vision 문서 인식/얼룩 감지)
- https://developer.apple.com/documentation/cinematic/editing-spatial-audio-with-an-audio-mix
- https://developer.apple.com/forums/thread/831722 (Spatial Scene API iOS 미제공)
- https://www.callstack.com/blog/on-device-ai-after-wwdc-2026-whats-new
- https://github.com/Ucekay/react-native-image-playground

### 일상 공유 플랫폼
- setlog: https://www.koreaherald.com/article/10722194 · https://www.newsis.com/view/NISX20260605_0003657349 · https://geekculture.co/app-of-the-month-setlog-jun-2026/ · https://apps.apple.com/app/id6587576438
- Instagram/Edits: https://embedsocial.com/blog/new-instagram-features-2026/ · https://about.instagram.com/blog/announcements/new-stickers-for-stories · https://www.socialmediatoday.com/news/meta-adds-ai-video-restyling-instagram-edits-ai-app/750487/
- TikTok: https://newsroom.tiktok.com/introducing-tiktok-ai-alive?lang=en · https://newsroom.tiktok.com/new-ai-powered-tools-to-make-it-easier-to-create-and-share-on-tiktok?lang=en
- BeReal: https://bereal.com/news · https://www.lindseygamble.com/blog/bereal-introduces-friends-of-friends-feed-and-other-new-features
- Locket: https://apps.apple.com/us/app/1600525061
- Snapchat: https://techcrunch.com/2026/03/24/snapchats-new-ai-clips-lens-format-turns-photos-into-five-second-videos/ · https://newsroom.snap.com/ai-clips-in-lens-studio
- SNOW/EPIK: https://play.google.com/store/apps/details?id=com.campmobile.snow · https://play.google.com/store/apps/details?id=com.snowcorp.epik
- Google Photos: https://blog.google/products/photos/photo-to-video-remix-create-tab · https://blog.google/products/photos/nano-banana-ai-templates-ask-photos/ · https://blog.google/products-and-platforms/devices/pixel/pixel-group-photo-features-ai/
- Retro: https://techcrunch.com/2024/04/04/retro-an-actually-good-photo-sharing-app-for-bffs-launches-collaborative-journals/

### 전문 편집 앱
- https://helpx.adobe.com/lightroom/mobile/whats-new/adobe-lightroom-on-mobile-release-notes.html
- https://www.lightroomqueen.com/whats-new-in-lightroom-2026-09/
- https://9to5google.com/2025/06/12/snapseed-3-0-update-iphone/
- https://www.provideocoalition.com/google-launches-snapseed-4-0-for-android/
- https://news.adobe.com/news/2025/02/photoshop-mobile-web
- https://picsart.com/ai-tools/
- https://petapixel.com/2025/10/15/vsco-launches-ai-lab-to-help-photographers-save-time/
- https://darkroom.co/masks
- https://www.capcut.com/help/why-do-i-have-to-pay-for-auto-reframe
- https://fcp.cafe/news/20260122.md (LumaFusion 5.4.1)
- https://www.provideocoalition.com/davinci-resolve-20-released/
- https://www.newsshooter.com/2025/09/04/adobe-premiere-comes-to-iphone/
- https://androidauthority.com/adobe-premiere-android-launch-official-3713985

### RN / Expo 라이브러리
- https://docs.expo.dev/versions/latest/sdk/camera/
- https://expo.dev/changelog/sdk-55 · https://expo.dev/changelog/sdk-56
- https://docs.expo.dev/versions/latest/sdk/imagemanipulator
- https://margelo.com/blog/whats-new-in-visioncamera-v5
- https://shopify.github.io/react-native-skia/
- https://github.com/arthenica/ffmpeg-kit · https://github.com/arthenica/ffmpeg-kit-next
- https://tanersener.medium.com/saying-goodbye-to-ffmpegkit-33ae939767e1
- https://github.com/numandev1/react-native-compressor
- https://rec.swmansion.com/blog/react-native-executorch-v0.8.0-a-library-milestone
- https://docs.swmansion.com/react-native-executorch/docs/hooks/computer-vision/visioncamera-integration
- https://github.com/mrousavy/react-native-fast-tflite
- https://docs.infinite.red/react-native-mlkit/
- https://developers.google.com/ml-kit/genai · https://developers.google.com/ml-kit/vision/subject-segmentation
- https://ai.google.dev/gemini-api/docs/pricing
- https://stability.ai/api-pricing-update-25

### 신뢰도 메모
- Galaxy HDR10+ 녹화·8K 30fps는 소매점 스펙 기준. Gallery 영상 업스케일/HDR 리마스터는 확인되지 않음
- iOS 27 자연어 편집 명령, Content Credentials 세부, ProRes RAW/젠록의 AVFoundation 심볼명은 공개 자료에서 미확인
- Instagram/Edits 월별 항목은 2차 집계이며 일부 테스트 단계. Xiaohongshu 인앱 편집기·Ulike 세부는 공식 문서 미확인
- Premiere Mobile의 Generative Extend는 모바일 탑재 미확인(데스크톱 기능)
