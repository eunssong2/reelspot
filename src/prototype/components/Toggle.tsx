import { Platform, Switch, type SwitchProps } from 'react-native';

import { colors } from '../styles/tokens';

/**
 * 켜고 끄는 토글. 색을 한곳에서 맞춘다.
 *
 * react-native-web 은 켜진 상태의 손잡이·띠 색을 activeThumbColor·activeTrackColor 로 받는다
 * (thumbColor·trackColor 는 꺼진 상태에만 쓴다). 그래서 웹에서만 한 벌을 더 넘긴다.
 * 이걸 빼면 띠만 코랄이고 손잡이는 기본 초록으로 남아, 브랜드와 어긋난 채 고장난 것처럼 보인다.
 */
export function Toggle(props: SwitchProps) {
  const web =
    Platform.OS === 'web'
      ? ({ activeThumbColor: colors.bg, activeTrackColor: colors.primary } as unknown as SwitchProps)
      : undefined;
  return (
    <Switch
      trackColor={{ true: colors.primary, false: colors.surfaceStrong }}
      thumbColor={colors.bg}
      ios_backgroundColor={colors.surfaceStrong}
      {...web}
      {...props}
    />
  );
}
