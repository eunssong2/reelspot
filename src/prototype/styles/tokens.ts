import { colors as team, palette } from '@/theme/theme';

/**
 * 프로토타입 디자인 토큰. 팀 앱의 디자인 시스템(src/theme/theme.ts, 토스 UI 기준)에서 색을 가져와
 * 같은 톤을 쓴다: 흰 배경 + 회색 면 카드 + 코랄 포인트, 그림자 대신 면 구분.
 * 팀 팔레트가 바뀌면 프로토타입도 함께 바뀐다.
 */
export const colors = {
  /** 화면 배경 (흰색) */
  bg: team.bg,
  /** 카드·입력창·비선택 칩처럼 배경에서 한 단 들어간 회색 면 */
  surface: team.surface,
  /** 회색 면 위에 얹는 한 단계 더 진한 면 */
  surfaceStrong: palette.gray200,
  /** 주요 버튼, 선택 상태 (팀 accent) */
  primary: team.accent,
  primaryPressed: team.accentPressed,
  onPrimary: team.onAccent,
  /** 연한 코랄 배경(선택 항목, + 추가 버튼, 배지) */
  primarySoft: team.accentSoft,
  /** 코랄 계열 옅은 테두리·선택 표시 */
  primaryBorder: '#F9C9C6',
  text: team.text,
  textSub: palette.gray600,
  textMuted: team.textMuted,
  line: team.border,
  danger: team.danger,
  /** 어두운 반투명 안내(토스트·힌트)용 */
  ink: palette.ink,
  /** 보조 포인트(주황) */
  accent: palette.orange500,
} as const;

export const radius = {
  card: 20,
  item: 16,
  /** 팀 Button 과 같은 곡률 */
  button: 14,
  pill: 999,
} as const;

/** 팀 앱은 그림자 대신 면으로 구분한다. 화면 위에 뜨는 요소(시트·토스트)만 옅은 중립 그림자를 쓴다. */
export const shadow = {
  card: undefined,
  soft: undefined,
  float: '0px 6px 20px rgba(25, 31, 40, 0.16)',
} as const;

/** 화면 좌우 여백 (팀 GUTTER 와 동일) */
export const GUTTER = 20;
/** 팀 Button 최소 터치 높이 */
export const MIN_TOUCH = 56;
