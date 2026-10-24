import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius } from '../styles/tokens';

interface Props {
  visible: boolean;
  /** 지금 직접 고른 사진이 있으면 true("기본 이미지로 되돌리기"를 보여준다) */
  hasCustom: boolean;
  onPick: () => void;
  onReset: () => void;
  onClose: () => void;
}

/** 일정 대표(배경) 사진을 바꾸는 선택 시트: 앨범에서 고르기 / 기본 이미지로 되돌리기. */
export function CoverEditSheet({ visible, hasCustom, onPick, onReset, onClose }: Props) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable accessibilityRole="button" accessibilityLabel="닫기" onPress={onClose} style={styles.backdrop} />
      <View style={styles.sheet}>
        <View style={styles.handle} />
        <Text style={styles.title}>배경 사진</Text>
        <Pressable accessibilityRole="button" onPress={onPick} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
          <Text style={styles.rowText}>🖼️  앨범에서 사진 고르기</Text>
        </Pressable>
        {hasCustom ? (
          <Pressable accessibilityRole="button" onPress={onReset} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
            <Text style={styles.rowText}>↺  기본 이미지로 되돌리기</Text>
          </Pressable>
        ) : null}
        <Pressable accessibilityRole="button" onPress={onClose} style={({ pressed }) => [styles.row, styles.cancel, pressed && styles.pressed]}>
          <Text style={styles.cancelText}>취소</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: radius.card,
    borderTopRightRadius: radius.card,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 28,
    gap: 8,
  },
  handle: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, backgroundColor: colors.line, marginBottom: 4 },
  title: { fontSize: 16, fontWeight: '900', color: colors.text, marginBottom: 4 },
  row: { minHeight: 52, borderRadius: radius.button, backgroundColor: colors.surface, justifyContent: 'center', paddingHorizontal: 16 },
  rowText: { fontSize: 15, fontWeight: '700', color: colors.text },
  cancel: { alignItems: 'center', backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.line },
  cancelText: { fontSize: 15, fontWeight: '700', color: colors.textSub },
  pressed: { opacity: 0.85 },
});
