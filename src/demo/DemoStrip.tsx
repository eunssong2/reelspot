import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, GUTTER } from '../prototype/styles/tokens';
import { NoticeModal } from './NoticeModal';

interface Props {
  /** 있으면 "데모 초기화" 버튼을 보여준다(일정 요약 화면에서만 넘긴다). */
  onReset?: () => void;
}

/**
 * 데모(테스트 앱) 표시 띠. 기존 서비스 화면과 구분되도록 모든 프로토타입 화면 맨 위에 붙는다.
 * 예시 데이터로 체험 중이라는 것과, 로그인·업로드가 팀원 구현 영역임을 알린다.
 */
export function DemoStrip({ onReset }: Props) {
  const [confirming, setConfirming] = useState(false);

  return (
    <View style={styles.strip}>
      <View style={styles.badge}>
        <Text style={styles.badgeText}>TEST</Text>
      </View>
      <Text style={styles.text} numberOfLines={1}>
        예시 데이터로 체험 중이에요
      </Text>
      {onReset ? (
        <Pressable accessibilityRole="button" accessibilityLabel="데모 초기화" onPress={() => setConfirming(true)} hitSlop={8} style={styles.reset}>
          <Text style={styles.resetText}>↺ 데모 초기화</Text>
        </Pressable>
      ) : null}
      <NoticeModal
        visible={confirming}
        title="데모 초기화"
        message="추가한 장소와 순서 변경이 모두 지워지고, 예시 데이터가 처음 상태로 돌아갑니다."
        confirmLabel="초기화"
        cancelLabel="취소"
        destructive
        onConfirm={() => {
          setConfirming(false);
          onReset?.();
        }}
        onCancel={() => setConfirming(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  strip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: GUTTER,
    paddingVertical: 6,
    backgroundColor: colors.ink,
  },
  badge: { backgroundColor: colors.primary, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 1 },
  badgeText: { color: colors.onPrimary, fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },
  text: { flex: 1, color: '#fff', fontSize: 12, fontWeight: '600' },
  reset: { paddingVertical: 2, paddingHorizontal: 4 },
  resetText: { color: '#fff', fontSize: 12, fontWeight: '800', textDecorationLine: 'underline' },
});
