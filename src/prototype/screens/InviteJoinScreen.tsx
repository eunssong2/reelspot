import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { AppHeader } from '../components/AppHeader';
import { ActionButton, ErrorText, NoteBox, Pill } from '../components/FormParts';
import { ScreenFrame } from '../components/ScreenFrame';
import { INVITE_CODE_LENGTH, normalizeInviteCode } from '../mock/groupData';
import type { Nav } from '../navigation/routes';
import { newRequestKey, useGroups, type InviteError, type InvitePreview } from '../state/GroupsProvider';
import { colors, GUTTER, radius } from '../styles/tokens';
import { diffDays, isWithin, periodLabel, todayKst } from '../utils/calendar';

const ERROR_TEXT: Record<InviteError, string> = {
  INVITE_INVALID: '초대 코드가 맞지 않아요. 다시 확인해 주세요.',
  INVITE_EXPIRED: '기한(7일)이 지난 초대예요. 초대한 사람에게 새 초대를 받아 주세요.',
  INVITE_EXHAUSTED: '확인 횟수(50회)를 모두 쓴 초대예요. 새 초대를 받아 주세요.',
  INVITE_REVOKED: '취소된 초대예요. 새 초대를 받아 주세요.',
  GROUP_CLOSED: '종료된 모임이에요.',
  CAPACITY_FULL: '모임 정원(10명)이 다 찼어요.',
  REENTRY_BLOCKED: '이 모임에는 다시 참여할 수 없어요.',
  GROUP_LIMIT: '참여 중인 모임이 100개라 더 참여할 수 없어요.',
  OFFLINE: '인터넷에 연결되어 있지 않아요. 연결을 확인하고 다시 시도해 주세요.',
  SERVER_ERROR: '초대를 확인하지 못했어요. 다시 시도해 주세요.',
};

/** 다시 시도해도 바뀌지 않는 거절: 보류 초대를 지우고 닫기만 남긴다. */
const FINAL: InviteError[] = ['INVITE_EXPIRED', 'INVITE_EXHAUSTED', 'INVITE_REVOKED', 'GROUP_CLOSED', 'REENTRY_BLOCKED'];

/**
 * UI24 초대 확인과 참여. 디자인: docs/stitch/UI24_초대_확인과_참여.html
 * 초대 확인 → 로그인·가입 → 참여하기. 로그인만으로 자동 참여하지 않는다.
 * 미리보기에는 모임명·일정 요약만 보이고 사진·참여자·장소·기록은 보이지 않는다.
 * 확인은 서버의 확인 횟수를 1 쓰므로, 로그인 뒤 돌아올 때는 저장해 둔 결과를 다시 쓴다.
 */
export function InviteJoinScreen({ nav, initialCode }: { nav: Nav; initialCode?: string }) {
  const { session, pendingInvite, setPendingInvite, previewInvite, joinInvite, setFlash } = useGroups();
  const loggedIn = Boolean(session?.onboarded);
  const [code, setCode] = useState(pendingInvite?.code ?? normalizeInviteCode(initialCode ?? ''));
  const [preview, setPreview] = useState<InvitePreview | null>(pendingInvite);
  const [error, setError] = useState<InviteError | null>(null);
  const [busy, setBusy] = useState<null | 'check' | 'join'>(null);
  const autoChecked = useRef(false);
  /** 참여 요청 키: 응답이 끊겨 다시 눌러도 참여가 한 번만 처리된다. */
  const joinKey = useRef(newRequestKey());

  const check = async (value = code) => {
    setBusy('check');
    setError(null);
    setPreview(null);
    try {
      const result = await previewInvite(value);
      if (result.ok) setPreview(result.preview);
      else setError(result.error);
    } finally {
      setBusy(null);
    }
  };

  // 링크로 열었으면(코드가 넘어왔으면) 바로 확인한다. 로그인 뒤 복귀는 저장된 결과를 쓰므로 다시 부르지 않는다.
  useEffect(() => {
    if (autoChecked.current || pendingInvite || !initialCode) return;
    autoChecked.current = true;
    check(normalizeInviteCode(initialCode));
  }, []); // 처음 한 번만

  const close = () => {
    setPendingInvite(null);
    nav.back();
  };

  const continueWithLogin = () => {
    if (!preview) return;
    setPendingInvite(preview);
    nav.home();
  };

  const join = async () => {
    if (!preview) return;
    setBusy('join');
    setError(null);
    try {
      const result = await joinInvite(preview.code, joinKey.current);
      if (!result.ok) {
        setError(result.error);
        if (FINAL.includes(result.error)) setPendingInvite(null);
        return;
      }
      setPendingInvite(null);
      setFlash(result.alreadyMember ? '이미 참여 중인 모임이에요' : `'${preview.groupName}'에 참여했어요`);
      nav.replace({ name: 'groupCalendar', groupId: result.groupId });
    } finally {
      setBusy(null);
    }
  };

  const final = error !== null && FINAL.includes(error);
  const today = todayKst();
  const sc = preview?.schedule;
  const dday = sc
    ? isWithin(today, sc.startDate, sc.endDate)
      ? '진행 중'
      : sc.startDate > today
        ? `D-${diffDays(today, sc.startDate)}`
        : null
    : null;

  return (
    <ScreenFrame>
      <AppHeader title="초대 확인" onBack={close} />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.badges}>
            <Pill label="✉️ 초대장 확인" tone="coral" />
            {preview ? <Pill label="코드 확인 완료" /> : null}
          </View>
          <Text style={styles.title}>{preview ? '모임에 초대받았어요!' : '초대 코드를 입력해 주세요'}</Text>
          <Text style={styles.sub}>초대 코드를 확인하고 모임에 참여해 보세요.</Text>

          <View style={styles.codeField}>
            <View style={styles.codeLabelRow}>
              <Text style={styles.codeLabel}>초대 코드</Text>
              {code.length === INVITE_CODE_LENGTH ? <Text style={styles.codeOk}>✓ 코드 형식이 맞아요</Text> : null}
            </View>
            <View style={styles.codeInputWrap}>
              <Text style={styles.key}>🔑</Text>
              <TextInput
                value={code}
                onChangeText={(v) => {
                  setCode(normalizeInviteCode(v));
                  setError(null);
                  if (preview) {
                    setPreview(null);
                    setPendingInvite(null);
                  }
                }}
                placeholder="8자리 코드"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="characters"
                autoCorrect={false}
                style={styles.codeInput}
                editable={busy === null}
                accessibilityLabel="8자리 초대 코드"
                onSubmitEditing={() => code.length === INVITE_CODE_LENGTH && check()}
                returnKeyType="search"
              />
              {code ? (
                <Pressable
                  onPress={() => {
                    setCode('');
                    setPreview(null);
                    setError(null);
                    setPendingInvite(null);
                  }}
                  accessibilityLabel="코드 지우기"
                  style={styles.clear}
                >
                  <Text style={styles.clearGlyph}>✕</Text>
                </Pressable>
              ) : null}
            </View>
            <View style={styles.codeFoot}>
              <Text style={styles.codeHint}>영문 대문자와 숫자 8자리</Text>
              <Text style={styles.codeHint}>
                {code.length} / {INVITE_CODE_LENGTH}
              </Text>
            </View>
            {!preview ? (
              <ActionButton
                label="확인"
                tone="secondary"
                onPress={() => check()}
                disabled={code.length !== INVITE_CODE_LENGTH}
                loading={busy === 'check'}
              />
            ) : null}
          </View>

          {error ? (
            <View style={styles.errorCard}>
              <ErrorText message={ERROR_TEXT[error]} />
            </View>
          ) : null}

          {preview ? (
            <View style={styles.preview}>
              <View style={styles.previewBar} />
              <View style={styles.previewHead}>
                <View style={styles.flex}>
                  <Text style={styles.previewEyebrow}>초대된 모임</Text>
                  <Text style={styles.previewName} numberOfLines={2}>
                    {preview.groupName}
                  </Text>
                </View>
                <Pill label="🔒 비공개 모임" />
              </View>
              <View style={styles.scheduleChip}>
                <View style={styles.scheduleIcon}>
                  <Text>📅</Text>
                </View>
                <View style={styles.flex}>
                  <Text style={styles.scheduleLabel}>일정</Text>
                  <Text style={styles.scheduleText} numberOfLines={1}>
                    {sc ? `${sc.title} · ${periodLabel(sc.startDate, sc.endDate)}` : '아직 일정이 없어요'}
                  </Text>
                </View>
                {dday ? <Pill label={dday} tone="coral" /> : null}
              </View>
              <View style={styles.shield}>
                <Text style={styles.shieldIcon}>🛡</Text>
                <View style={styles.flex}>
                  <Text style={styles.shieldTitle}>참여 후에 장소와 기록을 볼 수 있어요</Text>
                  <Text style={styles.shieldBody}>사진·참여자 목록·장소 계획은 참여한 사람에게만 보여요.</Text>
                </View>
              </View>
            </View>
          ) : null}

          <NoteBox
            lines={[
              { icon: '✅', text: '확인한 내용은 로그인 뒤에도 유지돼요.' },
              { icon: '⏱', text: '초대는 발급 후 7일 동안, 확인 50회까지 쓸 수 있어요.' },
            ]}
          />
        </ScrollView>

        <View style={styles.footer}>
          {final ? (
            <ActionButton label="닫기" tone="secondary" onPress={close} />
          ) : preview ? (
            loggedIn ? (
              <ActionButton label="모임 참여하기" trailing="→" onPress={join} loading={busy === 'join'} />
            ) : (
              <ActionButton label="로그인하고 참여 계속하기" trailing="→" onPress={continueWithLogin} />
            )
          ) : null}
          {preview && !final ? (
            <Text style={styles.footHint}>
              {loggedIn ? '참여하면 모임 달력과 기록을 바로 볼 수 있어요.' : '로그인 후 내용을 다시 확인하고 참여해요.'}
            </Text>
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </ScreenFrame>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingHorizontal: GUTTER, paddingTop: 4, paddingBottom: 24, gap: 14 },
  badges: { flexDirection: 'row', gap: 6 },
  title: { fontSize: 26, fontWeight: '800', letterSpacing: -0.6, color: colors.text },
  sub: { fontSize: 15, color: colors.textSub, marginTop: -8 },
  codeField: { gap: 8 },
  codeLabelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  codeLabel: { fontSize: 13, fontWeight: '700', color: colors.textSub },
  codeOk: { fontSize: 12, fontWeight: '700', color: colors.primary },
  codeInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.item - 4,
    paddingHorizontal: 14,
    minHeight: 60,
  },
  key: { fontSize: 18, marginRight: 10 },
  codeInput: { flex: 1, fontSize: 22, fontWeight: '800', letterSpacing: 4, color: colors.text, paddingVertical: 12 },
  clear: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceStrong,
  },
  clearGlyph: { fontSize: 12, fontWeight: '700', color: colors.textSub },
  codeFoot: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4 },
  codeHint: { fontSize: 12, color: colors.textMuted },
  errorCard: { backgroundColor: '#FDE7E9', borderRadius: radius.item - 4, padding: 14 },
  preview: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    padding: 18,
    paddingTop: 22,
    gap: 12,
    overflow: 'hidden',
  },
  previewBar: { position: 'absolute', top: 0, left: 0, right: 0, height: 6, backgroundColor: colors.primary },
  previewHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  previewEyebrow: { fontSize: 11, fontWeight: '800', letterSpacing: 1, color: colors.primary },
  previewName: { fontSize: 20, fontWeight: '800', color: colors.text, marginTop: 2 },
  scheduleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.bg,
    borderRadius: 12,
    padding: 12,
  },
  scheduleIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scheduleLabel: { fontSize: 11, color: colors.textMuted },
  scheduleText: { fontSize: 14, fontWeight: '700', color: colors.text },
  shield: { flexDirection: 'row', gap: 10, backgroundColor: colors.primarySoft, borderRadius: 12, padding: 12 },
  shieldIcon: { fontSize: 16, lineHeight: 20 },
  shieldTitle: { fontSize: 13, fontWeight: '700', color: colors.text },
  shieldBody: { fontSize: 12, lineHeight: 18, color: colors.textSub, marginTop: 2 },
  footer: { paddingHorizontal: GUTTER, paddingTop: 10, paddingBottom: 14, gap: 6 },
  footHint: { fontSize: 12, color: colors.textMuted, textAlign: 'center' },
});
