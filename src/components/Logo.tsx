import Svg, {
  ClipPath,
  Defs,
  Ellipse,
  G,
  LinearGradient,
  Path,
  Rect,
  Stop,
} from 'react-native-svg';

const PIN =
  'M512 852C706 686 788 566 788 430L788 318C788 236 726 172 644 172L380 172C298 172 236 236 236 318L236 430C236 566 318 686 512 852Z';

const PLANE =
  'M110 0C96 -10 60 -18 20 -20L-60 -78L-86 -70L-46 -18L-84 -14L-104 -34L-120 -30L-108 0L-120 30L-104 34L-84 14L-46 18L-86 70L-60 78L20 20C60 18 96 10 110 0Z';

const STRIPES = [
  'M210 356H282L342 150H270Z',
  'M350 356H422L482 150H410Z',
  'M490 356H562L622 150H550Z',
  'M630 356H702L762 150H690Z',
];

/**
 * 릴스팟 마크. assets/logo.svg 와 같은 도형이다.
 * 둘 중 하나를 고치면 나머지도 같이 고칠 것.
 */
export function Logo({ size = 96 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 1024 1024" accessibilityLabel="릴스팟">
      <Defs>
        <LinearGradient id="pinGradient" x1="280" y1="840" x2="760" y2="200" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor="#E8517E" />
          <Stop offset="0.52" stopColor="#F1706B" />
          <Stop offset="1" stopColor="#F8A85B" />
        </LinearGradient>
        <ClipPath id="pinClip">
          <Path d={PIN} />
        </ClipPath>
      </Defs>

      <Ellipse cx={512} cy={880} rx={150} ry={28} fill="#C9CCD1" opacity={0.5} />
      <Path d={PIN} fill="url(#pinGradient)" />

      <G clipPath="url(#pinClip)">
        {STRIPES.map((d) => (
          <Path key={d} d={d} fill="#FFFFFF" />
        ))}
        <Rect x={220} y={352} width={584} height={26} fill="#FFFFFF" />
      </G>

      <Path
        d="M458 500L458 648L596 574Z"
        fill="#FFFFFF"
        stroke="#FFFFFF"
        strokeWidth={44}
        strokeLinejoin="round"
      />

      <Path
        d="M180 596C120 780 322 848 536 800C680 768 772 664 812 548"
        stroke="#23272F"
        strokeWidth={22}
        strokeLinecap="round"
        fill="none"
      />

      <G transform="translate(872 470) rotate(-32) scale(0.62)">
        <Path d={PLANE} fill="#23272F" />
      </G>
    </Svg>
  );
}
