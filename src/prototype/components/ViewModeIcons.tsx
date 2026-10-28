import Svg, { Circle, Path, Rect } from 'react-native-svg';

interface Props {
  size?: number;
  color: string;
}

/** 사진별 보기 아이콘: 네모 칸 4개(사진 모음). */
export function PhotoGridIcon({ size = 20, color }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.9} strokeLinejoin="round">
      <Rect x={3.5} y={3.5} width={7} height={7} rx={1.8} />
      <Rect x={13.5} y={3.5} width={7} height={7} rx={1.8} />
      <Rect x={3.5} y={13.5} width={7} height={7} rx={1.8} />
      <Rect x={13.5} y={13.5} width={7} height={7} rx={1.8} />
    </Svg>
  );
}

/** 사람별 보기 아이콘: 사람 모양. */
export function PersonIcon({ size = 20, color }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
      <Circle cx={12} cy={8} r={3.8} />
      <Path d="M4.5 20.5c0-3.9 3.4-6.5 7.5-6.5s7.5 2.6 7.5 6.5" />
    </Svg>
  );
}
