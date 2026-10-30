import { useNavigation } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { AppHeader } from '../components/AppHeader';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { ActionButton, ErrorText, FieldLabel, NoteBox } from '../components/FormParts';
import { PeriodSheet } from '../components/PeriodSheet';
import { ResultCheckCard } from '../components/ResultCheckCard';
import { ScreenFrame } from '../components/ScreenFrame';
import type { Nav } from '../navigation/routes';
import { commonErrorText, newRequestKey, useGroups } from '../state/GroupsProvider';
import { colors, GUTTER, radius } from '../styles/tokens';
import { addDays, countChars, dotDate, inclusiveDays, todayKst, type DateStr } from '../utils/calendar';

const NAME_MAX = 50;
const TITLE_MAX = 100;

/**
 * UI04 모임과 첫 일정 생성. 디자인: docs/stitch/UI04_모임과_첫_일정_생성.html
 * 모임·방장 참여·첫 일정을 한 번에 만든다. 정원(10명)·시각·반복은 고르지 않는다.
 */
export function GroupCreateScreen({ nav }: { nav: Nav }) {
  const { createGroup, operationGet, setFlash } = useGroups();
  const navigation = useNavigation();
  const [name, setName] = useState('');
  const [title, setTitle] = useState('');
  const [start, setStart] = useState<DateStr | null>(null);
  const [end, setEnd] = useState<DateStr | null>(null);
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unknown, setUnknown] = useState(false);
  const [checking, setChecking] = useState(false);
  const pendingLeave = useRef<null | (() => void)>(null);
  const done = useRef(false);
  /** 같은 입력으로 다시 보내면 같은 요청 키를 써서 모임이 두 번 생기지 않게 한다. 입력을 바꾸면 새 키. */
  const requestKey = useRef(newRequestKey());
  const edited = () => {
    requestKey.current = newRequestKey();
    setError(null);
  };

  const nameLen = countChars(name);
  const titleLen = countChars(title);
  const dirty = name.length > 0 || title.length > 0 || start !== null;
  const valid = nameLen >= 1 && nameLen <= NAME_MAX && titleLen >= 1 && titleLen <= TITLE_MAX && start !== null && end !== null;
  // 종료 날짜 + 3개월이 이미 지났으면 사진·영상을 올릴 수 없다(생성은 허용).
  const expiredPeriod = end !== null && addDays(end, 92) < todayKst();

  useEffect(
    () =>
      navigation.addListener('beforeRemove', (e) => {
        if (done.current || !dirty) return;
        e.preventDefault();
        pendingLeave.current = () => navigation.dispatch(e.data.action);
        setLeaveOpen(true);
      }),
    [navigation, dirty],
  );

  const succeed = (groupId: string, focusDate: string) => {
    done.current = true;
    setFlash('모임을 만들었어요');
    // UI04 를 달력으로 바꿔 끼운다(뒤로가면 내 모임).
    nav.replace({ name: 'groupCalendar', groupId, focusDate });
  };

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await createGroup(name, { title, startDate: start!, endDate: end! }, requestKey.current);
      if (result.ok) return succeed(result.group.id, result.schedule.startDate);
      if (result.error === 'RESULT_UNKNOWN') return setUnknown(true);
      setError(
        result.error === 'TEXT_REJECTED'
          ? '사용할 수 없는 표현이 있어요. 모임 이름이나 일정 제목을 바꿔 주세요.'
          : result.error === 'GROUP_LIMIT'
            ? '참여 중인 모임이 100개라 더 만들 수 없어요.'
            : result.error === 'OWNER_CREATE_LIMIT'
              ? '방장인 모임이 20개라 더 만들 수 없어요.'
              : commonErrorText(result.error),
      );
    } finally {
      setBusy(false);
    }
  };

  /** 결과 불명: 같은 요청 키로 처리 결과를 확인한다(operationGet). */
  const checkResult = async () => {
    setChecking(true);
    try {
      const result = await operationGet(requestKey.current);
      if (result?.ok) return succeed(result.group.id, result.schedule.startDate);
      if (result && !result.ok && (result.error === 'OFFLINE' || result.error === 'SERVER_ERROR')) {
        setError(commonErrorText(result.error));
        return;
      }
      // 서버에 기록이 없으면 만들어지지 않은 것: 같은 키로 다시 보내도 안전하다.
      setUnknown(false);
      setError('모임이 만들어지지 않았어요. 다시 시도해 주세요.');
    } finally {
      setChecking(false);
    }
  };

  return (
    <ScreenFrame>
      <AppHeader title="새 모임 만들기" onBack={nav.back} />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.hook}>
            <View style={styles.hookIcon}>
              <Text style={styles.hookGlyph}>🎉</Text>
            </View>
            <View style={styles.flex}>
              <Text style={styles.hookTitle}>함께할 순간을 시작해볼까요?</Text>
              <Text style={styles.hookSub}>모임을 열고 첫 일정을 가볍게 등록해보세요.</Text>
            </View>
          </View>

          <View style={styles.field}>
            <FieldLabel label="모임 이름" required hint="어떤 이름이든 좋아요" />
            <TextInput
              value={name}
              onChangeText={(v) => {
                setName(v.replace(/[\r\n]/g, ''));
                edited();
              }}
              placeholder="예: 주말 산책 모임"
              placeholderTextColor={colors.textMuted}
              style={[styles.input, nameLen > NAME_MAX && styles.inputError]}
              editable={!busy && !unknown}
              accessibilityLabel="모임 이름"
            />
            <Text style={[styles.counter, nameLen > NAME_MAX && styles.counterOver]}>
              {nameLen}/{NAME_MAX}
            </Text>
            <ErrorText message={nameLen > NAME_MAX ? '모임 이름은 50자까지 쓸 수 있어요' : null} />
          </View>

          <View style={styles.field}>
            <FieldLabel label="첫 일정 제목" required hint="언제든 바꿀 수 있어요" />
            <TextInput
              value={title}
              onChangeText={(v) => {
                setTitle(v.replace(/[\r\n]/g, ''));
                edited();
              }}
              placeholder="예: 우리의 서울 여행"
              placeholderTextColor={colors.textMuted}
              style={[styles.input, titleLen > TITLE_MAX && styles.inputError]}
              editable={!busy && !unknown}
              accessibilityLabel="첫 일정 제목"
            />
            <Text style={[styles.counter, titleLen > TITLE_MAX && styles.counterOver]}>
              {titleLen}/{TITLE_MAX}
            </Text>
            <ErrorText message={titleLen > TITLE_MAX ? '일정 제목은 100자까지 쓸 수 있어요' : null} />
          </View>

          <View style={styles.field}>
            <FieldLabel
              label="일정 기간"
              required
              right={start && end ? <PeriodBadge days={inclusiveDays(start, end)} /> : undefined}
            />
            <PeriodFields start={start} end={end} onPress={() => setPicking(true)} disabled={busy} />
            <ErrorText message={expiredPeriod ? '이 기간은 보관 기한이 지나 사진·영상을 올릴 수 없어요.' : null} />
          </View>

          <NoteBox
            lines={[
              { icon: 'ℹ️', text: '시간은 장소를 추가할 때 입력해요. 반복 설정은 없어요. 필요하면 일정을 더 추가해요.' },
              { icon: '👥', text: '한국 시간 기준 · 최대 10명 고정 · 정원 변경 없음' },
            ]}
          />
        </ScrollView>

        <View style={styles.footer}>
          {unknown ? (
            <ResultCheckCard requestId={requestKey.current} onCheck={checkResult} checking={checking} />
          ) : (
            <>
              <ErrorText message={error} />
              <ActionButton label="모임과 첫 일정 만들기" trailing="→" onPress={submit} disabled={!valid} loading={busy} />
            </>
          )}
        </View>
      </KeyboardAvoidingView>

      <PeriodSheet
        visible={picking}
        start={start}
        end={end}
        onCancel={() => setPicking(false)}
        onConfirm={(s, e) => {
          setStart(s);
          setEnd(e);
          setPicking(false);
          edited();
        }}
      />

      <ConfirmDialog
        visible={leaveOpen}
        title="만들기를 그만둘까요?"
        body="입력한 내용은 저장되지 않아요."
        onRequestClose={() => setLeaveOpen(false)}
        buttons={[
          {
            label: '나가기',
            tone: 'danger',
            onPress: () => {
              setLeaveOpen(false);
              done.current = true;
              pendingLeave.current?.();
            },
          },
          { label: '계속 작성', tone: 'plain', onPress: () => setLeaveOpen(false) },
        ]}
      />
    </ScreenFrame>
  );
}

export function PeriodBadge({ days }: { days: number }) {
  return (
    <View style={styles.badge}>
      <Text style={styles.badgeText}>📅 {days === 1 ? '당일' : `${days}일 동안`}</Text>
    </View>
  );
}

/** 시작 — 종료 두 칸. 어느 칸을 눌러도 기간 선택 시트(D1)가 열린다. */
export function PeriodFields({
  start,
  end,
  onPress,
  disabled,
}: {
  start: DateStr | null;
  end: DateStr | null;
  onPress: () => void;
  disabled?: boolean;
}) {
  const box = (label: string, value: DateStr | null) => (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={`${label} ${value ?? '날짜 선택'}`}
      style={({ pressed }) => [styles.dateBox, pressed && styles.dateBoxPressed]}
    >
      <Text style={styles.dateLabel}>{label}</Text>
      <View style={styles.dateRow}>
        <Text style={[styles.dateValue, !value && styles.datePlaceholder]}>{value ? dotDate(value) : '날짜 선택'}</Text>
        <Text style={styles.dateIcon}>📅</Text>
      </View>
    </Pressable>
  );
  return (
    <View style={styles.dates}>
      {box('시작 날짜', start)}
      <Text style={styles.dash}>—</Text>
      {box('종료 날짜', end)}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingHorizontal: GUTTER, paddingTop: 4, paddingBottom: 24, gap: 22 },
  hook: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surface,
    borderRadius: radius.item,
    padding: 12,
  },
  hookIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hookGlyph: { fontSize: 20 },
  hookTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  hookSub: { fontSize: 13, color: colors.textSub, marginTop: 2 },
  field: { gap: 6 },
  input: {
    height: 52,
    borderRadius: radius.item - 4,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    fontSize: 17,
    fontWeight: '500',
    color: colors.text,
    borderWidth: 1.5,
    borderColor: 'transparent',
    marginTop: 2,
  },
  inputError: { borderColor: colors.danger, backgroundColor: colors.bg },
  counter: { alignSelf: 'flex-end', fontSize: 11, fontWeight: '600', color: colors.textMuted },
  counterOver: { color: colors.danger },
  badge: { backgroundColor: colors.primarySoft, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 3 },
  badgeText: { fontSize: 12, fontWeight: '700', color: colors.primary },
  dates: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  dash: { fontSize: 18, color: colors.textMuted },
  dateBox: {
    flex: 1,
    minHeight: 60,
    borderRadius: radius.item - 4,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 10,
    justifyContent: 'center',
  },
  dateBoxPressed: { backgroundColor: colors.surfaceStrong },
  dateLabel: { fontSize: 11, color: colors.textMuted, marginBottom: 2 },
  dateRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dateValue: { fontSize: 16, fontWeight: '700', color: colors.text },
  datePlaceholder: { color: colors.textMuted, fontWeight: '500' },
  dateIcon: { fontSize: 15 },
  footer: { paddingHorizontal: GUTTER, paddingTop: 10, paddingBottom: 14, gap: 8 },
});
