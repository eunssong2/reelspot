import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { Logo } from '@/components/Logo';

import { ActionButton } from '../components/FormParts';
import { ScreenFrame } from '../components/ScreenFrame';
import { commonErrorText, useGroups } from '../state/GroupsProvider';
import { colors, GUTTER } from '../styles/tokens';

/**
 * 앱 시작 스플래시(명세 4.0). 저장된 세션을 복원하는 동안 보인다.
 * 오프라인이면 무한히 기다리지 않고 다시 시도를 보여 주며, 저장된 세션은 지우지 않는다.
 */
export function SplashScreen() {
  const { restoreError, retryRestore } = useGroups();
  return (
    <ScreenFrame>
      <View style={styles.wrap}>
        <Logo size={96} />
        <Text style={styles.word}>
          <Text style={styles.wordAt}>AT THAT </Text>
          <Text style={styles.wordPlace}>PLACE</Text>
        </Text>
        <View style={styles.status} accessibilityLiveRegion="polite">
          {restoreError ? (
            <>
              <Text style={styles.error}>{commonErrorText(restoreError)}</Text>
              <ActionButton label="다시 시도" tone="secondary" onPress={retryRestore} style={styles.retry} />
            </>
          ) : (
            <ActivityIndicator color={colors.primary} accessibilityLabel="로그인 정보를 확인하는 중" />
          )}
        </View>
      </View>
    </ScreenFrame>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, paddingHorizontal: GUTTER },
  word: { fontSize: 20, fontWeight: '900', letterSpacing: 1 },
  wordAt: { color: colors.ink },
  wordPlace: { color: colors.primary },
  status: { minHeight: 120, alignItems: 'center', justifyContent: 'center', gap: 12, alignSelf: 'stretch', marginTop: 12 },
  error: { fontSize: 14, lineHeight: 21, color: colors.textSub, textAlign: 'center' },
  retry: { alignSelf: 'stretch' },
});
