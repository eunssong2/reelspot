import { useState } from 'react';
import { KeyboardAvoidingView, Linking, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { NoticeModal } from '../../demo/NoticeModal';
import { AppHeader } from '../components/AppHeader';
import { ScreenFrame } from '../components/ScreenFrame';
import { Toast, useToast } from '../components/Toast';
import type { Nav } from '../navigation/routes';
import { useGroups } from '../state/GroupsProvider';
import { colors, GUTTER, MIN_TOUCH, radius } from '../styles/tokens';

const TERMS = ['서비스 이용약관', '개인정보 처리방침', '위치정보 이용약관', '서비스 이용정책'];
const INVITE_CODE_MAX = 12;

/** 설정: 프로필 및 계정 · 초대코드 입력 · 위치 서비스 · 서비스 약관 · 로그아웃 · 서비스 탈퇴. */
export function SettingsScreen({ nav }: { nav: Nav }) {
  const toast = useToast();
  const { logout } = useGroups();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [confirm, setConfirm] = useState<'logout' | 'withdraw' | null>(null);

  const openLocationSettings = async () => {
    try {
      await Linking.openSettings();
    } catch {
      toast.show('기기 설정에서 위치 권한을 바꿔 주세요');
    }
  };

  const submitInvite = () => {
    if (!inviteCode.trim()) return;
    const code = inviteCode.trim();
    setInviteOpen(false);
    setInviteCode('');
    // 초대 확인·참여 화면(UI24)에서 코드를 확인한 뒤 참여한다.
    nav.push({ name: 'inviteJoin', code });
  };

  return (
    <ScreenFrame>
      <AppHeader title="설정" onBack={nav.back} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Row title="프로필 및 계정" big onPress={() => nav.push({ name: 'account' })} />

        <SectionTitle>친구초대</SectionTitle>
        <Row title="초대코드 입력" onPress={() => setInviteOpen(true)} />

        <SectionTitle>서비스 설정</SectionTitle>
        <Row title="위치 서비스" value="기기 설정에서 변경" onPress={openLocationSettings} />

        <SectionTitle>서비스 약관</SectionTitle>
        {TERMS.map((t) => (
          <Row key={t} title={t} onPress={() => toast.show('약관 내용은 아직 준비 중이에요')} />
        ))}

        <Pressable accessibilityRole="button" onPress={() => setConfirm('logout')} style={styles.plainRow}>
          <Text style={styles.plainText}>로그아웃</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={() => setConfirm('withdraw')} style={styles.plainRow}>
          <Text style={styles.plainText}>서비스 탈퇴</Text>
        </Pressable>
      </ScrollView>

      {/* 초대코드 입력 창 */}
      <Modal visible={inviteOpen} animationType="fade" transparent onRequestClose={() => setInviteOpen(false)}>
        <KeyboardAvoidingView style={styles.modalRoot} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Pressable accessibilityRole="button" accessibilityLabel="닫기" onPress={() => setInviteOpen(false)} style={styles.backdrop} />
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>초대코드 입력</Text>
            <TextInput
              value={inviteCode}
              onChangeText={setInviteCode}
              maxLength={INVITE_CODE_MAX}
              autoFocus
              autoCapitalize="characters"
              placeholder="친구에게 받은 코드를 입력하세요"
              placeholderTextColor={colors.textMuted}
              onSubmitEditing={submitInvite}
              style={styles.input}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: !inviteCode.trim() }}
              disabled={!inviteCode.trim()}
              onPress={submitInvite}
              style={[styles.sheetBtn, inviteCode.trim() ? styles.sheetBtnOn : styles.sheetBtnOff]}
            >
              <Text style={inviteCode.trim() ? styles.sheetBtnOnText : styles.sheetBtnOffText}>참여하기</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* 로그아웃·탈퇴 확인. 로그아웃은 프로토타입 로그인으로 돌아가고, 탈퇴는 아직 안내만 한다. */}
      <NoticeModal
        visible={confirm !== null}
        title={confirm === 'withdraw' ? '서비스 탈퇴' : '로그아웃'}
        message={confirm === 'withdraw' ? '탈퇴하면 내 기록을 되돌릴 수 없어요. 정말 탈퇴할까요?' : '로그아웃할까요?'}
        confirmLabel={confirm === 'withdraw' ? '탈퇴' : '로그아웃'}
        cancelLabel="취소"
        destructive={confirm === 'withdraw'}
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          const which = confirm;
          setConfirm(null);
          if (which === 'logout') {
            // 프로토타입 로그인(UI01)으로 돌아간다.
            logout();
            nav.home();
            return;
          }
          toast.show('탈퇴는 계정 삭제 화면(UI30)이 연결되면 동작해요');
        }}
      />
      <Toast message={toast.message} bottom={24} />
    </ScreenFrame>
  );
}

function SectionTitle({ children }: { children: string }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

function Row({ title, value, big, onPress }: { title: string; value?: string; big?: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <Text style={big ? styles.rowTitleBig : styles.rowTitle}>{title}</Text>
      <View style={styles.rowRight}>
        {value ? <Text style={styles.rowValue}>{value}</Text> : <Text style={styles.chevron}>›</Text>}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: GUTTER, paddingTop: 8, paddingBottom: 40 },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: colors.text, marginTop: 30, marginBottom: 4 },
  row: {
    minHeight: MIN_TOUCH,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  pressed: { opacity: 0.6 },
  rowTitle: { fontSize: 16, color: colors.text },
  rowTitleBig: { fontSize: 18, fontWeight: '800', color: colors.text },
  rowRight: { flexDirection: 'row', alignItems: 'center' },
  rowValue: { fontSize: 14, color: '#3B8EEA' },
  chevron: { fontSize: 26, color: colors.textMuted, lineHeight: 28 },
  plainRow: { minHeight: MIN_TOUCH, justifyContent: 'center', marginTop: 8 },
  plainText: { fontSize: 18, fontWeight: '600', color: colors.text },

  modalRoot: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: { backgroundColor: colors.bg, width: '100%', maxWidth: 430, alignSelf: 'center', borderTopLeftRadius: radius.card, borderTopRightRadius: radius.card, padding: 20, gap: 12 },
  sheetTitle: { fontSize: 17, fontWeight: '800', color: colors.text },
  input: { minHeight: MIN_TOUCH - 4, backgroundColor: colors.surface, borderRadius: radius.button, paddingHorizontal: 16, fontSize: 16, color: colors.text },
  sheetBtn: { minHeight: MIN_TOUCH - 4, borderRadius: radius.button, alignItems: 'center', justifyContent: 'center' },
  sheetBtnOn: { backgroundColor: colors.primary },
  sheetBtnOnText: { fontSize: 16, fontWeight: '700', color: colors.onPrimary },
  sheetBtnOff: { backgroundColor: colors.primarySoft },
  sheetBtnOffText: { fontSize: 16, fontWeight: '700', color: colors.primary },
});
