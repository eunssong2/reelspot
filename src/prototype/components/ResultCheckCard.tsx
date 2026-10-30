import { StyleSheet, Text, View } from 'react-native';

import { colors, radius } from '../styles/tokens';
import { ActionButton } from './FormParts';

/**
 * 응답이 끊겨 저장 결과를 모를 때(UI35 패턴). 실패로 단정하지 않고,
 * 같은 요청 키로 서버의 처리 결과를 확인한다. 내용을 다시 만들지 않는다.
 */
export function ResultCheckCard({ requestId, onCheck, checking }: { requestId: string; onCheck: () => void; checking: boolean }) {
  return (
    <View style={styles.card} accessibilityLiveRegion="polite">
      <Text style={styles.title}>저장 결과를 확인 중이에요</Text>
      <Text style={styles.body}>요청은 접수됐을 수 있어요. 내용을 다시 만들지 않고 확인할게요.</Text>
      <ActionButton label="같은 요청 결과 확인" tone="secondary" onPress={onCheck} loading={checking} />
      <Text style={styles.ref}>문의용 번호 {requestId.toUpperCase()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.primarySoft, borderRadius: radius.item, padding: 16, gap: 8 },
  title: { fontSize: 16, fontWeight: '800', color: colors.text },
  body: { fontSize: 13, lineHeight: 19, color: colors.textSub },
  ref: { fontSize: 11, color: colors.textMuted },
});
