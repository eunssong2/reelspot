import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { NoticeModal } from '../../demo/NoticeModal';
import { AppHeader } from '../components/AppHeader';
import { Avatar } from '../components/Avatar';
import { NicknameEditModal } from '../components/NicknameEditModal';
import { ScreenFrame } from '../components/ScreenFrame';
import { Toast, useToast } from '../components/Toast';
import { LOGIN_PROVIDER_EXAMPLE, membersFor, TRIPS } from '../mock/tripData';
import type { Nav } from '../navigation/routes';
import { usePrototype } from '../state/PrototypeProvider';
import { colors, GUTTER, radius } from '../styles/tokens';
import { pickProfilePhoto } from '../utils/profilePhoto';

/** 프로필 사진 지름(px). */
const AVATAR_SIZE = 112;

/** 프로필 및 계정: 로그인 방식을 보고, 프로필 사진·닉네임을 고친다. */
export function AccountScreen({ nav }: { nav: Nav }) {
  const toast = useToast();
  const { profile, setNickname, setAvatar } = usePrototype();
  const defaultAvatar = membersFor(TRIPS[0])[0].avatarUrl;
  const [editingName, setEditingName] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);

  const changePhoto = async () => {
    const result = await pickProfilePhoto();
    if (!result) return;
    if ('error' in result) {
      setPhotoError(result.error);
      return;
    }
    setAvatar(result.uri);
    toast.show('프로필 사진을 바꿨어요');
  };

  return (
    <ScreenFrame>
      <AppHeader title="프로필 및 계정" onBack={nav.back} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Pressable accessibilityRole="button" accessibilityLabel="프로필 사진 변경" onPress={changePhoto} style={styles.avatarWrap}>
          <Avatar uri={profile.avatarUri ?? defaultAvatar} size={AVATAR_SIZE} />
          <View style={styles.cameraBadge}>
            <Text style={styles.cameraGlyph}>📷</Text>
          </View>
        </Pressable>

        <Text style={styles.nickname}>{profile.nickname}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="닉네임 수정" onPress={() => setEditingName(true)} hitSlop={8}>
          <Text style={styles.edit}>수정</Text>
        </Pressable>

        {profile.avatarUri ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="기본 프로필 사진으로 되돌리기"
            onPress={() => {
              setAvatar(null);
              toast.show('기본 사진으로 되돌렸어요');
            }}
            hitSlop={8}
          >
            <Text style={styles.resetText}>기본 사진으로 되돌리기</Text>
          </Pressable>
        ) : null}

        <View style={styles.divider} />

        <View style={styles.row}>
          <Text style={styles.rowLabel}>로그인 방식</Text>
          <View style={styles.provider}>
            <View style={[styles.providerDot, { backgroundColor: LOGIN_PROVIDER_EXAMPLE.color }]} />
            <Text style={styles.providerText}>{LOGIN_PROVIDER_EXAMPLE.label}</Text>
          </View>
        </View>
      </ScrollView>

      <NicknameEditModal
        visible={editingName}
        initial={profile.nickname}
        onClose={() => setEditingName(false)}
        onSave={(next) => {
          setNickname(next);
          setEditingName(false);
          toast.show('닉네임을 바꿨어요');
        }}
      />
      <NoticeModal visible={photoError !== null} title="프로필 사진" message={photoError ?? ''} onConfirm={() => setPhotoError(null)} />
      <Toast message={toast.message} bottom={24} />
    </ScreenFrame>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: GUTTER, paddingTop: 20, paddingBottom: 32, alignItems: 'center', gap: 10 },
  avatarWrap: { width: AVATAR_SIZE, height: AVATAR_SIZE, marginBottom: 10 },
  cameraBadge: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraGlyph: { fontSize: 16 },
  nickname: { fontSize: 22, fontWeight: '800', color: colors.text },
  edit: { fontSize: 15, fontWeight: '600', color: '#3B8EEA' },
  resetText: { fontSize: 13, color: colors.textMuted, textDecorationLine: 'underline' },
  divider: { alignSelf: 'stretch', height: 1, backgroundColor: colors.line, marginTop: 18 },
  row: { alignSelf: 'stretch', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14 },
  rowLabel: { fontSize: 17, fontWeight: '800', color: colors.text },
  provider: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  providerDot: { width: 22, height: 22, borderRadius: radius.pill },
  providerText: { fontSize: 15, color: colors.text },
});
