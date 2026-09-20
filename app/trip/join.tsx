import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { joinTripByCode } from '@/features/trips/api';
import { GUTTER, colors, radius, spacing, type } from '@/theme/theme';

const CODE_LENGTH = 6;

export default function JoinTripScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    setBusy(true);
    try {
      const tripId = await joinTripByCode(code);
      router.replace(`/trip/${tripId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : '참여하지 못했습니다.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Stack.Screen
        options={{
          headerShown: true,
          title: '',
          headerShadowVisible: false,
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.text,
        }}
      />

      <View style={styles.content}>
        <View style={styles.intro}>
          <Text style={styles.headline}>초대 코드를{'\n'}입력해 주세요</Text>
          <Text style={styles.sub}>친구에게 받은 6자리 코드예요.</Text>
        </View>

        <TextInput
          style={[styles.code, Boolean(error) && styles.codeError]}
          value={code}
          onChangeText={(next) => {
            setCode(next.toUpperCase());
            if (error) setError(null);
          }}
          placeholder="------"
          placeholderTextColor={colors.textMuted}
          autoCapitalize="characters"
          autoCorrect={false}
          autoFocus
          maxLength={CODE_LENGTH}
        />

        {error && <Text style={styles.error}>{error}</Text>}
      </View>

      <View style={[styles.footer, { paddingBottom: spacing(4) + insets.bottom }]}>
        <Button
          label="참여하기"
          onPress={submit}
          disabled={code.length !== CODE_LENGTH}
          loading={busy}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { flex: 1, paddingHorizontal: GUTTER, gap: spacing(8) },
  intro: { gap: spacing(2) },
  headline: { ...type.display, color: colors.text },
  sub: { ...type.label, color: colors.textMuted },
  code: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: 'transparent',
    borderRadius: radius.lg,
    color: colors.text,
    fontSize: 36,
    fontWeight: '700',
    letterSpacing: 12,
    textAlign: 'center',
    paddingVertical: spacing(5),
    // 자간 때문에 오른쪽으로 쏠려 보이는 걸 보정한다.
    paddingLeft: 12,
  },
  codeError: { borderColor: colors.danger, backgroundColor: colors.bg },
  error: { ...type.label, color: colors.danger, textAlign: 'center' },
  footer: { paddingHorizontal: GUTTER, paddingTop: spacing(3) },
});
