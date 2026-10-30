import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useGroups, type Scenario } from '../state/GroupsProvider';
import { colors, GUTTER, radius, shadow } from '../styles/tokens';
import { ActionButton } from './FormParts';

const GROUPS: { title: string; items: { key: keyof Scenario; label: string; hint: string }[] }[] = [
  {
    title: '공통',
    items: [
      { key: 'offline', label: '인터넷 끊김', hint: '모든 조회·저장이 오프라인으로 실패' },
      { key: 'slow', label: '느린 응답', hint: '응답이 2초 넘게 걸려 로딩 표시 확인' },
      { key: 'loadFail', label: '조회 실패', hint: '모임 목록·달력·초대·동의 문서를 못 불러옴' },
    ],
  },
  {
    title: '로그인(UI01)',
    items: [
      { key: 'authCancel', label: '인증 창 닫음', hint: '안내 없이 원래 상태로' },
      { key: 'authFail', label: '인증 실패', hint: '로그인하지 못했어요' },
      { key: 'providerDown', label: '로그인 서비스 장애', hint: '카카오·Google 장애 안내' },
    ],
  },
  {
    title: '입력·저장',
    items: [
      { key: 'textRejected', label: '공개 전 검사 거부', hint: '표시명·모임 이름·일정 제목' },
      { key: 'consentChanged', label: '동의 문서 변경 (한 번)', hint: '가입 제출 때 개인정보 문서 새 버전' },
      { key: 'unknownResult', label: '응답 유실 (한 번)', hint: '모임 만들기: 결과 확인 중 → 같은 요청 결과 확인' },
      { key: 'conflict', label: '동시 수정 충돌 (한 번)', hint: '일정 변경 저장·초대 취소' },
      { key: 'groupLimit', label: '모임 100개 한도', hint: '모임 만들기·초대 참여 거부' },
      { key: 'ownerLimit', label: '방장 모임 20개 한도', hint: '모임 만들기 거부' },
    ],
  },
];

/**
 * 프로토타입 전용 "예시 상황" 패널. 화면 오른쪽 손잡이를 누르면 열린다.
 * 명세 8장의 오류·로딩 상태를 실제로 띄워 보기 위한 도구이며 실제 앱에는 없다.
 */
export function ScenarioPanel() {
  const { scenario, setScenario, retryRestore } = useGroups();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const activeCount = Object.values(scenario).filter(Boolean).length;

  const restart = () => {
    setOpen(false);
    if (router.canDismiss()) router.dismissTo('/prototype');
    retryRestore();
  };

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`예시 상황 열기${activeCount ? `, ${activeCount}개 켜짐` : ''}`}
        style={[styles.handle, activeCount > 0 && styles.handleOn]}
      >
        <Text style={styles.handleGlyph}>🧪</Text>
        {activeCount ? <Text style={styles.handleCount}>{activeCount}</Text> : null}
      </Pressable>

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)} accessibilityLabel="닫기" />
        <View style={[styles.sheet, { paddingBottom: 16 + insets.bottom }]}>
          <View style={styles.sheetHead}>
            <View style={styles.flex}>
              <Text style={styles.title}>예시 상황</Text>
              <Text style={styles.sub}>프로토타입 전용 · 오류·로딩 화면을 바로 확인해요</Text>
            </View>
            <Pressable onPress={() => setOpen(false)} accessibilityRole="button" accessibilityLabel="닫기" style={styles.close}>
              <Text style={styles.closeGlyph}>✕</Text>
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.list}>
            {GROUPS.map((g) => (
              <View key={g.title} style={styles.group}>
                <Text style={styles.groupTitle}>{g.title}</Text>
                {g.items.map((item) => (
                  <View key={item.key} style={styles.row}>
                    <View style={styles.flex}>
                      <Text style={styles.label}>{item.label}</Text>
                      <Text style={styles.hint}>{item.hint}</Text>
                    </View>
                    <Switch
                      value={scenario[item.key]}
                      onValueChange={(v) => setScenario({ [item.key]: v })}
                      trackColor={{ true: colors.primary, false: colors.surfaceStrong }}
                      thumbColor={colors.bg}
                      // 웹(react-native-web)은 켜진 손잡이 색을 따로 받는다
                      {...({ activeThumbColor: colors.bg } as object)}
                      accessibilityLabel={item.label}
                    />
                  </View>
                ))}
              </View>
            ))}
            <Text style={styles.note}>
              (한 번) 표시는 다음 요청 한 번만 적용되고 저절로 꺼져요. 다시 시도하면 성공하는 흐름을 볼 수 있어요.
            </Text>
          </ScrollView>
          <View style={styles.actions}>
            <ActionButton
              label="모두 끄기"
              tone="secondary"
              onPress={() => setScenario(Object.fromEntries(Object.keys(scenario).map((k) => [k, false])) as Partial<Scenario>)}
              style={styles.flex}
            />
            <ActionButton
              label="앱 다시 시작"
              onPress={restart}
              style={styles.flex}
              accessibilityLabel="앱 다시 시작(세션 복원 스플래시 보기)"
            />
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  handle: {
    position: 'absolute',
    right: 0,
    top: '42%',
    width: 22,
    minHeight: 48,
    opacity: 0.7,
    borderTopLeftRadius: 12,
    borderBottomLeftRadius: 12,
    backgroundColor: 'rgba(35,39,47,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    zIndex: 100,
  },
  handleOn: { backgroundColor: colors.primary },
  handleGlyph: { fontSize: 12 },
  handleCount: { fontSize: 11, fontWeight: '800', color: colors.onPrimary },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(25,31,40,0.4)' },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: '85%',
    alignSelf: 'center',
    width: '100%',
    maxWidth: 430,
    backgroundColor: colors.bg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 18,
    boxShadow: shadow.float,
  },
  sheetHead: { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: GUTTER, gap: 8 },
  title: { fontSize: 19, fontWeight: '800', color: colors.text },
  sub: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  close: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  closeGlyph: { fontSize: 18, color: colors.textSub },
  list: { paddingHorizontal: GUTTER, paddingVertical: 12, gap: 14 },
  group: { backgroundColor: colors.surface, borderRadius: radius.item, padding: 12, gap: 4 },
  groupTitle: { fontSize: 12, fontWeight: '800', color: colors.textSub, marginBottom: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 48 },
  label: { fontSize: 14, fontWeight: '700', color: colors.text },
  hint: { fontSize: 12, color: colors.textMuted, marginTop: 1 },
  note: { fontSize: 12, lineHeight: 18, color: colors.textMuted },
  actions: { flexDirection: 'row', gap: 10, paddingHorizontal: GUTTER, paddingTop: 8 },
});
