import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { NoticeModal } from '../../demo/NoticeModal';
import { AppHeader } from '../components/AppHeader';
import { Avatar } from '../components/Avatar';
import { GearIcon } from '../components/GearIcon';
import { NicknameEditModal } from '../components/NicknameEditModal';
import { ScreenFrame } from '../components/ScreenFrame';
import { Toast, useToast } from '../components/Toast';
import { membersFor, TRIPS } from '../mock/tripData';
import type { Nav } from '../navigation/routes';
import { usePrototype } from '../state/PrototypeProvider';
import { colors, GUTTER, MIN_TOUCH, radius } from '../styles/tokens';
import { pickProfilePhoto } from '../utils/profilePhoto';

/**
 * 마이페이지: 프로필 사진·닉네임, 지금까지 참여한 모임 수를 본다. 오른쪽 위 톱니바퀴로 설정에 들어간다.
 * 참여한 모임 수는 앱에 담긴 모임 목록(TRIPS) 개수이며, 실제 서비스에서는 서버 값으로 바뀐다.
 */
export function MyPageScreen({ nav }: { nav: Nav }) {
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
      <AppHeader
        title="마이페이지"
        onBack={nav.back}
        right={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="설정"
            onPress={() => nav.push({ name: 'settings' })}
            hitSlop={8}
            style={({ pressed }) => [styles.gear, pressed && styles.pressed]}
          >
            <GearIcon size={26} color={colors.text} />
          </Pressable>
        }
      />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.profileRow}>
          <Pressable accessibilityRole="button" accessibilityLabel="프로필 사진 변경" onPress={changePhoto} style={styles.avatarWrap}>
            <Avatar uri={profile.avatarUri ?? defaultAvatar} size={AVATAR_SIZE} />
            <View style={styles.cameraBadge}>
              <Text style={styles.cameraGlyph}>📷</Text>
            </View>
          </Pressable>
          <View style={styles.nameBox}>
            <Text style={styles.nickname} numberOfLines={1}>
              {profile.nickname}
            </Text>
            <Text style={styles.nameHint}>함께한 순간을 기록하는 중</Text>
          </View>
        </View>

        <View style={styles.statCard}>
          <Text style={styles.statLabel}>참여한 모임</Text>
          <Text style={styles.statValue}>{TRIPS.length}개</Text>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="닉네임 변경"
          onPress={() => setEditingName(true)}
          style={({ pressed }) => [styles.button, pressed && styles.pressed]}
        >
          <Text style={styles.buttonText}>닉네임 변경</Text>
        </Pressable>
      </ScrollView>

      {/* 화면 맨 아래: 공지사항 · 고객센터. 두 화면은 아직 없어 누르면 준비 중 안내만 한다. */}
      <View style={styles.footer}>
        <Pressable accessibilityRole="button" accessibilityLabel="공지사항" onPress={() => toast.show('공지사항은 아직 준비 중이에요')} style={styles.footerItem}>
          <Text style={styles.footerText}>공지사항</Text>
        </Pressable>
        <View style={styles.footerDivider} />
        <Pressable accessibilityRole="button" accessibilityLabel="고객센터" onPress={() => toast.show('고객센터는 아직 준비 중이에요')} style={styles.footerItem}>
          <Text style={styles.footerText}>고객센터</Text>
        </Pressable>
      </View>

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

/** 프로필 사진 지름(px). */
const AVATAR_SIZE = 96;

const styles = StyleSheet.create({
  content: { paddingHorizontal: GUTTER, paddingTop: 12, paddingBottom: 32, gap: 16 },
  footer: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bg, paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#F2F4F6' },
  footerItem: { flex: 1, minHeight: MIN_TOUCH + 8, alignItems: 'center', justifyContent: 'center' },
  footerDivider: { width: 1, height: 24, backgroundColor: '#F2F4F6' },
  footerText: { fontSize: 17, fontWeight: '800', color: colors.text },
  gear: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22 },
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  avatarWrap: { width: AVATAR_SIZE, height: AVATAR_SIZE },
  cameraBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraGlyph: { fontSize: 15 },
  nameBox: { flex: 1, gap: 4 },
  nickname: { fontSize: 22, fontWeight: '800', color: colors.text },
  nameHint: { fontSize: 13, color: colors.textSub },

  statCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    paddingVertical: 22,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statLabel: { fontSize: 15, fontWeight: '700', color: colors.textSub },
  statValue: { fontSize: 22, fontWeight: '800', color: colors.text },

  button: {
    minHeight: MIN_TOUCH,
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: { fontSize: 14, fontWeight: '700', color: colors.text },
  pressed: { opacity: 0.85 },
});
