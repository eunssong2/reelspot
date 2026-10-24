import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius } from '../prototype/styles/tokens';

interface Props {
  visible: boolean;
  title: string;
  message: string;
  /** 확인(주요) 버튼 이름 */
  confirmLabel?: string;
  /** 있으면 취소 버튼도 보여준다. 없으면 확인 버튼만 있는 안내창이다. */
  cancelLabel?: string;
  /** 확인 버튼이 위험한 동작(삭제·초기화)일 때 true */
  destructive?: boolean;
  onConfirm: () => void;
  onCancel?: () => void;
}

/**
 * 안내·확인 창. Alert.alert 는 웹에서 동작하지 않고 모양도 기기마다 달라서, 앱 안에서 직접 그린다.
 * (Android 뒤로 가기는 취소/닫기로 처리한다.)
 */
export function NoticeModal({ visible, title, message, confirmLabel = '확인', cancelLabel, destructive, onConfirm, onCancel }: Props) {
  const close = onCancel ?? onConfirm;
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close} statusBarTranslucent>
      <View style={styles.backdrop}>
        <View style={styles.card} accessibilityViewIsModal>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
          <View style={styles.actions}>
            {cancelLabel ? (
              <Pressable accessibilityRole="button" onPress={close} style={[styles.btn, styles.btnGhost]}>
                <Text style={styles.btnGhostText}>{cancelLabel}</Text>
              </Pressable>
            ) : null}
            <Pressable
              accessibilityRole="button"
              onPress={onConfirm}
              style={[styles.btn, destructive ? styles.btnDanger : styles.btnPrimary]}
            >
              <Text style={styles.btnPrimaryText}>{confirmLabel}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: 28 },
  card: { width: '100%', maxWidth: 360, backgroundColor: colors.bg, borderRadius: radius.card, padding: 22, gap: 10 },
  title: { fontSize: 17, fontWeight: '900', color: colors.text },
  message: { fontSize: 14, lineHeight: 21, color: colors.textSub },
  actions: { flexDirection: 'row', gap: 10, marginTop: 8 },
  btn: { flex: 1, minHeight: 48, borderRadius: radius.button, alignItems: 'center', justifyContent: 'center' },
  btnPrimary: { backgroundColor: colors.primary },
  btnDanger: { backgroundColor: colors.danger },
  btnGhost: { backgroundColor: colors.surface },
  btnPrimaryText: { fontSize: 15, fontWeight: '800', color: colors.onPrimary },
  btnGhostText: { fontSize: 15, fontWeight: '700', color: colors.textSub },
});
