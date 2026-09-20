import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { joinTripByCode } from '@/features/trips/api';
import { MIN_TOUCH, colors, font, radius, spacing } from '@/theme/theme';

export default function JoinTripScreen() {
  const router = useRouter();
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
          title: '초대 코드로 참여',
          headerTitleStyle: { fontSize: font.heading, fontWeight: '700' },
        }}
      />

      <View style={styles.content}>
        <Text style={styles.guide}>친구에게 받은 6자리 코드를 적어 주세요.</Text>

        <TextInput
          style={styles.input}
          value={code}
          onChangeText={(next) => setCode(next.toUpperCase())}
          placeholder="K7M2QD"
          placeholderTextColor={colors.textMuted}
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={6}
        />

        {error && <Text style={styles.error}>{error}</Text>}
      </View>

      <View style={styles.footer}>
        <Pressable
          style={[styles.primary, (code.length !== 6 || busy) && styles.disabled]}
          disabled={code.length !== 6 || busy}
          onPress={submit}
        >
          {busy ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.primaryText}>참여하기</Text>
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing(5), gap: spacing(5) },
  guide: { color: colors.textMuted, fontSize: font.body, lineHeight: 26 },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    color: colors.text,
    fontSize: 34,
    fontWeight: '700',
    letterSpacing: 8,
    textAlign: 'center',
    paddingVertical: spacing(4),
  },
  error: { color: colors.danger, fontSize: font.body, lineHeight: 24 },
  footer: { padding: spacing(5), borderTopWidth: 1, borderTopColor: colors.border },
  primary: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    minHeight: MIN_TOUCH,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: { color: '#FFFFFF', fontSize: font.heading, fontWeight: '700' },
  disabled: { opacity: 0.4 },
});
