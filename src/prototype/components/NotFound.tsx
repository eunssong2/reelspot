import { StyleSheet, Text, View } from 'react-native';

import type { Nav } from '../navigation/routes';
import { colors, GUTTER } from '../styles/tokens';
import { ActionButton } from './FormParts';
import { ScreenFrame } from './ScreenFrame';

/** 접근할 수 없거나 없는 대상을 열었을 때: 안내 후 입구(내 모임)로 돌아간다. */
export function NotFound({ nav, message }: { nav: Nav; message: string }) {
  return (
    <ScreenFrame>
      <View style={styles.wrap}>
        <Text style={styles.text}>{message}</Text>
        <ActionButton label="내 모임으로" tone="secondary" onPress={nav.home} style={styles.button} />
      </View>
    </ScreenFrame>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, paddingHorizontal: GUTTER },
  text: { fontSize: 16, fontWeight: '700', color: colors.text, textAlign: 'center' },
  button: { alignSelf: 'stretch' },
});
