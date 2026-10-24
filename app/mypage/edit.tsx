import { Stack, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';
import { useAuth } from '@/features/auth/AuthProvider';
import { fetchMyProfile, updateMyProfile } from '@/features/profile/api';
import { GUTTER, colors, radius, spacing, type } from '@/theme/theme';

const NICKNAME_MAX = 12;

export default function EditProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [nickname, setNickname] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let active = true;
    fetchMyProfile(user.id)
      .then((profile) => active && setNickname(profile.nickname))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [user]);

  const canSubmit = nickname.trim().length > 0 && !saving;

  const submit = async () => {
    if (!user) return;
    setError(null);
    setSaving(true);
    try {
      await updateMyProfile(user.id, { nickname: nickname.trim() });
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장하지 못했습니다.');
    } finally {
      setSaving(false);
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
          title: '내 정보 수정',
          headerShadowVisible: false,
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.text,
        }}
      />

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : (
        <>
          <View style={styles.content}>
            <View style={styles.avatarBlock}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{(nickname || '?').slice(0, 1)}</Text>
              </View>
              <Text style={styles.avatarHint}>사진 등록은 곧 추가돼요</Text>
            </View>

            <TextField
              label="닉네임"
              value={nickname}
              onChangeText={setNickname}
              placeholder="스팟원에게 보일 이름"
              maxLength={NICKNAME_MAX}
              hint={`스팟원 목록·초대에 이 이름으로 보여요 (최대 ${NICKNAME_MAX}자)`}
              error={error}
            />
          </View>

          <View style={[styles.footer, { paddingBottom: spacing(4) + insets.bottom }]}>
            <Button label="저장" onPress={submit} disabled={!canSubmit} loading={saving} />
          </View>
        </>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { flex: 1, paddingHorizontal: GUTTER, paddingTop: spacing(6), gap: spacing(6) },
  avatarBlock: { alignItems: 'center', gap: spacing(2) },
  avatar: {
    width: 84,
    height: 84,
    borderRadius: radius.pill,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { ...type.display, color: colors.accent },
  avatarHint: { ...type.caption, color: colors.textMuted },
  footer: { paddingHorizontal: GUTTER, paddingTop: spacing(3) },
});
