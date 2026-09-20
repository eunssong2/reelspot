/**
 * 프로토타입 디자인 토큰: 밝은 하늘색 + 흰색, 둥근 카드, 부드러운 그림자.
 * 흰 글자를 올리는 primary 는 굵은 16px 이상 텍스트에서만 쓴다(대비 약 4:1).
 */
export const colors = {
  /** 앱 전체 배경(아주 연한 하늘색) */
  bg: '#EAF6FD',
  surface: '#FFFFFF',
  /** 주요 버튼, 선택 상태 */
  primary: '#2487DC',
  onPrimary: '#FFFFFF',
  /** 연한 파랑 배경(비선택 탭, + 추가 버튼, Day 카드) */
  primarySoft: '#DCEEFB',
  primaryBorder: '#B5D9F5',
  text: '#1E2B3A',
  textSub: '#566B80',
  line: '#D6E8F5',
  /** 배지·핀 강조(따뜻한 포인트) */
  accent: '#FF8A5B',
} as const;

export const radius = {
  card: 20,
  item: 16,
  button: 16,
  pill: 999,
} as const;

/** RN 0.76+ 의 boxShadow 문자열. 네이티브·웹 모두 같은 값을 쓴다. */
export const shadow = {
  card: '0px 6px 16px rgba(36, 100, 160, 0.12)',
  soft: '0px 3px 10px rgba(36, 100, 160, 0.10)',
  float: '0px 8px 22px rgba(20, 60, 110, 0.22)',
} as const;

/** 화면 좌우 여백 */
export const GUTTER = 20;
