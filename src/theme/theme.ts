/**
 * 토스 UI 를 참고한 디자인 토큰.
 * 흰 배경 + 무채색 위계 + 포인트 블루 하나, 그림자 대신 여백과 회색 면으로 구분한다.
 * 40~60대 사용자를 고려해 본문은 17pt 이상, 터치 영역은 56 이상으로 잡는다.
 */
export const palette = {
  gray900: '#191F28',
  gray800: '#333D4B',
  gray700: '#4E5968',
  gray600: '#6B7684',
  gray500: '#8B95A1',
  gray400: '#B0B8C1',
  gray300: '#D1D6DB',
  gray200: '#E5E8EB',
  gray100: '#F2F4F6',
  gray50: '#F9FAFB',
  blue600: '#1B64DA',
  blue500: '#3182F6',
  blue50: '#E8F3FF',
  red500: '#F04452',
  white: '#FFFFFF',
} as const;

export const colors = {
  bg: palette.white,
  /** 카드·입력창처럼 배경에서 한 단 들어간 면 */
  surface: palette.gray100,
  border: palette.gray200,
  text: palette.gray900,
  textBody: palette.gray700,
  textMuted: palette.gray500,
  accent: palette.blue500,
  accentPressed: palette.blue600,
  accentSoft: palette.blue50,
  danger: palette.red500,
  onAccent: palette.white,
} as const;

export const spacing = (n: number) => n * 4;

export const radius = { sm: 8, md: 12, lg: 16, xl: 20, pill: 999 } as const;

/** 토스는 제목을 크고 굵게, 자간을 살짝 좁혀 쓴다. */
export const type = {
  display: { fontSize: 28, fontWeight: '700', letterSpacing: -0.7, lineHeight: 38 },
  title: { fontSize: 24, fontWeight: '700', letterSpacing: -0.6, lineHeight: 33 },
  heading: { fontSize: 19, fontWeight: '700', letterSpacing: -0.4, lineHeight: 27 },
  body: { fontSize: 17, fontWeight: '500', letterSpacing: -0.3, lineHeight: 26 },
  bodyStrong: { fontSize: 17, fontWeight: '600', letterSpacing: -0.3, lineHeight: 26 },
  label: { fontSize: 15, fontWeight: '500', letterSpacing: -0.2, lineHeight: 22 },
  caption: { fontSize: 13, fontWeight: '500', letterSpacing: -0.1, lineHeight: 19 },
} as const;

/** 화면 좌우 기본 여백 */
export const GUTTER = spacing(5);
export const MIN_TOUCH = 56;
