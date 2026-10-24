# 사진·영상 촬영 및 AI 편집 앱 기능 조사

> 조사 기준일: **2026-10-12, 한국 시간**  
> 목적: 앱 안에서 사진·영상을 촬영하고 편집한 뒤, 개인 기록이나 친구들과의 일상 공유까지 이어지는 모바일 앱의 기능 후보를 정리한다.  
> 범위: Android/Galaxy와 iPhone, 일상 공유 앱, 모바일 편집 앱, 데스크톱 전문 편집 도구. 공식 제품 설명·지원 문서·개발자 문서를 우선 확인했다.

## 1. 기획 방향과 조사 결과

구현 가능한 방향은 **촬영 → 간편 편집 → AI 보정 → 기록·공유**를 하나의 앱으로 연결하는 것이다. 다만 갤럭시 갤러리나 Apple 사진 앱에 있는 기능을 그대로 호출할 수 있다고 가정하면 안 된다. 제품에서 제공하는 기능과 외부 개발자에게 공개한 API는 별도로 확인해야 한다.

이 문서는 두 가지를 구분한다.

- **확인된 기능**: 공식 설명에서 실제 제품의 지원을 확인한 기능. 출처 링크를 붙였다. 실제 기기에서 앱을 설치해 테스트한 결과는 아니다.
- **우리 앱의 기능 후보**: 확인된 사례에서 도출한 기능과 독자적인 설계 제안. 구현 경로와 우선순위는 기획 판단이며, 해당 앱의 SDK 제공이나 동일한 결과 품질을 뜻하지 않는다.

초기 사용자는 일반적인 일상 기록 사용자로 가정한다. 따라서 처음부터 전문가용 편집기를 모두 구현하기보다, 짧은 촬영·기본 보정·클립 연결·자동 자막·하루 영상 만들기를 우선 검토한다. 전문 촬영과 정교한 편집은 확장 기능으로 배치한다. 이것은 조사 결과에 따른 제안이며 확정 요구사항은 아니다.

### 문서 읽는 법

| 표시 | 의미 |
| --- | --- |
| P0 | 첫 제품에서 우선 검토할 핵심 기능 |
| P1 | 핵심 흐름을 검증한 뒤 추가할 기능 |
| P2 | 고급 사용자용 또는 연구·실증 후 도입할 기능 |
| 기본 | 앱 UI·이미지 처리·미디어 편집으로 구현할 후보 |
| 기기 | OS API와 카메라·코덱·센서 지원 여부를 확인해야 하는 후보 |
| AI | 자체 모델, 공개 ML API 또는 계약한 외부 AI API가 필요한 후보 |
| 서버 | 계정·저장·동기화·공유 등을 위한 백엔드가 필요한 후보 |
| 연동 확인 | 제조사·서비스의 해당 기능을 직접 호출할 공개 API를 이번 조사에서 확인하지 못함 |

P0도 모두 동시에 개발해야 한다는 뜻은 아니다. 최소 출시 묶음은 9절에서 별도로 제안한다. 표 안의 기능 설명은 독립적인 요구사항 후보로 다시 작성했으며, 특정 제품의 화면이나 필터를 그대로 복제한다는 의미가 아니다.

## 2. 제품별 벤치마킹 요약

### 2.1 기본 카메라와 일상 기록·공유

| 제품 | 공식 자료에서 확인한 특징 | 우리 앱에 참고할 점 | 출처 |
| --- | --- | --- | --- |
| Galaxy 카메라 | Pro/Pro Video, 파노라마, Single Take 등 촬영 모드. 지원은 모델별로 다름 | 간편 촬영과 전문가 설정 분리 | [S01] |
| iPhone 카메라·AVFoundation | 정지 사진·Live Photos·RAW/ProRAW, 지원 기기의 복수 카메라 캡처 | 촬영 형식과 기기 지원을 먼저 조회 | [S02], [S03], [S04] |
| Halide | 수동 노출·초점, RAW 중심 촬영, 포커스 피킹·확대 초점 보조 | 전문가용 사진 촬영 화면 | [S05] |
| Blackmagic Camera | ISO·셔터·화이트밸런스·프레임레이트, 히스토그램·오디오 레벨 등 | 전문가용 영상 촬영 및 촬영 상태 표시 | [S06] |
| Setlog | 2초 영상 기록, 친구 그룹 공유, 주기 알림, 하루 영상 자동 구성 | 촬영 부담을 낮추는 짧은 기록과 공동 브이로그 | [S07], [S08] |
| BeReal | 일일 알림과 촬영 시간창, 전후면 기록, 지연 게시 표시, RealMoji 반응, 개인 Memories | 같은 순간을 공유하는 경험과 개인 회고 | [S09], [S10], [S11] |
| Locket | 친구가 보낸 사진을 홈 화면 위젯에서 보기, 공유 기록 보관 | 앱 밖에서도 자연스럽게 이어지는 친밀한 공유 | [S12], [S13] |
| 1 Second Everyday | 날짜별 짧은 기록을 이어 붙이는 영상 일기, Journal/Freestyle/Collab 프로젝트 | 하루·월·연 단위 회고 영상과 협업 기록 | [S14], [S15] |

### 2.2 사진·영상 편집

| 제품 | 공식 자료에서 확인한 특징 | 우리 앱에 참고할 점 | 출처 |
| --- | --- | --- | --- |
| Samsung Gallery / Galaxy AI | 객체 제거·이동, 생성형 채우기, 신형 Photo Assist의 문장·참조 이미지 편집, 스타일 변경, 영상 오디오 제거·슬로모션 | 촬영 직후 한두 번의 조작으로 수정 | [S16] |
| Apple 사진 / Apple Intelligence | Clean Up, iOS 27의 Extend·Reframe | 방해물 제거·배경 확장·촬영 시점 변경 | [S17], [S18] |
| Google Photos / Pixel | 지우기·이동·보정 제안, Reimagine·Auto frame·Zoom Enhance 사례 | 편집 도구 검색, 구도 제안, 선택 영역 기반 편집 | [S19], [S20] |
| Lightroom mobile | 생성형 제거·확장, 피사체·하늘·배경 마스킹, AI 편집 재계산 | 전체 보정과 부분 보정을 함께 제공 | [S21], [S22], [S23], [S24] |
| Snapseed | 선택 지점 기반 부분 보정, 편집 스택 수정과 마스킹 | 간결한 조작과 비파괴 편집 | [S25], [S26] |
| VSCO | 프리셋, HSL·그레인 등 보정, 편집 Recipe와 이력 | 일관된 감성 색감과 보정 조합 재사용 | [S27], [S28] |
| Picsart | 배경 제거, 객체 제거·교체, AI 확장·향상 등 | 선택 영역 편집과 창작용 AI 기능 | [S29], [S30] |
| Canva | Magic Expand로 캔버스 밖 배경 생성 | 세로·가로 등 공유 비율에 맞는 이미지 확장 | [S31] |
| CapCut | 자동 자막, 키프레임, 크로마키, 영상 배경 제거 등. 플랫폼별 범위 차이 있음 | 간편 영상 편집과 AI 보조 | [S32], [S33] |
| VN | 다중 트랙, 키프레임, 속도 곡선, LUT, 자막·템플릿 등 | 모바일에서 단계적으로 고급 편집 제공 | [S34], [S35], [S36] |
| InShot | 사진·영상 편집과 AI 자막 등 | 짧은 일상·소셜 영상 편집 | [S37] |
| LumaFusion | 다중 트랙 편집, 효과·키프레임 등 | 모바일 전문 편집 워크플로 | [S38] |
| Adobe Premiere | 텍스트 기반 편집, 전사·자막, 음성 개선, Generative Extend | 편집 노동을 줄이는 자동화 | [S39], [S40] |
| DaVinci Resolve | 색보정·합성·음향, Resolve 21의 사진 페이지 및 AI 콘텐츠 검색·초점·얼굴 보정 | 전문가용 고급 기능의 장기 방향 | [S41], [S42] |

데스크톱·웹 제품의 기능은 모바일 기능과 별개로 참고했다. CapCut의 웹·데스크톱 기능을 모바일에서 전부 지원한다고 해석하지 않으며, Premiere·Resolve 기능도 모바일 앱에 바로 탑재할 수 있다는 의미가 아니다. 무료·유료·지역·계정 조건은 제품마다 달라 가격표나 무료 제공 여부를 일괄 확정하지 않았다.

## 3. 촬영 기능 후보

### 3.1 공통 촬영 UI와 조작

아래는 카메라 앱·전문 촬영 앱과 공개 캡처 API를 바탕으로 정리한 후보다. 지원 여부는 실제 기기의 카메라 포맷과 제어 속성을 조회해 결정한다. [S01], [S02], [S04], [S05], [S06], [S43]

| ID | 기능 | 사용자에게 제공할 동작 | 구현 경로 | 우선순위 |
| --- | --- | --- | --- | --- |
| C01 | 앱 내 사진·영상 촬영 | 한 화면에서 촬영 모드 전환 | 기기 | P0 |
| C02 | 전후면 카메라 전환 | 셀피·풍경 촬영 전환 | 기기 | P0 |
| C03 | 렌즈 선택 | 지원하는 초광각·광각·망원 선택 | 기기 | P1 |
| C04 | 확대·축소 | 핀치와 슬라이더로 배율 조정 | 기기 | P0 |
| C05 | 터치 초점·노출 | 누른 곳에 초점·노출 설정 | 기기 | P0 |
| C06 | 초점·노출 잠금 | 장면이 바뀌어도 설정 유지 | 기기 | P1 |
| C07 | 노출 보정 | 촬영 전 밝기 조정 | 기기 | P0 |
| C08 | 플래시·토치 | 사진 플래시와 영상 조명 제어 | 기기 | P0 |
| C09 | 타이머 | 정해진 시간 뒤 촬영 | 기본 | P0 |
| C10 | 격자·수평계 | 구도와 기울기 안내 | 기본·기기 | P0 |
| C11 | 화면 비율 가이드 | 1:1·4:5·9:16 등의 결과 영역 표시 | 기본 | P0 |
| C12 | 셀피 미러링 | 저장 결과의 좌우 반전 선택 | 기본 | P1 |
| C13 | 촬영 후 빠른 검토 | 재촬영·편집·저장으로 바로 이동 | 기본 | P0 |
| C14 | 실시간 색감 미리보기 | 촬영 전에 선택한 룩 확인 | 기본 | P1 |
| C15 | 조작 단축키 | 볼륨 버튼·지원 하드웨어 입력 연결 | 기기 | P1 |
| C16 | 촬영 설정 프리셋 | 자주 쓰는 설정 조합 저장 | 기본 | P1 |

### 3.2 사진 촬영

| ID | 기능 | 사용자에게 제공할 동작 | 구현 경로 | 우선순위 |
| --- | --- | --- | --- | --- |
| C17 | 연속 촬영 | 여러 장을 찍고 좋은 컷 선택 | 기기·기본 | P1 |
| C18 | HDR 사진 | 밝은 곳·어두운 곳의 정보 확보 | 기기 | P1 |
| C19 | 야간 촬영 | 어두운 곳에서 더 긴 처리 시간으로 촬영 | 기기·AI | P1 |
| C20 | 인물·보케 촬영 | 인물 중심 배경 흐림 | 기기·AI | P1 |
| C21 | 근접·매크로 촬영 | 지원 렌즈로 가까운 대상 촬영 | 기기 | P2 |
| C22 | 파노라마 | 여러 프레임을 합쳐 넓은 장면 생성 | 기본·기기 | P2 |
| C23 | Live Photo·모션 기록 | 정지 사진과 짧은 움직임 함께 보관 | 기기·기본 | P2 |
| C24 | RAW·ProRAW | 지원 포맷으로 후편집 정보 보존 | 기기 | P2 |
| C25 | 수동 ISO·셔터·화이트밸런스 | 고급 사용자가 촬영 조건 설정 | 기기 | P2 |
| C26 | 수동 초점·포커스 피킹 | 선명한 영역과 확대 화면으로 초점 확인 | 기기·기본 | P2 |
| C27 | 브래케팅 | 서로 다른 노출로 여러 장 촬영 | 기기 | P2 |
| C28 | 사진 포맷·해상도 선택 | JPEG·HEIF·지원 해상도 선택 | 기기 | P1 |

HDR·야간·인물 촬영은 일반 필터와 다르다. 여러 프레임 처리나 깊이 정보가 필요할 수 있다. Android CameraX Extensions는 제조사가 공개한 일부 촬영 모드를 사용할 수 있지만, 모든 기기나 렌즈를 지원하지 않는다. iOS RAW/ProRAW와 Live Photos 역시 지원 조회가 필요하다. [S02], [S03], [S44], [S45]

### 3.3 영상 촬영

| ID | 기능 | 사용자에게 제공할 동작 | 구현 경로 | 우선순위 |
| --- | --- | --- | --- | --- |
| C29 | 해상도·FPS 선택 | 기기가 지원하는 1080p·4K·프레임레이트 선택 | 기기 | P0 |
| C30 | 촬영 시간 표시 | 녹화 상태와 길이 확인 | 기본 | P0 |
| C31 | 짧은 클립 모드 | 2초·5초 등 정한 길이로 촬영 종료 | 기본 | P0 |
| C32 | 일시정지·이어 찍기 | 여러 구간을 이어 한 결과물 생성 | 기본·기기 | P1 |
| C33 | 손떨림 보정 | 지원 안정화 모드 선택 | 기기 | P1 |
| C34 | 슬로모션 촬영 | 지원 고속 FPS로 촬영 | 기기 | P1 |
| C35 | 타임랩스 | 일정 간격으로 프레임 수집 | 기본·기기 | P1 |
| C36 | 전후면 듀얼 촬영 | 두 시점의 영상 기록·분할·작은 화면 합성 | 기기·기본 | P2 |
| C37 | 오디오 입력·레벨 표시 | 입력 장치·녹음 상태 확인 | 기기·기본 | P1 |
| C38 | 촬영 중 스냅샷 | 영상 녹화 중 정지 프레임 보관 | 기기·기본 | P1 |
| C39 | HDR·Log·고급 코덱 | 지원 기기의 색정보·전문 포맷 기록 | 기기 | P2 |
| C40 | 제브라·히스토그램·LUT 미리보기 | 과노출과 최종 룩 확인 | 기본·기기 | P2 |
| C41 | 촬영 대본 표시 | 화면에 대본을 띄워 설명 영상 촬영 | 기본 | P1 |
| C42 | 저장 공간·발열 안내 | 녹화 가능한 조건과 품질 조정 안내 | 기기·기본 | P0 |

C31은 Setlog의 짧은 기록에서 도출한 후보다. C41은 우리 앱의 설계 제안이다. 듀얼 촬영은 BeReal처럼 두 카메라로 사진을 남기는 경험과, 두 카메라를 실제로 동시에 녹화하는 구현을 구분해야 한다. 후자는 지원 기기와 조합별 자원 제한이 있다. [S07], [S09], [S04]

## 4. 사진 편집 기능 후보

### 4.1 기본 보정·색감

VSCO의 도구·Recipe, Snapseed의 부분 보정·스택, Lightroom의 마스킹을 참고한 후보다. 프리셋의 구체적인 색감·이름·모델은 자체 제작 또는 라이선스 확보가 필요하다. [S25], [S26], [S27], [S28], [S23]

| ID | 기능 | 사용자에게 제공할 동작 | 구현 경로 | 우선순위 |
| --- | --- | --- | --- | --- |
| P01 | 자르기·회전·반전 | 구도·방향 조정 | 기본 | P0 |
| P02 | 수평·원근 보정 | 기울어진 수평선·건물 조정 | 기본 | P1 |
| P03 | 밝기·노출·대비 | 전체 명암 조정 | 기본 | P0 |
| P04 | 하이라이트·그림자 | 밝은 부분·어두운 부분 조정 | 기본 | P0 |
| P05 | 화이트밸런스·틴트 | 색온도와 색 치우침 조정 | 기본 | P0 |
| P06 | 채도·색 생동감 | 색 강도 조정 | 기본 | P0 |
| P07 | HSL | 특정 색상의 색상·채도·밝기 조정 | 기본 | P1 |
| P08 | 커브·색조 분리 | 명암 곡선과 영역별 색감 조정 | 기본 | P2 |
| P09 | 선명도·디테일 | 윤곽과 질감 조정 | 기본 | P1 |
| P10 | 노이즈 감소·안개 보정 | 노이즈와 흐린 대비 완화 | 기본·AI | P1 |
| P11 | 필터·프리셋 | 원하는 룩을 한 번에 적용 | 기본 | P0 |
| P12 | 필터 강도 | 선택한 룩의 적용량 조정 | 기본 | P0 |
| P13 | 그레인·비네팅·페이드 | 필름 질감과 분위기 표현 | 기본 | P1 |
| P14 | 편집 조합 저장 | 나만의 Recipe·프리셋 재사용 | 기본 | P1 |
| P15 | 일괄 보정·설정 복사 | 여러 사진의 색감 통일 | 기본 | P1 |

### 4.2 부분 수정·꾸미기·편집 경험

| ID | 기능 | 사용자에게 제공할 동작 | 구현 경로 | 우선순위 |
| --- | --- | --- | --- | --- |
| P16 | 브러시·선형·원형 마스크 | 지정한 부분에만 보정 | 기본 | P1 |
| P17 | 피사체·하늘·배경 자동 선택 | AI가 만든 영역에 부분 보정 | AI | P1 |
| P18 | 잡티·작은 결점 복구 | 주변 영역을 이용해 작은 결점 수정 | 기본·AI | P1 |
| P19 | 복제 도장 | 선택한 부분을 다른 위치로 복사 | 기본 | P2 |
| P20 | 텍스트·스티커·그리기 | 설명과 장식 추가 | 기본 | P0 |
| P21 | 콜라주·프레임 | 여러 사진과 여백 배치 | 기본 | P1 |
| P22 | 모자이크·블러 | 얼굴·번호판·민감한 정보 가리기 | 기본·AI | P0 |
| P23 | 원본·결과 비교 | 누르기·분할 보기로 변화 확인 | 기본 | P0 |
| P24 | 실행 취소·다시 실행 | 단계별 수정 복구 | 기본 | P0 |
| P25 | 원본 보존·비파괴 편집 | 편집 명령을 보관하고 다시 수정 | 기본 | P0 |
| P26 | 별도 사본·포맷 내보내기 | 원본과 편집본을 구분해 저장 | 기본·기기 | P0 |
| P27 | RAW 현상 | RAW 데이터를 보정해 이미지로 출력 | 기기·기본 | P2 |

P22의 자동 얼굴 감지는 수동 블러와 별도 개발 항목이다. P25는 단순히 원본 사본을 남기는 기능보다 범위가 크다. 원본, 편집 명령, 마스크, 생성 결과를 함께 관리해야 한다. Snapseed의 스택은 이런 편집 경험의 참고 사례다. [S26]

## 5. AI 사진·영상 편집 조사

### 5.1 Galaxy AI: 실제 지원 사례

현재 Samsung 지원 문서는 신형 Photo Assist의 문장 입력·다른 이미지에서 요소 추가·스타일 변경을 소개한다. 이전 세대의 생성형 편집과 동일한 지원 범위로 묶으면 안 된다. [S16]

| 기능 | 공식 설명에서 확인한 역할 | 우리 앱에서 고려할 대응 기능 |
| --- | --- | --- |
| AI Eraser / 객체 제거 | 지정한 방해물 제거 | 브러시·탭 선택과 배경 복원 |
| Move / 생성형 채우기 | 객체 위치·회전·크기 조정 후 빈 부분 생성 | 객체 마스크·변형·인페인팅 |
| Create / 문장 편집 | 문장으로 원하는 변화 지정 | 편집 명령 해석과 실행 |
| Add from image | 다른 이미지의 요소를 참조해 편집 | 참조 이미지 입력·합성 |
| Style | 사진의 스타일 변경 | 스타일 변환과 후보 비교 |
| Sketch to image | 손으로 그린 스케치를 이미지로 변환 | 스케치·영역 입력 기반 생성 |
| Portrait Studio | 셀피·반려동물 사진을 그림 스타일로 변환 | 인물 중심 스타일 후보 |
| Edit suggestions | 사진에 맞는 보정 옵션 제안 | 장면 분석·Remaster 등 보정 추천 |
| Instant Slow-mo | 재생 중 슬로모션 적용 및 클립 저장 | 프레임 보간 기반 슬로모션 |
| Audio Eraser | 영상의 소리 유형을 조절·제거 | 오디오 소스 분리·믹싱 |

공식 문서의 생성형 편집에는 Samsung 계정·인터넷, 일부 결과의 최대 12MP 크기 조정, AI 생성 표시 등의 조건이 안내되어 있다. 실제 조건은 기능·모델·OS 버전별로 다시 확인해야 한다. 이 제품 조건은 우리 앱의 자체 AI 구현 조건과 별개다. [S16]

**직접 연동 상태:** 이번에 확인한 공개 문서에서는 Gallery의 Photo Assist·Audio Eraser를 외부 앱의 편집 엔진으로 호출할 수 있는 공개 API 근거를 확보하지 못했다. 기획상 유사 기능은 별도 AI 엔진으로 산정하고, 직접 연동은 추가 검증 항목으로 남긴다.

추가로 Galaxy S23의 공식 지원 문서는 **그림자·빛 반사 제거**를 설명한다. 이러한 기존 편집 도구와 최신 생성형 Photo Assist는 구분해서 참고하며, 과거 기종 안내의 메뉴가 최신 모든 기종에도 동일하다고 가정하지 않는다. [S51]

### 5.2 iPhone / Apple Intelligence: 실제 지원 사례

| 기능 | 공식 설명에서 확인한 역할 | 버전·조건 구분 |
| --- | --- | --- |
| Clean Up | 사진 속 방해물을 선택해 제거 | Apple Intelligence 지원 기기·지역 조건 확인 |
| Clean Up 처리 선택 | Auto·Fast·High Quality 처리 선택 | iOS 27 사용자 가이드 기준 |
| Extend | 원래 프레임 밖으로 배경 확장 | iOS 27 사용자 가이드 기준 |
| Reframe | 촬영 후 시점·원근을 바꾼 결과 생성 | iOS 27 사용자 가이드 기준 |
| 설명 기반 추억 영상 | 입력한 이야기로 보관함의 미디어를 구성 | Apple Intelligence 회고 기능 |
| Audio Mix | 말소리·주변 소리의 인상을 조절 | 지원 iPhone에서 공간 음향으로 촬영한 영상 등 입력 조건 확인 |

공식 iOS 27 가이드는 Apple Intelligence 지원 iPhone 15 Pro/Pro Max, iPhone 16 계열 이후 등의 조건과 언어·지역·사용량 제한 가능성을 안내한다. 일반적인 회전·원근 보정과 생성형 Reframe은 다른 기능이다. [S17], [S18]

설명 기반 추억 영상은 사진 한 장의 편집과 별개인 자동 구성 기능이다. Audio Mix 역시 Clean Up의 기기 조건을 그대로 적용할 수 없으며, 공간 음향 기록 등 자신의 입력 조건을 따른다. [S52], [S53]

**직접 연동 상태:** Apple 사진 앱의 Clean Up·Extend·Reframe 엔진을 임의 이미지에 직접 실행하는 공개 API는 이번 조사에서 확인하지 못했다. `cleanupPhoto`라는 App Intents 스키마는 존재하지만, 우리 앱의 동작을 Siri·Shortcuts에 노출하기 위한 규약이다. `perform()`의 실제 처리는 개발자가 구현해야 하므로 이를 Apple의 제거 엔진 호출 API로 간주하면 안 된다. [S46]

**공개 기술로 구현할 수 있는 부분:** Vision의 전경 마스크 생성은 배경 제거·피사체 선택의 기반으로 검토할 수 있다. Foundation Models는 텍스트·이미지 이해, 구조화된 출력·도구 호출 등에 활용할 수 있으나, 그것만으로 사진 앱의 생성형 제거·확장 엔진이 제공된다고 해석하지 않는다. API별 지원 버전과 정식·베타 상태는 채택 시 확인한다. [S47], [S48]

### 5.3 Google Photos, Pixel 및 편집 앱의 AI 사례

| 참고 제품 | 확인된 기능 | 자체 앱 적용 시 검토 사항 | 출처 |
| --- | --- | --- | --- |
| Google Photos | 방해물 제거·이동, 자동 보정과 복수 결과 | 선택 영역 UI·결과 선택 | [S19] |
| Pixel / Google Photos | Reimagine, Auto frame, Zoom Enhance 사례 | 문장 편집·구도·확대 개선; 기기·서비스 조건 확인 | [S20] |
| Lightroom mobile | Generative Remove, Generative Expand | 제거와 확장; 인터넷·구독 등 기능별 조건 확인 | [S21], [S22] |
| Lightroom mobile | AI 마스킹·AI 편집 재계산 | 편집 순서에 따라 마스크·결과 갱신 | [S23], [S24] |
| Picsart | 제거·교체·배경 제거·AI 확장·향상 | 사진 편집 모델과 전경 분리 모델 구분 | [S29], [S30] |
| Canva | Magic Expand | 출력 비율에 맞춘 생성형 확장 | [S31] |
| CapCut | 자동 자막·영상 배경 제거 | 음성 인식과 영상 세그멘테이션 구분 | [S32], [S33] |
| Premiere | 전사·텍스트 편집·음성 개선·클립 생성형 확장 | 시간 절감 자동화와 생성 기능 분리 | [S39], [S40] |
| Resolve 21 | 콘텐츠 검색, CineFocus, 얼굴 보정 등 | 장기 고급 편집 후보; Studio 등 제품 조건 확인 | [S41], [S42] |

Google Photos의 편집 화면과 기능 명칭은 변경되고 있다. 과거 Magic Editor 명칭의 사례와 현재 지우기·이동 등의 기능을 함께 조사했으며, 모든 Android 기기에서 동일한 메뉴·사용량·한국어 지원을 보장하지 않는다. 다른 서비스의 구독을 가진 사용자가 우리 앱에서 그 서비스 기능을 자동으로 이용할 수 있다고 가정하지 않는다. [S19], [S20]

### 5.4 우리 앱의 AI 기능 후보

아래는 위 사례를 바탕으로 만든 제품 요구사항 후보다. 각 후보의 성능·비용·지연시간은 별도 실증이 필요하며, 제품 기능 존재가 SDK 제공을 뜻하지 않는다.

| ID | 기능 | 사용자에게 제공할 동작 | 참고 사례 | 우선순위 |
| --- | --- | --- | --- | --- |
| A01 | 원터치 자동 보정·리마스터 | 장면에 맞는 밝기·색감·향상 후보 선택 | Google Photos [S19], Galaxy [S16] | P1 |
| A02 | 객체·사람 제거 | 선택한 방해물을 지우고 배경 채우기 | Galaxy [S16], Apple [S17], Lightroom [S21] | P1 |
| A03 | 객체 이동·크기 변경 | 피사체 위치 변경과 빈 영역 복원 | Galaxy [S16], Google Photos [S19] | P2 |
| A04 | 생성형 배경 확장 | 공유 비율에 맞춰 프레임 밖 생성 | Apple [S17], Lightroom [S22], Canva [S31] | P1 |
| A05 | 배경 제거·투명 PNG | 피사체만 추출해 저장 | Picsart [S29], Vision [S47] | P1 |
| A06 | 배경 교체·생성 | 선택한 사진·문장으로 배경 변경 | Picsart [S29] | P2 |
| A07 | 문장 기반 편집 | 자연어로 변경 사항 요청 | Galaxy [S16], Picsart [S30] | P2 |
| A08 | 참조 이미지 기반 추가 | 다른 이미지의 요소를 이용해 편집 | Galaxy [S16] | P2 |
| A09 | 영역별 자동 마스킹 | 인물·하늘·배경을 따로 보정 | Lightroom [S23] | P1 |
| A10 | 심도·초점·배경 흐림 | 피사체와 배경의 초점 효과 조정 | Lightroom [S24], Resolve [S41] | P2 |
| A11 | 고해상도화·확대 개선 | 저해상도 입력의 큰 결과 생성 | Pixel [S20], Picsart [S29] | P2 |
| A12 | 인물 결점 보정 | 피부 결점 등 선택적 보정 | Resolve [S41] | P2 |
| A13 | 그림·일러스트·인물 스타일 | 사진 분위기와 인물 표현을 다른 스타일로 변환 | Galaxy [S16] | P2 |
| A14 | 촬영 시점·원근 재구성 | 촬영 후 다른 시점의 결과 생성 | Apple Reframe [S17] | P2 |
| A15 | 자동 자막 | 영상 음성을 자막으로 만들고 수정 | CapCut [S32], InShot [S37] | P1 |
| A16 | 자막 번역 | 원문·번역 자막 선택 | Premiere [S39] | P2 |
| A17 | 텍스트 기반 컷 편집 | 전사된 문장을 편집해 영상 구간 수정 | Premiere [S39] | P2 |
| A18 | 자동 하이라이트 편집 | 클립을 골라 초안을 만들고 수정 | VN AutoCut 사례 [S34] | P1 |
| A19 | 소리 분리·제거·믹스 | 목소리·주변 소리의 비율 조절 | Galaxy [S16], Apple Audio Mix [S53] | P2 |
| A20 | 음성 명료도 개선 | 말소리를 더 잘 들리게 처리 | Premiere [S39] | P1 |
| A21 | 영상 배경 제거 | 움직이는 인물을 배경과 분리 | CapCut [S33] | P2 |
| A22 | 보간 슬로모션 | 중간 프레임을 생성해 부드럽게 감속 | Galaxy [S16], VN [S34] | P2 |
| A23 | 영상 시작·끝 확장 | 부족한 길이의 앞·뒤 프레임 생성 | Premiere [S40] | P2 |
| A24 | AI 미디어 검색 | 사람·사물·대사로 클립 찾기 | Resolve [S41] | P2 |
| A25 | 얼굴·번호판 자동 가림 | 민감 영역을 찾아 블러; 사용자가 수정 | 독자 설계 제안 | P1 |
| A26 | 여러 결과 비교·부분 복원 | 생성 후보 선택, 원본 영역 복원 | Lightroom [S21]에서 도출 | P1 |
| A27 | 그림자·빛 반사 제거 | 선택하거나 감지한 그림자·반사 완화 | Galaxy S23 [S51] | P2 |
| A28 | 스케치 기반 생성 | 그린 형태를 요소나 이미지로 생성 | Galaxy [S16] | P2 |
| A29 | 설명 기반 회고 구성 | 이야기·기간·인물에 맞는 영상 초안 생성 | Apple 추억 영상 [S52] | P2 |

### 5.5 AI 기능을 요구사항으로 만들 때 필요한 구분

- **보정과 생성:** 밝기·색감 조정은 기존 픽셀을 바꾼다. 제거·확장·고해상도화 등은 원본에 없던 내용을 생성하거나 추정할 수 있다. 결과를 실제 촬영 정보의 복구로 설명하지 않는다.
- **사진과 영상:** 사진 한 장의 제거 기능과 영상 전체의 제거 기능은 다른 작업이다. 영상은 프레임 간 일관성·추적·깜빡임까지 검증해야 한다.
- **노이즈 감소와 소리 분리:** 잡음 억제는 특정 사람의 목소리나 음악만 분리·제거하는 기능과 다르다.
- **자막과 번역:** 한국어 음성 인식 품질, 시간 정렬, 화자 구분, 번역 품질을 각각 평가한다. 사용자 수정 기능을 포함한다.
- **즉시 미리보기와 최종 결과:** 저해상도 미리보기와 원본 해상도 처리의 비용·시간·출력 차이를 별도로 정의한다.
- **온디바이스와 서버 처리:** 기기 내 처리와 외부 전송 여부를 구분하고, 사용자 사진·음성의 보관·삭제·모델 학습 사용 조건을 확인한다.

## 6. 영상·오디오 편집 기능 후보

### 6.1 기본 영상 편집

VN·CapCut·LumaFusion의 편집 기능과 Android Media3·AVFoundation을 참고한 후보다. 고급 합성·HDR·키프레임 효과를 추가하면 단순 컷 편집보다 렌더링 파이프라인이 크게 복잡해진다. [S34], [S35], [S36], [S33], [S38], [S49], [S50]

| ID | 기능 | 사용자에게 제공할 동작 | 구현 경로 | 우선순위 |
| --- | --- | --- | --- | --- |
| V01 | 클립 가져오기·연결 | 여러 영상·사진을 순서대로 배치 | 기본 | P0 |
| V02 | 시작·끝 자르기 | 필요한 구간만 남기기 | 기본 | P0 |
| V03 | 분할·삭제·복제·재배치 | 컷의 길이와 순서 조정 | 기본 | P0 |
| V04 | 자르기·회전·비율 변경 | 영상 구도를 출력 비율에 맞추기 | 기본 | P0 |
| V05 | 배경 여백 | 원본 비율 유지하며 단색·블러 배경 배치 | 기본 | P0 |
| V06 | 사진을 영상에 넣기 | 사진 표시 시간과 간단한 이동 효과 설정 | 기본 | P0 |
| V07 | 전환 효과 | 페이드·디졸브 등 컷 연결 | 기본 | P1 |
| V08 | 속도 조정 | 일정 배율로 느리게·빠르게 | 기본 | P1 |
| V09 | 속도 곡선 | 구간별로 점진적인 가감속 | 기본 | P2 |
| V10 | 역재생·정지 프레임 | 뒤로 재생·장면 멈춤 | 기본 | P1 |
| V11 | 텍스트·자막 꾸미기 | 글꼴·위치·배경·노출 구간 지정 | 기본 | P0 |
| V12 | 날짜·시간·작성자 오버레이 | 브이로그에 기록 맥락 표시 | 기본 | P0 |
| V13 | 스티커·이미지 오버레이 | 영상 위에 장식 배치 | 기본 | P1 |
| V14 | PIP·화면 분할 | 두 영상·사진을 동시에 배치 | 기본 | P1 |
| V15 | 다중 트랙 | 영상·소리·텍스트를 별도 트랙으로 편집 | 기본 | P2 |
| V16 | 키프레임 | 위치·크기·회전·투명도를 시간에 따라 변화 | 기본 | P2 |
| V17 | 마스크·크로마키 | 특정 영역·색만 표시하거나 제거 | 기본 | P2 |
| V18 | 영상 색보정·LUT | 클립 색감과 룩 조정 | 기본 | P1 |
| V19 | 편집 후 흔들림 보정 | 저장된 영상의 흔들림 완화 | 기본·AI | P2 |
| V20 | 객체 추적·따라가는 블러 | 움직이는 대상에 효과 유지 | AI·기본 | P2 |
| V21 | 세로 영상 자동 구도 | 주요 피사체를 따라 출력 영역 이동 | AI·기본 | P2 |
| V22 | 자동 저장·프로젝트 복구 | 편집 도중 종료되어도 이어 작업 | 기본 | P0 |
| V23 | 출력 품질 선택 | 해상도·FPS·코덱·비트레이트 설정 | 기본·기기 | P0 |
| V24 | 미리보기·출력 상태 | 렌더 진행·취소·실패 재시도 | 기본·기기 | P0 |
| V25 | 자막 파일 입출력 | SRT 등 자막을 가져오거나 별도 저장 | 기본 | P2 |

V12는 일상 기록에 맞춘 설계 제안이다. V20·V21은 추적·자동 구도 기술을 검증한 뒤 추가할 후보이며, 이 표가 모든 참고 앱의 동일 기능 지원을 보장하지는 않는다.

### 6.2 오디오 편집

| ID | 기능 | 사용자에게 제공할 동작 | 구현 경로 | 우선순위 |
| --- | --- | --- | --- | --- |
| O01 | 원본 소리 음량·음소거 | 영상 원음의 크기 조절 | 기본 | P0 |
| O02 | 배경 음악·효과음 | 허용된 음원 추가 | 기본 | P0 |
| O03 | 오디오 분리 | 영상 소리를 별도 트랙으로 편집 | 기본 | P1 |
| O04 | 내레이션 녹음 | 편집 화면에서 설명 녹음 | 기기·기본 | P1 |
| O05 | 페이드 인·아웃 | 소리가 자연스럽게 시작·종료 | 기본 | P1 |
| O06 | 음량 평준화 | 클립 간 소리 차이 완화 | 기본 | P1 |
| O07 | 대화 중 음악 낮추기 | 말소리가 있을 때 배경 음악 감쇠 | 기본·AI | P1 |
| O08 | 비트에 맞춘 컷 | 박자에 맞게 전환 지점 제안 | 기본·AI | P1 |
| O09 | 이퀄라이저·간단한 효과 | 저음·고음·공간감 등 조절 | 기본 | P2 |
| O10 | 텍스트 음성 변환 | 입력한 설명을 음성으로 생성 | AI·기기 | P2 |
| O11 | 영상·소리 싱크 조정 | 오디오 시작 지점과 길이 조정 | 기본 | P1 |

기본 오디오 편집과 비트 편집은 VN의 공식 기능 안내를, AI 음성 개선은 Premiere를 참고했다. O06·O07은 우리 앱에 필요한 믹싱 요구사항으로 도출했다. [S34], [S36], [S39]

음원 제공 앱에 음악 라이브러리가 있다는 사실만으로 우리 서비스에 재사용할 수 있는 것은 아니다. 직접 확보한 음원·효과음의 앱 제공·내보내기·외부 게시 허용 범위를 확인한다. 초기에는 사용자가 가져온 음원과 별도 허가된 소규모 라이브러리로 범위를 정할 수 있다.

## 7. Setlog 등 일상 공유 플랫폼에서 참고할 기능

### 7.1 Setlog에서 공식적으로 확인된 범위

App Store의 공식 소개는 **2초 기록**, **최대 20명의 친구와 순간 공유**, **주기 알림**, **짧은 기록을 모은 하루 브이로그 자동 구성**을 설명한다. 알림을 3시간 간격으로 바꾸거나 끄는 사용법도 소개한다. Android 배포도 Google Play에서 확인했다. 이 수치와 동작은 소개 자료 기준이며 현재 모든 플랫폼의 구현을 직접 테스트하지는 않았다. [S07], [S08]

Setlog의 친구 제거 권한·원본 저장·내보내기 품질·그룹 관리 규칙·필터·댓글·음악 등 세부 기능은 이번 공식 소개만으로 확정하지 않았다. 사용자 리뷰나 비공식 가이드를 근거로 전체 기능을 단정하지 않는다.

Setlog에서 참고할 핵심은 편집 도구의 수보다 **기록의 짧음, 반복 촬영, 친구들과의 같은 하루, 자동 완성**이다. 우리 앱에서는 간편 기록 화면을 기본으로 두고, 필요한 순간에만 편집 화면을 여는 방식이 적합하다.

### 7.2 공유·일상 기록 기능 후보

| ID | 기능 | 사용자에게 제공할 동작 | 근거·참고 | 구현 경로 | 우선순위 |
| --- | --- | --- | --- | --- | --- |
| D01 | 짧은 순간 기록 | 몇 초만 찍어 일상 저장 | Setlog [S07] | 기본 | P0 |
| D02 | 촬영 리마인더 | 주기·시간대별 알림, 끄기 | Setlog [S07] | 기기·서버 | P1 |
| D03 | 하루 브이로그 자동 구성 | 날짜별 클립을 이어 한 영상 생성 | Setlog [S07] | 기본 | P0 |
| D04 | 친구 그룹 공유 | 그룹 안에서 기록 보기 | Setlog [S07] | 서버 | P1 |
| D05 | 여러 사람의 공동 브이로그 | 구성원의 클립을 하나의 회고로 구성 | Setlog에서 도출, 1SE Collab [S15] | 서버·기본 | P1 |
| D06 | 같은 순간 촬영 미션 | 공동 알림과 촬영 시간창 | BeReal [S09] | 서버·기기 | P2 |
| D07 | 전후면 순간 기록 | 내 모습과 주변을 함께 기록 | BeReal [S09] | 기기·기본 | P1 |
| D08 | 셀피 반응 | 사진으로 감정 반응 남기기 | BeReal [S10] | 기기·서버 | P2 |
| D09 | 개인 추억 보관함 | 과거 기록을 비공개로 회고 | BeReal [S11] | 기본·서버 | P0 |
| D10 | 홈 화면 위젯 | 친구의 최근 사진 표시 | Locket [S12] | 기기·서버 | P2 |
| D11 | 공유 이력 | 주고받은 사진·영상 다시 보기 | Locket [S13] | 서버 | P1 |
| D12 | 캘린더형 영상 일기 | 날짜별 사진·클립 기록 | 1SE [S14], [S15] | 기본·서버 | P0 |
| D13 | 월간·연간 회고 | 기간을 정해 누적 영상 생성 | 1SE [S14] | 기본 | P1 |
| D14 | 여행·행사 프로젝트 | 여러 날짜의 클립을 주제로 묶기 | 1SE Freestyle [S15] | 기본·서버 | P1 |
| D15 | 친구 초대·멤버 관리 | 초대·탈퇴·제외·역할 관리 | 독자 설계 제안 | 서버 | P1 |
| D16 | 공개 범위 선택 | 나만·선택한 친구·그룹 등 지정 | 독자 설계 제안 | 서버 | P1 |
| D17 | 댓글·간단한 반응 | 기록에 소통하기 | 독자 설계 제안 | 서버 | P1 |
| D18 | 기록 맥락 | 메모·감정·선택적 장소 태그 | 독자 설계 제안 | 기본·서버 | P1 |
| D19 | 외부 공유·다운로드 | 저장 후 다른 앱의 공유 화면 열기 | BeReal 다운로드 사례 [S11]에서 도출 | 기기·기본 | P0 |
| D20 | 조용한 시간·알림 빈도 | 기록 참여와 알림 부담 조절 | 독자 설계 제안 | 기본·서버 | P1 |
| D21 | 게시 취소·삭제·차단·신고 | 공유 기록과 관계를 관리 | 독자 설계 제안 | 서버 | P1 |
| D22 | 편집 표시·원본 선택 | 촬영 기록과 AI 편집 결과 구분 | 독자 설계 제안 | 기본·서버 | P1 |

친구 그룹을 제공한다면 D15·D16·D21은 공유 흐름과 함께 구현해야 한다. 그룹 참여 전 기록의 열람 범위, 멤버 제외 후 접근 권한, 공동 영상에 들어간 클립 삭제 시 재생성 규칙도 정의한다. 정확한 위치 공유는 기본값으로 두지 않는다.

D19의 외부 공유는 시스템 공유 화면과 파일 내보내기를 뜻한다. Instagram·TikTok·YouTube에 게시물을 자동 업로드하는 기능은 각 서비스의 API·권한·정책을 따로 검증하는 별도 범위다.

## 8. 저장·내보내기·기술적 구현 가능성

### 8.1 제품 완성도에 필요한 기능 후보

| ID | 기능 | 필요한 이유 | 구현 경로 | 우선순위 |
| --- | --- | --- | --- | --- |
| L01 | 갤러리·파일 가져오기 | 앱에서 찍은 것 외에도 편집 | 기기 | P0 |
| L02 | 최소 권한 요청 | 촬영·선택한 미디어·저장 권한 분리 | 기기 | P0 |
| L03 | 원본·편집본·프로젝트 구분 | 원본 보존과 수정 가능성 확보 | 기본 | P0 |
| L04 | 오프라인 촬영·초안 | 네트워크 없이 기록 | 기본 | P0 |
| L05 | 업로드 대기·재시도 | 연결이 끊겨도 기록 전송 복구 | 서버·기기 | P1 |
| L06 | 클라우드 백업·동기화 | 기기 변경·분실에 대비 | 서버 | P1 |
| L07 | 섬네일·미리보기 캐시 | 긴 영상과 많은 기록의 탐색 속도 | 기본 | P0 |
| L08 | 저장 공간 정리 | 원본·캐시·AI 결과의 용량 관리 | 기본 | P1 |
| L09 | HDR·SDR 출력 처리 | 공유 대상에서 밝기·색감 유지 | 기기·기본 | P1 |
| L10 | 메타데이터 선택 | 촬영 날짜 유지·위치 정보 제외 | 기본 | P0 |
| L11 | 계정·콘텐츠 삭제 | 사용자 자료와 공유 상태 관리 | 서버 | P1 |
| L12 | AI 처리 상태·실패 복구 | 진행·취소·재시도·결과 선택 | 기본·서버 | P1 |

이 표는 경쟁 제품의 기능을 전부 확인한 목록이 아니라, 조사한 촬영·편집·공유 흐름을 완성하기 위한 **독자적인 제품 설계 항목**이다.

### 8.2 공개 API와 제조사 기능의 경계

| 영역 | 공개 기술로 검토할 경로 | 확인된 제한·계획상 판단 | 출처 |
| --- | --- | --- | --- |
| Android 기본 촬영 | CameraX, 필요 시 Camera2 | 기능·렌즈·포맷별 실제 지원 조회 | [S44], [S45] |
| Android 제조사 촬영 확장 | CameraX/Camera2 Extensions | Night·HDR·Bokeh·Face Retouch·Auto 등 중 기기에서 공개한 모드만 이용 | [S44], [S45] |
| Android 확장과 영상 | 기본 영상 캡처 또는 별도 처리 | Extensions는 미리보기·사진용이며 영상 녹화용으로 가정하지 않음 | [S45] |
| iOS 사진·영상 촬영 | AVFoundation | 렌즈·RAW·Live Photo·멀티캠 등 지원 확인 | [S02], [S03], [S04] |
| iPhone Camera Control | AVFoundation·AVKit·LockedCameraCapture 등 | 지원 하드웨어의 버튼·잠금 화면 촬영 연계 | [S43] |
| Android 영상 편집 | Media3 Transformer | 자르기·변환·효과·하드웨어 인코딩 기반으로 검토 | [S49] |
| iOS 영상 편집 | AVFoundation와 관련 미디어 프레임워크 | 합성·내보내기 등 구성; 효과 구현은 별도 필요 | [S50] |
| iOS 피사체 추출 | Vision 전경 마스크 | 마스크 생성과 합성·내보내기 UI는 별도 | [S47] |
| Apple Intelligence 활용 | Foundation Models, App Intents | 편집 명령 해석·앱 동작 노출과 사진 앱 편집 엔진을 구분 | [S46], [S48] |
| Galaxy Photo Assist·Apple 사진 AI | 연동 확인 | 공개 엔진 호출 근거 미확보; 별도 구현을 기본 산정 | 5.1·5.2절 |
| Lightroom·Google Photos 등 제품 기능 | 연동 확인 | 제품 기능을 SDK/API로 이용할 수 있는지 각각 검증 | 5.3절 |

Android 개발자 문서는 **2026-11-01부터 일부 기기에서 CameraX 1.5 이하 앱의 Extensions 지원이 제거될 수 있으며 1.6 이상 사용을 권장**한다고 안내한다. 조사일 이후 예정된 변화이므로 Android 구현에 착수할 때 최신 안정 버전과 해당 안내를 다시 확인한다. [S44]

React Native나 Flutter 같은 공통 UI 기술을 사용하더라도, 고급 카메라·미디어 처리는 네이티브 모듈과 OS별 검증이 필요할 수 있다. 프레임워크·AI 공급자 선정은 기능 우선순위와 실기기 성능 확인 이후 결정하는 것이 좋다. 이 문서는 특정 기술 스택을 확정하지 않는다.

### 8.3 기능별 현실적인 개발 판단

| 기능 묶음 | 상대적인 개발 부담 | 먼저 확인할 사항 |
| --- | --- | --- |
| 기본 사진 촬영·크롭·필터 | 낮음~중간 | 저장 방향·색공간·해상도·권한 |
| 기본 영상 촬영·컷·연결·출력 | 중간 | 코덱·가변 FPS·오디오 싱크·발열 |
| 하루 브이로그 자동 연결 | 중간 | 날짜·정렬·클립 길이·오디오 통일 |
| 자동 자막 | 중간 | 한국어·잡음·시간 정렬·수동 수정 |
| 배경 제거·민감 영역 감지 | 중간~높음 | 경계 품질·오탐·처리 속도 |
| 사진 객체 제거·확장 | 높음 | 생성 품질·해상도·비용·외부 전송 |
| 친구 그룹·공동 기록 | 높음 | 권한·삭제 전파·비용·동기화 |
| 전문가용 촬영·HDR/Log | 높음 | 지원 기기·포맷·색관리·저장 속도 |
| 다중 트랙·추적·영상 생성 편집 | 매우 높음 | 프레임 간 일관성·렌더링·메모리 |

부담 평가는 팀 규모·경험·SDK 활용에 따라 달라지는 기획상 추정이다. 인월·원가·일정을 계산한 견적은 아니다. 외부 AI API가 있어도 편집 상태 관리, 미리보기, 실패 복구, 결과 저장까지는 제품에서 구현해야 한다.

## 9. 초기 출시 범위와 확장 순서 제안

### 9.1 먼저 만들 최소 흐름

**제품 제안:** “사진과 짧은 영상을 앱에서 찍고, 필요한 만큼 손본 뒤, 하루의 기록을 한 편으로 남긴다.”

1. **촬영·가져오기:** 사진·영상, 전후면 전환, 확대, 플래시, 타이머, 기기 지원 촬영 품질, 갤러리 가져오기.
2. **간편 사진 편집:** 크롭·회전, 밝기·색온도·채도, 소수의 자체 프리셋, 텍스트와 수동 블러.
3. **간편 영상 편집:** 클립 연결·자르기·순서 변경, 출력 비율, 원음·배경 음악, 간단한 자막.
4. **일상 기록:** 2~5초 등 짧은 기록, 날짜별 보관, 하루 브이로그 자동 연결.
5. **저장·공유:** 원본 보존, 초안 복구, 편집본 저장, 시스템 공유 화면, 촬영 위치 메타데이터 제외 선택.
6. **대표 AI 기능:** 첫 확장에서는 자동 자막을 우선 검증하고, 사진 객체 제거 또는 배경 제거 중 하나를 품질·비용 실증 후 선택.

여기서 하루 영상 연결은 날짜·순서·클립 길이 규칙으로도 만들 수 있다. 반드시 생성형 AI가 필요하지 않다. 이후 좋은 장면 선택과 음악 박자 편집을 추가하면 자동 편집의 품질을 높일 수 있다.

### 9.2 확장 단계

| 단계 | 기능 묶음 | 다음 단계로 넘어가기 위한 확인 |
| --- | --- | --- |
| 1차 | 개인 촬영·기본 편집·하루 기록·내보내기 | 사용자가 실제로 기록을 반복하고 결과를 저장하는지 |
| 2차 | 자동 자막·단일 AI 사진 기능·알림·월간 회고 | AI 품질·응답 시간·사용당 비용과 기록 재방문 |
| 3차 | 친구 그룹·공동 브이로그·댓글·백업 | 접근 권한·멤버 관리·삭제 동작·서버 비용 |
| 4차 | 문장 편집·생성형 확장·소리 분리·고급 타임라인 | 기능별 실증과 고급 사용자 수요 |
| 장기 | RAW/Log/HDR·멀티캠·추적·영상 생성 확장 | 기기 호환성과 전문 편집 성능 |

일상 공유가 핵심 정체성이라면 3차의 친구 그룹을 1차로 앞당긴다. 이 경우 로그인·공개 범위·초대·차단·삭제를 함께 포함해야 한다. 반대로 편집 도구 자체가 핵심이면 개인 편집·내보내기를 먼저 검증한다.

## 10. 개발 전 확인할 항목과 간단한 검증 계획

### 아직 확정하지 않은 제품 조건

- 주요 사용자가 개인 일기 사용자, 친구 그룹, 숏폼 제작자 중 누구인지.
- 첫 플랫폼을 Android·iOS 중 하나로 시작할지, 동시에 지원할지.
- 사진 편집과 영상 편집 중 어떤 흐름이 첫 화면과 핵심 가치를 담당할지.
- 공유를 시스템 내보내기로 시작할지, 자체 친구 그룹까지 제공할지.
- AI 결과의 원본 해상도, 목표 대기시간, 무료 사용량과 유료 범위.
- 클라우드에 원본을 보관할지, 편집 결과·축소본만 보관할지.

이 조건은 조사를 중단할 이유가 아니라, 다음 기획 단계에서 기능을 줄이고 요구사항을 확정하기 위한 선택지다.

### 기능 실증

| 검증 대상 | 테스트 입력 | 확인할 결과 |
| --- | --- | --- |
| 촬영 호환성 | iPhone과 Galaxy, 보급형 Android, 전후면·렌즈별 조합 | 지원 조회와 기능 숨김·대체 동작 |
| 미디어 호환성 | JPEG/HEIF, 세로·가로 영상, 가변 FPS, HDR 입력 | 방향·색감·재생·소리 싱크·내보내기 성공 |
| 영상 편집 | 여러 기기 클립 혼합, 긴 영상, 중간 앱 종료 | 복구·메모리·발열·출력 품질 |
| 객체 제거·확장 | 사람·글자·복잡한 배경·머리카락·큰 제거 영역 | 경계·생성 오류·원본 영역 유지·처리시간 |
| 자동 자막 | 한국어 대화·음악·주변 소음·여러 화자 | 전사 오류·시간 정렬·수정 편의 |
| 공동 브이로그 | 멤버 추가·제외, 클립 삭제, 업로드 재시도 | 접근 권한·삭제 반영·영상 재생성 |

이번 문서는 웹 자료 조사이며 설치·실기기·SDK 실증을 수행하지 않았다. 출처가 보여주는 제품 기능, 직접 API 연동 근거의 확인 상태, 독자적인 구현 제안을 구분해 후속 조사에 사용할 수 있도록 했다.

## 11. 출처 목록

각 링크는 해당 기능을 설명하는 공식 페이지 또는 앱 개발자가 제공한 공식 스토어 설명이다. 출처 번호는 기능 ID와 별개다. 웹 문서는 업데이트될 수 있으므로 기능 구현에 착수할 때 같은 URL의 최신 조건을 다시 읽는다.

| 번호 | 자료 | 용도 |
| --- | --- | --- |
| S01 | [Samsung: Camera modes and settings](https://www.samsung.com/us/support/answer/ANS10001353/) | Galaxy 촬영 모드 |
| S02 | [Apple Developer: Capturing still and Live Photos](https://developer.apple.com/documentation/avfoundation/capturing-still-and-live-photos) | 사진·Live Photo·캡처 형식 |
| S03 | [Apple Developer: RAW and Apple ProRAW capture](https://developer.apple.com/documentation/avfoundation/capturing-photos-in-raw-and-apple-proraw-formats) | RAW 지원 조회 |
| S04 | [Apple Developer: AVCaptureMultiCamSession](https://developer.apple.com/documentation/avfoundation/avcapturemulticamsession) | 멀티캠·자원 제한 |
| S05 | [Halide 공식 제품 소개](https://halide.cam/) | 전문 사진 촬영 |
| S06 | [Blackmagic Camera 공식 소개](https://www.blackmagicdesign.com/sg/products/blackmagiccamera) | 전문 영상 촬영 |
| S07 | [App Store: Setlog 공식 에디터 소개](https://apps.apple.com/kr/iphone/story/id6794149156) | 2초 기록·친구·알림·자동 영상 |
| S08 | [Google Play: Setlog](https://play.google.com/store/apps/details?id=com.newchat.setlog&hl=en-US) | 앱 식별·Android 배포 |
| S09 | [BeReal: Time to BeReal](https://help.bereal.com/hc/en-us/articles/7350386715165--Time-to-BeReal) | 알림·전후면·촬영 시간창 |
| S10 | [BeReal: Instant RealMoji](https://help.bereal.com/hc/en-us/articles/17845941900445-Instant-RealMoji) | 셀피 반응 |
| S11 | [BeReal: Memories](https://help.bereal.com/hc/en-us/articles/7531349180829-Memories) | 개인 회고·저장·공유 |
| S12 | [Locket: What is Locket?](https://help.locket.com/en/articles/14225418-my-teen-asked-me-to-get-locket-what-is-it) | 친구 사진 위젯 |
| S13 | [Locket: Photos and videos](https://help.locket.com/en/articles/14188121-how-does-locket-use-my-photos-and-videos) | 전달·공유 기록 |
| S14 | [1SE: What is 1SE?](https://help.1se.co/en/articles/966670-what-is-1se) | 일일 클립·회고 영상 |
| S15 | [1SE: Freestyle, Collab and Journal](https://help.1se.co/en/articles/1077034-freestyle-vs-freestyle-collab-vs-journal) | 프로젝트·협업 유형 |
| S16 | [Samsung: AI editing tools in Gallery](https://www.samsung.com/us/support/answer/ANS10000934/) | Photo Assist·슬로모션·오디오 |
| S17 | [Apple: Clean up, extend, and reframe photos — iOS 27](https://support.apple.com/guide/iphone/clean-up-extend-and-reframe-photos-xy0grrlxue5w/27/ios/27) | 최신 AI 사진 편집 |
| S18 | [Apple: Requirements to use Clean Up](https://support.apple.com/en-la/121429) | 지원 조건 |
| S19 | [Google Photos: Edit your photos — Android](https://support.google.com/photos/answer/6128850?co=GENIE.Platform%3DAndroid&hl=en) | 현재 사진 편집 |
| S20 | [Google Photos 팀: Pixel 9 AI photo features](https://support.google.com/photos/thread/290720135/google-pixel-9-new-ai-photo-features?hl=en) | Reimagine·Auto frame·Zoom Enhance 사례 |
| S21 | [Adobe: Lightroom mobile Generative Remove](https://helpx.adobe.com/lightroom/mobile/heal-clone-and-remove/remove-objects-with-generative-remove.html) | 생성형 제거 |
| S22 | [Adobe: Lightroom mobile Generative Expand](https://helpx.adobe.com/lightroom/mobile/crop-and-transform/expand-photo-borders-with-generative-expand.html) | 생성형 확장 |
| S23 | [Adobe: Create masks in Lightroom mobile](https://helpx.adobe.com/lightroom/mobile/masks-and-selective-adjustments/create-masks.html) | 자동·수동 마스크 |
| S24 | [Adobe: Update AI edits](https://helpx.adobe.com/lightroom/mobile/manage-ai-edits/update-ai-edits.html) | AI 편집 순서·재계산 |
| S25 | [Snapseed: Selective Adjust](https://support.google.com/snapseed/answer/3111701?hl=en) | 부분 보정 |
| S26 | [Snapseed: Stacks](https://support.google.com/snapseed/answer/6155543?hl=en) | 비파괴 편집·마스크 |
| S27 | [VSCO: Tools Quick Start](https://support.vsco.co/en/articles/12698570-vsco-tools-quick-start) | 색감·Recipe·보정 도구 |
| S28 | [VSCO: Membership HSL](https://support.vsco.co/en/articles/12698494-vsco-membership-hsl) | HSL·사진·영상·구독 조건 |
| S29 | [Picsart: AI tools overview](https://support.picsart.com/hc/en-us/articles/39757921110301-Picsart-AI-tools-AI-Expand-Remove-Object-AI-Enhance-and-more) | AI 도구·플랫폼 차이 |
| S30 | [Picsart: AI Replace](https://support.picsart.com/hc/en-us/articles/9813819557021-How-do-I-use-AI-Replace) | iOS·Android 선택 영역 생성 |
| S31 | [Canva: AI Image Expander](https://www.canva.com/features/ai-image-expander/) | Magic Expand |
| S32 | [CapCut: Recognise subtitles](https://www.capcut.com/help/how-to-recognise-subtitles) | 플랫폼별 자동 자막 |
| S33 | [CapCut: Keyframe animation](https://www.capcut.com/tools/keyframe-animation) | 고급 편집·AI 도구 사례 |
| S34 | [VN: Features](https://vlognow.me/blog/features/) | 공식 기능 목록 |
| S35 | [VN: Filters](https://www.vlognow.me/blog/features/filters/) | 필터·LUT |
| S36 | [VN: Help topics](https://vlognow.me/help/topic/) | 출력·자막·오디오·프로젝트 |
| S37 | [App Store: InShot 개발자 설명](https://apps.apple.com/us/app/inshot-video-editor/id997362197) | 모바일 편집 |
| S38 | [App Store: LumaFusion 개발자 설명](https://apps.apple.com/us/app/lumafusion/id1062022008) | 모바일 전문 편집 |
| S39 | [Adobe Premiere: AI video editing](https://www.adobe.com/products/premiere/ai-video-editing.html) | 텍스트 편집·음성·자막 |
| S40 | [Adobe: Generative Extend overview](https://helpx.adobe.com/uk/premiere/desktop/edit-projects/edit-with-generative-ai/generative-extend-overview.html) | 클립 확장·제약 |
| S41 | [Blackmagic: Resolve 21 new features](https://www.blackmagicdesign.com/kr/products/davinciresolve/whatsnew/) | 사진·콘텐츠 검색·고급 AI |
| S42 | [Blackmagic: Resolve product overview](https://www.blackmagicdesign.com/products/davinciresolve/) | 색보정·합성·음향·제품 구분 |
| S43 | [Apple Developer: Camera Control integration](https://developer.apple.com/documentation/avfoundation/enhancing-your-app-experience-with-the-camera-control) | 촬영 하드웨어 조작 연계 |
| S44 | [Android Developers: CameraX Extensions API](https://developer.android.com/media/camera/camerax/extensions-api) | 확장 모드·버전 변경 안내 |
| S45 | [Android Developers: Camera extensions](https://developer.android.com/media/camera/camera-extensions) | 제조사 지원·영상 제한 |
| S46 | [Apple Developer: cleanupPhoto intent schema](https://developer.apple.com/documentation/appintents/appschema/photosintent/cleanupphoto) | Siri 연결과 엔진 호출 구분 |
| S47 | [Apple Developer: VNGenerateForegroundInstanceMaskRequest](https://developer.apple.com/documentation/vision/vngenerateforegroundinstancemaskrequest) | 전경·배경 마스크 |
| S48 | [Apple Developer: Foundation Models framework](https://developer.apple.com/foundation-models-framework/) | 언어·이미지 이해·도구 호출 |
| S49 | [Android Developers: Media3 Transformer](https://developer.android.com/media/media3/transformer) | 영상 편집·인코딩 |
| S50 | [Apple Developer: AVFoundation](https://developer.apple.com/av-foundation/) | 미디어 제작·편집·HDR 관련 기술 |
| S51 | [Samsung: Galaxy S23 Object Eraser](https://www.samsung.com/sg/support/mobile-devices/how-to-use-the-galaxy-s23-object-eraser/) | 그림자·빛 반사 제거 사례 |
| S52 | [Apple: Memory movies — iOS 27](https://support.apple.com/en-gb/guide/iphone/iphee2ee53fe/27/ios/27) | 설명 기반 추억 영상 |
| S53 | [Apple: Edit videos and Audio Mix](https://support.apple.com/en-ie/104968) | 영상 편집·공간 음향 입력 조건 |

[S01]: https://www.samsung.com/us/support/answer/ANS10001353/
[S02]: https://developer.apple.com/documentation/avfoundation/capturing-still-and-live-photos
[S03]: https://developer.apple.com/documentation/avfoundation/capturing-photos-in-raw-and-apple-proraw-formats
[S04]: https://developer.apple.com/documentation/avfoundation/avcapturemulticamsession
[S05]: https://halide.cam/
[S06]: https://www.blackmagicdesign.com/sg/products/blackmagiccamera
[S07]: https://apps.apple.com/kr/iphone/story/id6794149156
[S08]: https://play.google.com/store/apps/details?id=com.newchat.setlog&hl=en-US
[S09]: https://help.bereal.com/hc/en-us/articles/7350386715165--Time-to-BeReal
[S10]: https://help.bereal.com/hc/en-us/articles/17845941900445-Instant-RealMoji
[S11]: https://help.bereal.com/hc/en-us/articles/7531349180829-Memories
[S12]: https://help.locket.com/en/articles/14225418-my-teen-asked-me-to-get-locket-what-is-it
[S13]: https://help.locket.com/en/articles/14188121-how-does-locket-use-my-photos-and-videos
[S14]: https://help.1se.co/en/articles/966670-what-is-1se
[S15]: https://help.1se.co/en/articles/1077034-freestyle-vs-freestyle-collab-vs-journal
[S16]: https://www.samsung.com/us/support/answer/ANS10000934/
[S17]: https://support.apple.com/guide/iphone/clean-up-extend-and-reframe-photos-xy0grrlxue5w/27/ios/27
[S18]: https://support.apple.com/en-la/121429
[S19]: https://support.google.com/photos/answer/6128850?co=GENIE.Platform%3DAndroid&hl=en
[S20]: https://support.google.com/photos/thread/290720135/google-pixel-9-new-ai-photo-features?hl=en
[S21]: https://helpx.adobe.com/lightroom/mobile/heal-clone-and-remove/remove-objects-with-generative-remove.html
[S22]: https://helpx.adobe.com/lightroom/mobile/crop-and-transform/expand-photo-borders-with-generative-expand.html
[S23]: https://helpx.adobe.com/lightroom/mobile/masks-and-selective-adjustments/create-masks.html
[S24]: https://helpx.adobe.com/lightroom/mobile/manage-ai-edits/update-ai-edits.html
[S25]: https://support.google.com/snapseed/answer/3111701?hl=en
[S26]: https://support.google.com/snapseed/answer/6155543?hl=en
[S27]: https://support.vsco.co/en/articles/12698570-vsco-tools-quick-start
[S28]: https://support.vsco.co/en/articles/12698494-vsco-membership-hsl
[S29]: https://support.picsart.com/hc/en-us/articles/39757921110301-Picsart-AI-tools-AI-Expand-Remove-Object-AI-Enhance-and-more
[S30]: https://support.picsart.com/hc/en-us/articles/9813819557021-How-do-I-use-AI-Replace
[S31]: https://www.canva.com/features/ai-image-expander/
[S32]: https://www.capcut.com/help/how-to-recognise-subtitles
[S33]: https://www.capcut.com/tools/keyframe-animation
[S34]: https://vlognow.me/blog/features/
[S35]: https://www.vlognow.me/blog/features/filters/
[S36]: https://vlognow.me/help/topic/
[S37]: https://apps.apple.com/us/app/inshot-video-editor/id997362197
[S38]: https://apps.apple.com/us/app/lumafusion/id1062022008
[S39]: https://www.adobe.com/products/premiere/ai-video-editing.html
[S40]: https://helpx.adobe.com/uk/premiere/desktop/edit-projects/edit-with-generative-ai/generative-extend-overview.html
[S41]: https://www.blackmagicdesign.com/kr/products/davinciresolve/whatsnew/
[S42]: https://www.blackmagicdesign.com/products/davinciresolve/
[S43]: https://developer.apple.com/documentation/avfoundation/enhancing-your-app-experience-with-the-camera-control
[S44]: https://developer.android.com/media/camera/camerax/extensions-api
[S45]: https://developer.android.com/media/camera/camera-extensions
[S46]: https://developer.apple.com/documentation/appintents/appschema/photosintent/cleanupphoto
[S47]: https://developer.apple.com/documentation/vision/vngenerateforegroundinstancemaskrequest
[S48]: https://developer.apple.com/foundation-models-framework/
[S49]: https://developer.android.com/media/media3/transformer
[S50]: https://developer.apple.com/av-foundation/
[S51]: https://www.samsung.com/sg/support/mobile-devices/how-to-use-the-galaxy-s23-object-eraser/
[S52]: https://support.apple.com/en-gb/guide/iphone/iphee2ee53fe/27/ios/27
[S53]: https://support.apple.com/en-ie/104968
