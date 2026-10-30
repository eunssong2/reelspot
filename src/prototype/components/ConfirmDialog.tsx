import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, GUTTER, radius, shadow } from '../styles/tokens';
import { ActionButton } from './FormParts';

export interface DialogButton {
  label: string;
  onPress: () => void;
  /** danger: 되돌릴 수 없는 동작(빨강) */
  tone?: 'primary' | 'danger' | 'plain';
  loading?: boolean;
}

interface Props {
  visible: boolean;
  title: string;
  /** 제목 아래 작은 글씨(대상 이름 등) */
  subtitle?: string;
  body?: string;
  /** 위에서부터 차례로 쌓인다. 마지막 버튼이 가장 안전한 선택(돌아가기·계속 편집)이 되게 넘긴다. */
  buttons: DialogButton[];
  /** 바깥 탭·시스템 뒤로가기. 보통 가장 안전한 선택과 같다. */
  onRequestClose: () => void;
  /** 경고 기호를 제목 옆에 둔다 */
  warning?: boolean;
}

/** D3 확인창: 화면 아래에서 올라오는 카드. 디자인 UI06 의 취소 확인창을 따른다. */
export function ConfirmDialog({ visible, title, subtitle, body, buttons, onRequestClose, warning }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onRequestClose}>
      <Pressable style={styles.backdrop} onPress={onRequestClose} accessibilityLabel="닫기" />
      <View style={styles.wrap} pointerEvents="box-none">
        <View style={styles.card} accessibilityViewIsModal>
          <View style={styles.head}>
            {warning ? (
              <View style={styles.warn}>
                <Text style={styles.warnGlyph}>!</Text>
              </View>
            ) : null}
            <View style={styles.headText}>
              <Text style={styles.title}>{title}</Text>
              {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
            </View>
          </View>
          {body ? <Text style={styles.body}>{body}</Text> : null}
          <View style={styles.buttons}>
            {buttons.map((b) => (
              <ActionButton
                key={b.label}
                label={b.label}
                onPress={b.onPress}
                loading={b.loading}
                tone={b.tone === 'danger' ? 'danger' : b.tone === 'plain' ? 'secondary' : 'primary'}
                style={styles.button}
              />
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(25,31,40,0.4)' },
  wrap: { flex: 1, justifyContent: 'flex-end', alignItems: 'center', padding: GUTTER, paddingBottom: 28 },
  card: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: colors.bg,
    borderRadius: radius.card,
    padding: 20,
    gap: 14,
    boxShadow: shadow.float,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  warn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#FDE7E9', alignItems: 'center', justifyContent: 'center' },
  warnGlyph: { fontSize: 20, fontWeight: '900', color: colors.danger },
  headText: { flex: 1, gap: 2 },
  title: { fontSize: 18, fontWeight: '800', color: colors.text },
  subtitle: { fontSize: 12, color: colors.textMuted },
  body: { fontSize: 15, lineHeight: 23, color: colors.textSub },
  buttons: { gap: 8, marginTop: 2 },
  button: { minHeight: 50 },
});
