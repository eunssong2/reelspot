import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { CapacityPicker } from '@/components/CapacityPicker';
import { LayoutPicker } from '@/components/LayoutPicker';
import { TextField } from '@/components/TextField';
import { useAuth } from '@/features/auth/AuthProvider';
import { createTrip } from '@/features/trips/api';
import { layoutForCapacity, layoutsFor } from '@/features/trips/layouts';
import { GUTTER, colors, spacing, type } from '@/theme/theme';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export default function NewTripScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [title, setTitle] = useState('');
  const [destination, setDestination] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [capacity, setCapacity] = useState(3);
  const [layout, setLayout] = useState(() => layoutsFor(3)[0].id);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const bothDatesTyped = startDate.length === 10 && endDate.length === 10;
  const datesValid =
    DATE_PATTERN.test(startDate) && DATE_PATTERN.test(endDate) && endDate >= startDate;
  const dateError = bothDatesTyped && !datesValid ? '종료일이 시작일보다 빠릅니다.' : null;
  const canSubmit = title.trim().length > 0 && destination.trim().length > 0 && datesValid;

  // 정원이 바뀌면 칸 수가 안 맞는 배치는 그 정원의 첫 배치로 갈아탄다.
  const changeCapacity = (next: number) => {
    setCapacity(next);
    setLayout((current) => layoutForCapacity(next, current));
  };

  const submit = async () => {
    if (!user) return;
    setError(null);
    setBusy(true);
    try {
      const trip = await createTrip(
        {
          title: title.trim(),
          destination: destination.trim(),
          startDate,
          endDate,
          capacity,
          layout,
        },
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
          title: '',
          headerShadowVisible: false,
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.text,
        }}
      />

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.intro}>
          <Text style={styles.headline}>어떤 여행인가요?</Text>
          <Text style={styles.sub}>나중에 언제든 바꿀 수 있어요.</Text>
        </View>

        <TextField label="여행 이름" value={title} onChangeText={setTitle} placeholder="제주 3박 4일" />
        <TextField
          label="여행지"
          value={destination}
          onChangeText={setDestination}
          placeholder="제주도"
        />
        <TextField
          label="시작일"
          value={startDate}
          onChangeText={setStartDate}
          placeholder="2026-10-02"
          hint="연도-월-일 순서로 적어 주세요."
          keyboardType="numbers-and-punctuation"
          maxLength={10}
        />
        <TextField
          label="종료일"
          value={endDate}
          onChangeText={setEndDate}
          placeholder="2026-10-05"
          error={dateError}
          keyboardType="numbers-and-punctuation"
          maxLength={10}
        />

        <View style={styles.block}>
          <Text style={styles.blockTitle}>스팟원 몇 명인가요?</Text>
          <Text style={styles.blockSub}>방장인 나를 포함한 인원이에요. 나중에 늘릴 수 있어요.</Text>
          <CapacityPicker value={capacity} onChange={changeCapacity} />
        </View>

        <View style={styles.block}>
          <Text style={styles.blockTitle}>화면 배치</Text>
          <Text style={styles.blockSub}>
            여행 영상에서 스팟원 {capacity}명의 기록이 놓일 자리예요.
          </Text>
          <LayoutPicker capacity={capacity} value={layout} onChange={setLayout} />
        </View>

        {error && <Text style={styles.error}>{error}</Text>}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: spacing(4) + insets.bottom }]}>
        <Button
          label="만들고 스팟원 부르기"
          onPress={submit}
          disabled={!canSubmit}
          loading={busy}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: GUTTER, paddingBottom: spacing(8), gap: spacing(5) },
  intro: { gap: spacing(2), marginBottom: spacing(2) },
  headline: { ...type.display, color: colors.text },
  sub: { ...type.label, color: colors.textMuted },
  block: { gap: spacing(2) },
  blockTitle: { ...type.heading, color: colors.text },
  blockSub: { ...type.caption, color: colors.textMuted, marginBottom: spacing(2) },
  error: { ...type.label, color: colors.danger },
  footer: { paddingHorizontal: GUTTER, paddingTop: spacing(3) },
});
