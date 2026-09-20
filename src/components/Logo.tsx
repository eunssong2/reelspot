import Svg, { Path, Rect } from 'react-native-svg';

import { colors } from '@/theme/theme';

/**
 * 릴스팟 마크. assets/logo.svg 와 같은 도형을 그린다.
 * 둘 중 하나를 고치면 나머지도 같이 고칠 것.
 */
export function Logo({ size = 64, color = colors.accent }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 1024 1024" accessibilityLabel="릴스팟">
      <Path
        d="M512 944C512 944 838 622 838 428A326 326 0 1 0 186 428C186 622 512 944 512 944Z"
        fill={color}
      />
      <Rect x={330} y={300} width={364} height={258} rx={40} fill={colors.bg} />
      <Rect x={440} y={300} width={18} height={258} fill={color} />
      <Rect x={566} y={300} width={18} height={258} fill={color} />
      <Path d="M487 379L546 429L487 479V379Z" fill={color} />
    </Svg>
  );
}
