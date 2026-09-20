import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useAuth } from '@/features/auth/AuthProvider';
import { createTrip } from '@/features/trips/api';
import { MIN_TOUCH, colors, font, radius, spacing } from '@/theme/theme';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export default function NewTripScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [title, setTitle] = useState('');
  const [destination, setDestination] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const datesValid =
    DATE_PATTERN.test(startDate) && DATE_PATTERN.test(endDate) && endDate >= startDate;
  const canSubmit = title.trim().length > 0 && destination.trim().length > 0 && datesValid;

  const submit = async () => {
    if (!user) return;
    setError(null);
    setBusy(true);
    try {
      const trip = await createTrip(
        { title: title.trim(), destination: destination.trim(), startDate, endDate },
        user.id,
      );
      // 방을 만들면 바로 스팟원 부르는 화면으로 보낸다.
      router.replace(`/trip/${trip.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : '여행을 만들지 못했습니다.');
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
          title: '여행 만들기',
          headerTitleStyle: { fontSize: font.heading, fontWeight: '700' },
        }}
      />

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Field label="여행 이름" value={title} onChange={setTitle} placeholder="제주 3박 4일" />
        <Field label="여행지" value={destination} onChange={setDestination} placeholder="제주도" />
        <Field
          label="시작일"
          value={startDate}
          onChange={setStartDate}
          placeholder="2026-10-02"
          keyboardType="numbers-and-punctuation"
        />
        <Field
          label="종료일"
          value={endDate}
          onChange={setEndDate}
          placeholder="2026-10-05"
          keyboardType="numbers-and-punctuation"
        />

        {startDate.length > 0 && endDate.length > 0 && !datesValid && (
          <Text style={styles.hint}>날짜는 2026-10-02 형식으로, 종료일이 시작일보다 빠르지 않게 적어 주세요.</Text>
        )}
        {error && <Text style={styles.error}>{error}</Text>}
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          style={[styles.primary, (!canSubmit || busy) && styles.disabled]}
          disabled={!canSubmit || busy}
          onPress={submit}
        >
          {busy ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.primaryText}>만들고 스팟원 부르기</Text>
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  keyboardType,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  placeholder: string;
  keyboardType?: 'numbers-and-punctuation';
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        keyboardType={keyboardType}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing(5), gap: spacing(5) },
  field: { gap: spacing(2) },
  label: { color: colors.text, fontSize: font.body, fontWeight: '700' },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    color: colors.text,
    fontSize: font.heading,
    minHeight: MIN_TOUCH,
    paddingHorizontal: spacing(4),
  },
  hint: { color: colors.textMuted, fontSize: font.label, lineHeight: 22 },
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
