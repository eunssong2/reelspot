import { colors } from '@/theme/theme';

/**
 * 지도 위 장소 핀(이모지 원 + 이름표)의 CSS. 카카오 지도는 HTML 요소로 오버레이를 그리므로
 * React Native 스타일이 아니라 CSS 속성(camelCase)으로 둔다. 웹과 WebView 가 같은 값을 쓴다.
 * 선택된 핀은 base 위에 Selected 값을 덧씌운다.
 */
export const PIN_STYLE = {
  wrap: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    cursor: 'pointer',
  },
  dot: {
    width: '36px',
    height: '36px',
    boxSizing: 'border-box',
    borderRadius: '50%',
    border: '3px solid #ffffff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '18px',
    boxShadow: '0 3px 8px rgba(25,31,40,0.28)',
  },
  dotSelected: {
    width: '46px',
    height: '46px',
    border: `4px solid ${colors.accent}`,
    fontSize: '22px',
    boxShadow: '0 6px 14px rgba(25,31,40,0.36)',
  },
  label: {
    marginTop: '3px',
    maxWidth: '116px',
    padding: '2px 8px',
    borderRadius: '999px',
    background: 'rgba(255,255,255,0.96)',
    color: colors.text,
    font: '700 11px/16px sans-serif',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    boxShadow: '0 2px 6px rgba(25,31,40,0.22)',
  },
  labelSelected: {
    background: colors.accent,
    color: colors.onAccent,
  },
} as const satisfies Record<string, Record<string, string>>;
