import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { colors, MIN_TOUCH, radius } from '../styles/tokens';

/** 닉네임 최대 글자 수. */
export const NICKNAME_MAX = 12;

interface Props {
  visible: boolean;
  initial: string;
  onSave: (nickname: string) => void;
  onClose: () => void;
}

/** 닉네임 변경 창. 공백만 있는 값은 저장할 수 없다. */
export function NicknameEditModal({ visible, initial, onSave, onClose }: Props) {
  const [draft, setDraft] = useState(initial);
  // 창을 열 때마다 현재 닉네임으로 시작한다.
  useEffect(() => {
    if (visible) setDraft(initial);
  }, [visible, initial]);

  const canSave = draft.trim().length > 0;
  const save = () => {
    if (canSave) onSave(draft.trim());
  };

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable accessibilityRole="button" accessibilityLabel="닫기" onPress={onClose} style={styles.backdrop} />
        <View style={styles.sheet}>
          <Text style={styles.title}>닉네임 변경</Text>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            maxLength={NICKNAME_MAX}
            autoFocus
            placeholder="닉네임을 입력하세요"
            placeholderTextColor={colors.textMuted}
            onSubmitEditing={save}
            returnKeyType="done"
            style={styles.input}
          />
          <Text style={styles.counter}>
            {draft.length}/{NICKNAME_MAX}
          </Text>
          <View style={styles.buttons}>
            <Pressable accessibilityRole="button" onPress={onClose} style={[styles.btn, styles.btnCancel]}>
              <Text style={styles.btnCancelText}>취소</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: !canSave }}
              disabled={!canSave}
              onPress={save}
              style={[styles.btn, canSave ? styles.btnOn : styles.btnOff]}
            >
              <Text style={canSave ? styles.btnOnText : styles.btnOffText}>저장</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: { backgroundColor: colors.bg, width: '100%', maxWidth: 430, alignSelf: 'center', borderTopLeftRadius: radius.card, borderTopRightRadius: radius.card, padding: 20, gap: 10 },
  title: { fontSize: 17, fontWeight: '800', color: colors.text },
  input: {
    minHeight: MIN_TOUCH - 4,
    backgroundColor: colors.surface,
    borderRadius: radius.button,
    paddingHorizontal: 16,
    fontSize: 16,
    color: colors.text,
  },
  counter: { fontSize: 12, color: colors.textMuted, textAlign: 'right' },
  buttons: { flexDirection: 'row', gap: 10, marginTop: 4 },
  btn: { flex: 1, minHeight: MIN_TOUCH - 4, borderRadius: radius.button, alignItems: 'center', justifyContent: 'center' },
  btnCancel: { backgroundColor: colors.surface },
  btnCancelText: { fontSize: 16, fontWeight: '700', color: colors.textSub },
  btnOn: { backgroundColor: colors.primary },
  btnOnText: { fontSize: 16, fontWeight: '700', color: colors.onPrimary },
  btnOff: { backgroundColor: colors.primarySoft },
  btnOffText: { fontSize: 16, fontWeight: '700', color: colors.primary },
});
