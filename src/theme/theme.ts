// 40~60대 사용자를 우선 고려한다: 밝은 배경, 높은 대비, 큰 글자, 큰 터치 영역.
export const colors = {
  bg: '#FFFFFF',
  surface: '#F4F5F7',
  border: '#D8DBE0',
  text: '#16181D',
  textMuted: '#5B6170',
  accent: '#1F6FEB',
  accentSoft: '#E7F0FE',
  danger: '#D13438',
} as const;

export const spacing = (n: number) => n * 4;

export const radius = { sm: 10, md: 16, lg: 24, pill: 999 } as const;

/** 본문 17pt 이상. 안드로이드 접근성 기준 최소 터치 영역은 48dp 이지만 56 으로 잡는다. */
export const font = {
  title: 30,
  heading: 22,
  body: 17,
  label: 15,
} as const;

export const MIN_TOUCH = 56;
