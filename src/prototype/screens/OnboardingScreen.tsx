import { useNavigation } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { ConfirmDialog } from '../components/ConfirmDialog';
import { ActionButton, CheckCircle, ErrorText, Pill } from '../components/FormParts';
import { ScreenFrame } from '../components/ScreenFrame';
import { SOCIAL_NAME, type ConsentDoc } from '../mock/groupData';
import type { Nav } from '../navigation/routes';
import { commonErrorText, useGroups } from '../state/GroupsProvider';
import { colors, GUTTER, radius } from '../styles/tokens';
import { countChars } from '../utils/calendar';

const NAME_MAX = 20;

/**
 * UI02 가입 동의와 표시명. 디자인: docs/stitch/UI02_가입_동의와_표시명.html
 * 필수 동의 + 유효한 표시명(1~20자)이 있어야 시작할 수 있다. 동의 항목은 처음에 모두 비어 있다.
 * 문서 목록은 서버(consentDocs)가 주며 앱에 항목을 고정하지 않는다. 동의는 문서 버전 단위로 기록한다.
 */
export function OnboardingScreen({ nav }: { nav: Nav }) {
  const { completeOnboarding, loadConsentDocs, logout, pendingInvite } = useGroups();
  const navigation = useNavigation();
  const [docs, setDocs] = useState<ConsentDoc[] | null>(null);
  const [docsError, setDocsError] = useState<string | null>(null);
  /** 문서 id → 동의한 버전. 문서 버전이 바뀌면 자동으로 동의 해제 상태가 된다. */
  const [agreedVersion, setAgreedVersion] = useState<Record<string, string | undefined>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [nameRejected, setNameRejected] = useState(false);
  const [name, setName] = useState(SOCIAL_NAME);
  const [touched, setTouched] = useState(false);
  const [doc, setDoc] = useState<ConsentDoc | null>(null);
  const [busy, setBusy] = useState(false);
  const [quitOpen, setQuitOpen] = useState(false);
  const allowLeave = useRef(false);

  const nameLength = countChars(name);
  const nameError =
    nameLength === 0
      ? touched
        ? '표시명을 입력해 주세요'
        : null
      : nameLength > NAME_MAX
        ? '표시명은 20자까지 쓸 수 있어요'
        : nameRejected
          ? '이 표시명은 사용할 수 없어요. 다른 이름을 입력해 주세요.'
          : null;
  const list = docs ?? [];
  const isAgreed = (d: ConsentDoc) => agreedVersion[d.id] === d.version;
  const requiredDone = list.length > 0 && list.filter((d) => d.required).every(isAgreed);
  const allDone = list.length > 0 && list.every(isAgreed);
  const canSubmit = docs !== null && requiredDone && nameLength >= 1 && nameLength <= NAME_MAX && !nameRejected && !busy;

  const fetchDocs = async () => {
    setDocsError(null);
    const result = await loadConsentDocs();
    if (result.ok) setDocs(result.docs);
    else setDocsError(result.error === 'DOCUMENT_UNAVAILABLE' ? '동의 문서를 불러오지 못했어요' : commonErrorText(result.error));
    return result;
  };

  useEffect(() => {
    fetchDocs();
  }, []); // 처음 한 번 불러온다

  const setAgree = (d: ConsentDoc, on: boolean) => setAgreedVersion((prev) => ({ ...prev, [d.id]: on ? d.version : undefined }));

  // 시스템 뒤로가기도 "가입을 그만둘까요?"를 거친다.
  useEffect(
    () =>
      navigation.addListener('beforeRemove', (e) => {
        if (allowLeave.current) return;
        e.preventDefault();
        setQuitOpen(true);
      }),
    [navigation],
  );

  const toggleAll = () => {
    const next = !allDone;
    setAgreedVersion(Object.fromEntries(list.map((d) => [d.id, next ? d.version : undefined])));
  };

  const submit = async () => {
    setBusy(true);
    setSubmitError(null);
    try {
      const result = await completeOnboarding(
        name,
        list.map((d) => ({ documentId: d.id, version: d.version, agreed: isAgreed(d) })),
      );
      if (!result.ok) {
        if (result.error === 'TEXT_REJECTED') setNameRejected(true);
        else if (result.error === 'CONSENT_REQUIRED') {
          // 그사이 문서가 바뀌었다: 목록을 다시 받아 바뀐 항목을 다시 확인받는다.
          await fetchDocs();
          setSubmitError('동의 문서가 바뀌었어요. 바뀐 항목을 다시 확인해 주세요.');
        } else setSubmitError(commonErrorText(result.error));
        return;
      }
      allowLeave.current = true;
      if (pendingInvite) nav.replace({ name: 'inviteJoin' });
      else nav.home();
    } finally {
      setBusy(false);
    }
  };

  const quit = () => {
    setQuitOpen(false);
    allowLeave.current = true;
    logout();
    nav.home();
  };

  return (
    <ScreenFrame>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.top}>
          <Pressable
            onPress={() => setQuitOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="뒤로가기"
            style={styles.back}
            hitSlop={8}
          >
            <Text style={styles.backGlyph}>‹</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.titleRow}>
            <Text style={styles.title}>처음 오셨네요</Text>
            <Text style={styles.wave}>👋</Text>
          </View>
          <Text style={styles.hint}>문서를 읽고 필요한 항목에 동의해 주세요.</Text>

          <Pressable
            onPress={toggleAll}
            disabled={docs === null}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: allDone, disabled: docs === null }}
            style={({ pressed }) => [styles.allBox, pressed && styles.pressed, docs === null && styles.dim]}
          >
            <CheckCircle checked={allDone} />
            <View style={styles.flex}>
              <Text style={styles.allTitle}>약관 전체 동의</Text>
              <Text style={styles.allSub}>선택 동의 항목까지 한 번에 완료해요</Text>
            </View>
          </Pressable>

          <View style={styles.list}>
            {docs === null ? (
              <View style={styles.docsState}>
                {docsError ? (
                  <>
                    <Text style={styles.docsError}>{docsError}</Text>
                    <ActionButton label="다시 시도" tone="secondary" onPress={fetchDocs} style={styles.docsRetry} />
                  </>
                ) : (
                  <Text style={styles.docsLoading}>동의 문서를 불러오는 중…</Text>
                )}
              </View>
            ) : null}
            {list.map((d) => (
              <View key={d.id} style={styles.row}>
                <Pressable
                  onPress={() => setAgree(d, !isAgreed(d))}
                  accessibilityRole="checkbox"
                  accessibilityLabel={`${d.title} ${d.required ? '필수' : '선택'}`}
                  accessibilityState={{ checked: isAgreed(d) }}
                  style={styles.rowCheck}
                >
                  <CheckCircle checked={isAgreed(d)} />
                  <Text style={styles.rowTitle} numberOfLines={1}>
                    {d.title}
                  </Text>
                </Pressable>
                <Pill label={d.required ? '필수' : '선택'} tone={d.required ? 'coral' : 'gray'} />
                <Pressable
                  onPress={() => setDoc(d)}
                  accessibilityRole="button"
                  accessibilityLabel={`${d.title} 상세 보기`}
                  style={styles.chevron}
                  hitSlop={6}
                >
                  <Text style={styles.chevronGlyph}>›</Text>
                </Pressable>
              </View>
            ))}
          </View>

          <View style={styles.nameBlock}>
            <View style={styles.nameHead}>
              <Text style={styles.nameLabel}>
                표시명<Text style={styles.required}> ●</Text>
              </Text>
              <Text style={styles.nameBadge}>추후 언제든 변경 가능</Text>
            </View>
            <View style={styles.inputWrap}>
              <TextInput
                value={name}
                onChangeText={(v) => {
                  setName(v.replace(/[\r\n]/g, ''));
                  setNameRejected(false);
                }}
                onBlur={() => setTouched(true)}
                placeholder="사용하실 이름을 적어주세요"
                placeholderTextColor={colors.textMuted}
                style={[styles.input, nameError && styles.inputError]}
                accessibilityLabel="표시명"
                editable={!busy}
                returnKeyType="done"
              />
              {name ? (
                <Pressable onPress={() => setName('')} accessibilityLabel="이름 지우기" style={styles.clear} hitSlop={6}>
                  <Text style={styles.clearGlyph}>✕</Text>
                </Pressable>
              ) : null}
            </View>
            <View style={styles.nameFoot}>
              <Text style={styles.footHint}>중복 표시명도 사용할 수 있어요. 최대 20자</Text>
              <Text style={[styles.counter, nameLength > NAME_MAX && styles.counterOver]}>
                {nameLength}/{NAME_MAX}
              </Text>
            </View>
            <ErrorText message={nameError} />
          </View>

          <View style={styles.tip}>
            <View style={styles.tipIcon}>
              <Text>👥</Text>
            </View>
            <Text style={styles.tipText}>
              친구들과의 약속 캘린더에서 <Text style={styles.tipStrong}>가장 친근한 별칭</Text>으로 함께해보세요!
            </Text>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <ErrorText message={submitError} />
          <ActionButton label="동의하고 시작하기" trailing="→" onPress={submit} disabled={!canSubmit && !busy} loading={busy} />
        </View>
      </KeyboardAvoidingView>

      <ConsentDocModal doc={doc} onClose={() => setDoc(null)} onAgree={(d) => setAgree(d, true)} />

      <ConfirmDialog
        visible={quitOpen}
        title="가입을 그만둘까요?"
        body="입력한 내용은 저장되지 않아요."
        onRequestClose={() => setQuitOpen(false)}
        buttons={[
          { label: '그만두기', tone: 'danger', onPress: quit },
          { label: '계속하기', tone: 'plain', onPress: () => setQuitOpen(false) },
        ]}
      />
    </ScreenFrame>
  );
}

/** D2 문서 보기. 실제 문서는 서버(consentDocs)가 주는 주소의 내용이다. */
function ConsentDocModal({
  doc,
  onClose,
  onAgree,
}: {
  doc: ConsentDoc | null;
  onClose: () => void;
  onAgree: (doc: ConsentDoc) => void;
}) {
  return (
    <Modal visible={doc !== null} animationType="slide" onRequestClose={onClose}>
      {doc ? (
        <ScreenFrame>
          <View style={styles.docHead}>
            <Text style={styles.docTitle} numberOfLines={1}>
              {doc.title}
            </Text>
            <Pressable onPress={onClose} accessibilityLabel="닫기" style={styles.back} hitSlop={8}>
              <Text style={styles.docClose}>✕</Text>
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.docBody}>
            <Text style={styles.docMeta}>
              버전 {doc.version} · 시행일 {doc.effectiveDate.replace(/-/g, '.')}
            </Text>
            <Text style={styles.docDraft}>초안 · 법무 검토 전이며 운영 문서 확정 후 바뀔 수 있어요.</Text>
            {doc.body.map((section) => (
              <View key={section.heading} style={styles.docSection}>
                <Text style={styles.docHeading}>{section.heading}</Text>
                <Text style={styles.docText}>{section.text}</Text>
              </View>
            ))}
          </ScrollView>
          <View style={styles.footer}>
            <ActionButton
              label="동의하고 닫기"
              onPress={() => {
                onAgree(doc);
                onClose();
              }}
            />
          </View>
        </ScreenFrame>
      ) : null}
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  top: { paddingHorizontal: GUTTER - 10, height: 52, justifyContent: 'center' },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22 },
  backGlyph: { fontSize: 34, lineHeight: 38, color: colors.text, marginTop: -3 },
  content: { paddingHorizontal: GUTTER, paddingBottom: 24, gap: 14 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 26, fontWeight: '800', letterSpacing: -0.6, color: colors.text },
  wave: { fontSize: 22 },
  hint: { fontSize: 15, color: colors.textSub, marginTop: -6, marginBottom: 8 },
  pressed: { opacity: 0.8 },
  allBox: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.surface, borderRadius: 18, padding: 16 },
  allTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  allSub: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  list: { backgroundColor: colors.surface, borderRadius: radius.card, paddingVertical: 6, paddingHorizontal: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 52, paddingLeft: 8 },
  rowCheck: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48 },
  rowTitle: { flexShrink: 1, fontSize: 15, color: colors.text },
  chevron: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  chevronGlyph: { fontSize: 24, color: colors.textMuted },
  nameBlock: { gap: 8, marginTop: 8 },
  nameHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  nameLabel: { fontSize: 15, fontWeight: '700', color: colors.text },
  required: { fontSize: 8, color: colors.primary },
  nameBadge: {
    fontSize: 11,
    color: colors.textSub,
    backgroundColor: colors.surface,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  inputWrap: { justifyContent: 'center' },
  input: {
    height: 52,
    borderRadius: 14,
    backgroundColor: colors.surface,
    paddingHorizontal: 16,
    paddingRight: 48,
    fontSize: 17,
    fontWeight: '500',
    color: colors.text,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  inputError: { borderColor: colors.danger, backgroundColor: colors.bg },
  clear: {
    position: 'absolute',
    right: 12,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.surfaceStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearGlyph: { fontSize: 12, color: colors.textSub, fontWeight: '700' },
  nameFoot: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4 },
  footHint: { fontSize: 13, color: colors.textMuted },
  counter: { fontSize: 12, fontWeight: '600', color: colors.textMuted },
  counterOver: { color: colors.danger },
  tip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 14,
    marginTop: 6,
  },
  tipIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tipText: { flex: 1, fontSize: 13, lineHeight: 19, color: colors.textSub },
  tipStrong: { fontWeight: '700', color: colors.text },
  footer: { paddingHorizontal: GUTTER, paddingTop: 10, paddingBottom: 14, gap: 8 },
  docHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: GUTTER,
    paddingRight: GUTTER - 10,
    height: 56,
  },
  docTitle: { flex: 1, fontSize: 18, fontWeight: '800', color: colors.text },
  docClose: { fontSize: 20, color: colors.text },
  docBody: { paddingHorizontal: GUTTER, gap: 14, paddingBottom: 24 },
  docMeta: { fontSize: 12, color: colors.textMuted },
  docDraft: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
    backgroundColor: colors.primarySoft,
    borderRadius: 8,
    padding: 10,
  },
  docSection: { gap: 4 },
  docHeading: { fontSize: 15, fontWeight: '800', color: colors.text },
  dim: { opacity: 0.5 },
  docsState: { paddingVertical: 18, paddingHorizontal: 10, alignItems: 'center', gap: 10 },
  docsLoading: { fontSize: 14, color: colors.textMuted },
  docsError: { fontSize: 14, fontWeight: '600', color: colors.danger, textAlign: 'center' },
  docsRetry: { alignSelf: 'stretch', minHeight: 48 },
  docText: { fontSize: 15, lineHeight: 24, color: colors.textSub },
});
