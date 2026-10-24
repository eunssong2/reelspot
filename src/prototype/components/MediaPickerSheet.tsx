import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, radius } from '../styles/tokens';

/** "+ 추가" 바텀시트에서 고를 수 있는 항목. 실제 선택·촬영은 화면(PlaceRecordsScreen)이 처리한다. */
export type MediaPickerAction = 'library-photo' | 'library-video' | 'camera-photo' | 'camera-video';

interface MenuItem {
  action: MediaPickerAction;
  icon: string;
  label: string;
}

const MENU_ITEMS: MenuItem[] = [
  { action: 'library-photo', icon: '🖼️', label: '사진 보관함에서 선택' },
  { action: 'library-video', icon: '🎞️', label: '동영상 보관함에서 선택' },
  { action: 'camera-photo', icon: '📷', label: '사진 촬영' },
  { action: 'camera-video', icon: '🎥', label: '동영상 촬영' },
];

interface Props {
  visible: boolean;
  onSelect: (action: MediaPickerAction) => void;
  onCancel: () => void;
}

/**
 * "내 순간 올리기"의 "+ 추가"를 누르면 아래에서 올라오는 메뉴.
 * 사진·동영상을 보관함에서 고르거나 카메라로 바로 찍을 수 있다 — 이 컴포넌트는 메뉴 표시와
 * 바깥/취소 탭으로 닫는 것까지만 맡고, 실제 피커·카메라 호출은 onSelect 를 받은 화면이 한다.
 */
export function MediaPickerSheet({ visible, onSelect, onCancel }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <Pressable accessibilityRole="button" accessibilityLabel="닫기" onPress={onCancel} style={styles.backdrop} />

      <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 12) + 8 }]}>
        <View style={styles.handle} />

        <View style={styles.group}>
          {MENU_ITEMS.map((item, index) => (
            <Pressable
              key={item.action}
              accessibilityRole="button"
              accessibilityLabel={item.label}
              onPress={() => onSelect(item.action)}
              style={({ pressed }) => [
                styles.row,
                index < MENU_ITEMS.length - 1 && styles.rowDivider,
                pressed && styles.rowPressed,
              ]}
            >
              <Text style={styles.rowIcon}>{item.icon}</Text>
              <Text style={styles.rowLabel}>{item.label}</Text>
            </Pressable>
          ))}
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="취소"
          onPress={onCancel}
          style={({ pressed }) => [styles.cancel, pressed && styles.rowPressed]}
        >
          <Text style={styles.cancelLabel}>취소</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: radius.card,
    borderTopRightRadius: radius.card,
    paddingHorizontal: 16,
    paddingTop: 10,
    gap: 10,
  },
  handle: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, backgroundColor: colors.line, marginBottom: 2 },
  group: { borderRadius: 16, overflow: 'hidden', backgroundColor: colors.bg },
  // 손가락으로 편하게 누르도록 각 줄 최소 52px.
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52, paddingHorizontal: 14, backgroundColor: colors.bg },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: colors.line },
  rowPressed: { backgroundColor: colors.surface },
  rowIcon: { fontSize: 20, width: 24, textAlign: 'center' },
  rowLabel: { fontSize: 15, fontWeight: '600', color: colors.text },
  cancel: { minHeight: 52, borderRadius: 16, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  cancelLabel: { fontSize: 15, fontWeight: '700', color: colors.text },
});
