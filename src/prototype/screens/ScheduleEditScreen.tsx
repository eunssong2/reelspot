import { useNavigation } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { AppHeader } from '../components/AppHeader';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { ActionButton, ErrorText, FieldLabel, NoteBox } from '../components/FormParts';
import { PeriodSheet } from '../components/PeriodSheet';
import { ScreenFrame } from '../components/ScreenFrame';
import type { Group, Schedule } from '../mock/groupData';
import type { Nav } from '../navigation/routes';
import { commonErrorText, newRequestKey, useGroups } from '../state/GroupsProvider';
import { colors, GUTTER, radius } from '../styles/tokens';
import { countChars, dotDate, inclusiveDays, periodLabel, rangesOverlap, type DateStr } from '../utils/calendar';
import { PeriodBadge, PeriodFields } from './GroupCreateScreen';

const TITLE_MAX = 100;

interface Props {
  nav: Nav;
  group: Group;
  /** 있으면 변경, 없으면 추가 */
  schedule?: Schedule;
  /** 추가할 때 시작·종료 기본값(UI05 에서 고른 날짜) */
  defaultDate?: DateStr;
}

type Dialog = null | 'cancel' | 'delete' | 'notEmpty' | 'leave' | 'conflict';

/**
 * UI06 일정 추가와 변경. 디자인: docs/stitch/UI06_일정_추가와_변경.html
 * 방장만 들어온다. 겹치는 일정은 안내만 하고 저장을 막지 않는다.
 * 기간을 줄여 밖으로 나가는 방문·기록이 있으면 서버가 알려 준 수를 보여 주고 확인받는다.
 */
export function ScheduleEditScreen({ nav, group, schedule, defaultDate }: Props) {
  const { schedulesOf, createSchedule, updateSchedule, cancelSchedule, deleteSchedule, visitCount, setFlash } = useGroups();
  const navigation = useNavigation();
  const editing = Boolean(schedule);
  const [title, setTitle] = useState(schedule?.title ?? '');
  const [start, setStart] = useState<DateStr | null>(schedule?.startDate ?? defaultDate ?? null);
  const [end, setEnd] = useState<DateStr | null>(schedule?.endDate ?? defaultDate ?? null);
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState<null | 'save' | 'cancel' | 'delete'>(null);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [outside, setOutside] = useState<{ visits: number; media: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(schedule?.version ?? 1);
  /** 충돌 응답에 실려 온 서버의 최신 일정 */
  const [latest, setLatest] = useState<Schedule | null>(null);
  const pendingLeave = useRef<null | (() => void)>(null);
  const done = useRef(false);
  /** 일정 추가 요청 키: 재시도해도 일정이 두 번 생기지 않는다. */
  const requestKey = useRef(newRequestKey());

  const titleLen = countChars(title);
  const dirty = editing
    ? title !== schedule!.title || start !== schedule!.startDate || end !== schedule!.endDate
    : title.length > 0;
  const valid = titleLen >= 1 && titleLen <= TITLE_MAX && start !== null && end !== null;
  const overlaps =
    start && end
      ? schedulesOf(group.id).filter(
          (sc) => sc.id !== schedule?.id && sc.status === 'active' && rangesOverlap(sc.startDate, sc.endDate, start, end),
        )
      : [];
  const hasRecords = (schedule?.mediaCount ?? 0) > 0;

  useEffect(
    () =>
      navigation.addListener('beforeRemove', (e) => {
        if (done.current || !dirty) return;
        e.preventDefault();
        pendingLeave.current = () => navigation.dispatch(e.data.action);
        setDialog('leave');
      }),
    [navigation, dirty],
  );

  const leaveWith = (message: string) => {
    done.current = true;
    setFlash(message);
    nav.back();
  };

  const save = async (confirmOutsideRange = false, baseVersion = version) => {
    if (!start || !end) return;
    setBusy('save');
    setError(null);
    try {
      if (!editing) {
        const created = await createSchedule(group.id, { title, startDate: start, endDate: end }, requestKey.current);
        if (created.ok) return leaveWith('일정을 추가했어요');
        setError(
          created.error === 'TEXT_REJECTED'
            ? '사용할 수 없는 표현이 있어요. 일정 제목을 바꿔 주세요.'
            : commonErrorText(created.error),
        );
        return;
      }
      const result = await updateSchedule(
        schedule!.id,
        { title, startDate: start, endDate: end },
        baseVersion,
        confirmOutsideRange,
      );
      if (result.ok) return leaveWith('일정을 바꿨어요');
      setOutside(null);
      if (result.error === 'OUTSIDE_RANGE_CONFIRMATION_REQUIRED') setOutside({ visits: result.visits, media: result.media });
      else if (result.error === 'VERSION_CONFLICT') {
        setLatest(result.latest);
        setDialog('conflict');
      } else if (result.error === 'SCHEDULE_CANCELLED') setError('취소된 일정은 바꿀 수 없어요.');
      else if (result.error === 'TEXT_REJECTED') setError('사용할 수 없는 표현이 있어요. 일정 제목을 바꿔 주세요.');
      else if (result.error === 'FORBIDDEN') setError('방장만 일정을 바꿀 수 있어요.');
      else setError(commonErrorText(result.error));
    } finally {
      setBusy(null);
    }
  };

  const doCancel = async () => {
    setBusy('cancel');
    const result = await cancelSchedule(schedule!.id);
    setBusy(null);
    setDialog(null);
    if (!result.ok) return setError(`일정을 취소하지 못했어요. ${commonErrorText(result.error)}`);
    leaveWith('일정을 취소했어요');
  };

  const doDelete = async () => {
    setBusy('delete');
    const result = await deleteSchedule(schedule!.id);
    setBusy(null);
    if (!result.ok) {
      if (result.error === 'NOT_EMPTY') return setDialog('notEmpty');
      setDialog(null);
      return setError(`일정을 삭제하지 못했어요. ${commonErrorText(result.error)}`);
    }
    setDialog(null);
    leaveWith('일정을 삭제했어요');
  };

  const visits = schedule ? visitCount(schedule) : 0;

  return (
    <ScreenFrame>
      <AppHeader title={editing ? '일정 변경' : '일정 추가'} subtitle={group.name} onBack={nav.back} />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.meta}>
            <View style={styles.groupPill}>
              <Text style={styles.groupPillText}>👥 {group.name}</Text>
            </View>
            <Text style={styles.metaRight}>● 방장 {group.members[0]}</Text>
          </View>

          {editing && schedule!.retentionLastDate ? (
            <View style={styles.retention}>
              <View style={styles.retentionIcon}>
                <Text>🕒</Text>
              </View>
              <View style={styles.flex}>
                <Text style={styles.retentionTitle}>최초 기록 완료 후 보관 기한은 바뀌지 않아요</Text>
                <Text style={styles.retentionSub}>
                  보관 마지막 날 <Text style={styles.retentionDate}>{dotDate(schedule!.retentionLastDate)}</Text>
                </Text>
              </View>
            </View>
          ) : null}

          <View style={styles.form}>
            <View style={styles.field}>
              <FieldLabel
                label="일정 제목"
                required
                right={
                  <Text style={[styles.counter, titleLen > TITLE_MAX && styles.counterOver]}>
                    {titleLen}/{TITLE_MAX}
                  </Text>
                }
              />
              <TextInput
                value={title}
                onChangeText={(v) => {
                  setTitle(v.replace(/[\r\n]/g, ''));
                  setOutside(null);
                }}
                placeholder="예: 북한산 둘레길"
                placeholderTextColor={colors.textMuted}
                style={[styles.input, titleLen > TITLE_MAX && styles.inputError]}
                editable={!busy}
                accessibilityLabel="일정 제목"
              />
              <ErrorText message={titleLen > TITLE_MAX ? '일정 제목은 100자까지 쓸 수 있어요' : null} />
            </View>

            <View style={styles.field}>
              <FieldLabel
                label="일정 기간"
                required
                right={start && end ? <PeriodBadge days={inclusiveDays(start, end)} /> : undefined}
              />
              <PeriodFields start={start} end={end} onPress={() => setPicking(true)} disabled={busy !== null} />
            </View>

            <NoteBox
              lines={[
                { icon: '🕘', text: '시간은 각 장소에서 입력해요 · 반복 설정 없음' },
                { icon: '🌏', text: '한국 표준시(Asia/Seoul) 기준' },
              ]}
            />

            {overlaps.length ? (
              <NoteBox
                tone="coral"
                lines={[
                  {
                    icon: '💡',
                    text: `같은 기간에 '${overlaps[0].title}'${overlaps.length > 1 ? ` 외 ${overlaps.length - 1}개` : ''} 일정이 있어요. 그대로 저장할 수 있어요.`,
                  },
                ]}
              />
            ) : null}

            {outside ? (
              <View style={styles.outside}>
                <Text style={styles.outsideTitle}>
                  기간을 줄이면 기간 밖이 되는 기록 {outside.media}개 · 방문 {outside.visits}개
                </Text>
                <Text style={styles.outsideBody}>삭제되지 않고 일정 안의 '기간 밖 기록' 구역에 남아요.</Text>
                <View style={styles.outsideActions}>
                  <ActionButton label="기간 다시 고르기" tone="secondary" onPress={() => setPicking(true)} style={styles.flex} />
                  <ActionButton label="그래도 저장" onPress={() => save(true)} loading={busy === 'save'} style={styles.flex} />
                </View>
              </View>
            ) : null}
          </View>

          <ErrorText message={error} />

          <ActionButton
            label="저장하기"
            icon="✓"
            onPress={() => save(false)}
            disabled={!valid || (editing && !dirty) || outside !== null}
            loading={busy === 'save' && !outside}
          />

          {editing ? (
            <View style={styles.danger}>
              <Pressable
                onPress={() => setDialog('cancel')}
                accessibilityRole="button"
                style={({ pressed }) => [styles.dangerRow, pressed && styles.pressed]}
              >
                <Text style={styles.dangerIcon}>📅</Text>
                <View style={styles.flex}>
                  <Text style={styles.dangerTitle}>일정 취소(기록 보존)</Text>
                  <Text style={styles.dangerSub}>기록은 보관 기한까지 남아요</Text>
                </View>
                <Text style={styles.chevron}>›</Text>
              </Pressable>
              <View style={styles.divider} />
              <Pressable
                onPress={() => (hasRecords ? setDialog('notEmpty') : setDialog('delete'))}
                accessibilityRole="button"
                accessibilityState={{ disabled: hasRecords }}
                style={({ pressed }) => [styles.dangerRow, hasRecords && styles.locked, pressed && styles.pressed]}
              >
                <Text style={styles.dangerIcon}>🗑</Text>
                <View style={styles.flex}>
                  <Text style={[styles.dangerTitle, hasRecords && styles.lockedTitle]}>빈 일정 삭제</Text>
                  <Text style={styles.dangerSub}>
                    {hasRecords ? '기록이 있는 일정은 취소만 가능해요' : '기록이 없는 일정만 지울 수 있어요'}
                  </Text>
                </View>
                <Text style={styles.chevron}>{hasRecords ? '🔒' : '›'}</Text>
              </Pressable>
            </View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>

      <PeriodSheet
        visible={picking}
        start={start}
        end={end}
        onCancel={() => setPicking(false)}
        onConfirm={(s, e) => {
          setStart(s);
          setEnd(e);
          setOutside(null);
          setPicking(false);
        }}
      />

      <ConfirmDialog
        visible={dialog === 'cancel'}
        warning
        title="일정을 취소할까요?"
        subtitle={schedule?.title}
        body={`기록은 보관 기한${schedule?.retentionLastDate ? `(${dotDate(schedule.retentionLastDate)})` : ''}까지 남아요. 취소하면 누구도 새 사진·영상을 올릴 수 없고 되돌릴 수 없어요.`}
        onRequestClose={() => setDialog(null)}
        buttons={[
          { label: '일정 취소하기', tone: 'danger', onPress: doCancel, loading: busy === 'cancel' },
          { label: '돌아가기', tone: 'plain', onPress: () => setDialog(null) },
        ]}
      />
      <ConfirmDialog
        visible={dialog === 'delete'}
        warning
        title="일정을 삭제할까요?"
        subtitle={schedule?.title}
        body={visits ? `방문 계획 ${visits}곳도 함께 지워지고 되돌릴 수 없어요.` : '되돌릴 수 없어요.'}
        onRequestClose={() => setDialog(null)}
        buttons={[
          { label: '삭제', tone: 'danger', onPress: doDelete, loading: busy === 'delete' },
          { label: '돌아가기', tone: 'plain', onPress: () => setDialog(null) },
        ]}
      />
      <ConfirmDialog
        visible={dialog === 'notEmpty'}
        title="기록이 있는 일정은 삭제할 수 없어요"
        body="대신 일정을 취소하면 기록은 보관 기한까지 남아요."
        onRequestClose={() => setDialog(null)}
        buttons={[
          { label: '일정 취소로 진행', onPress: () => setDialog('cancel') },
          { label: '닫기', tone: 'plain', onPress: () => setDialog(null) },
        ]}
      />
      <ConfirmDialog
        visible={dialog === 'conflict'}
        title="다른 사람이 먼저 수정했어요"
        body={
          latest
            ? `내 입력을 유지했어요.\n최신 내용: '${latest.title}' · ${periodLabel(latest.startDate, latest.endDate)}`
            : '내 입력을 유지했어요.'
        }
        onRequestClose={() => setDialog(null)}
        buttons={[
          {
            label: '최신 내용에 내 입력 다시 적용',
            loading: busy === 'save',
            onPress: () => {
              if (!latest) return;
              setVersion(latest.version);
              setDialog(null);
              save(false, latest.version);
            },
          },
          {
            label: '최신 내용으로 바꾸기',
            tone: 'plain',
            onPress: () => {
              if (!latest) return;
              setTitle(latest.title);
              setStart(latest.startDate);
              setEnd(latest.endDate);
              setVersion(latest.version);
              setDialog(null);
            },
          },
          { label: '취소', tone: 'plain', onPress: () => setDialog(null) },
        ]}
      />
      <ConfirmDialog
        visible={dialog === 'leave'}
        title="저장하지 않은 변경이 있어요"
        onRequestClose={() => setDialog(null)}
        buttons={[
          {
            label: '저장',
            onPress: () => {
              setDialog(null);
              save(false);
            },
          },
          {
            label: '변경 버리기',
            tone: 'danger',
            onPress: () => {
              setDialog(null);
              done.current = true;
              pendingLeave.current?.();
            },
          },
          { label: '계속 편집', tone: 'plain', onPress: () => setDialog(null) },
        ]}
      />
    </ScreenFrame>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingHorizontal: GUTTER, paddingTop: 4, paddingBottom: 28, gap: 14 },
  meta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  groupPill: { backgroundColor: colors.surface, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 6 },
  groupPillText: { fontSize: 12, fontWeight: '700', color: colors.textSub },
  metaRight: { fontSize: 11, color: colors.textMuted },
  retention: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
    backgroundColor: colors.primarySoft,
    borderRadius: radius.item - 4,
    padding: 12,
  },
  retentionIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retentionTitle: { fontSize: 13, fontWeight: '700', color: colors.text },
  retentionSub: { fontSize: 12, color: colors.textSub, marginTop: 2 },
  retentionDate: { fontWeight: '800', color: colors.primary },
  form: { backgroundColor: colors.bg, gap: 16 },
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
  },
  inputError: { borderColor: colors.danger, backgroundColor: colors.bg },
  counter: { fontSize: 11, fontWeight: '600', color: colors.textMuted },
  counterOver: { color: colors.danger },
  outside: { backgroundColor: colors.primarySoft, borderRadius: radius.item - 4, padding: 14, gap: 6 },
  outsideTitle: { fontSize: 14, fontWeight: '800', color: colors.text },
  outsideBody: { fontSize: 13, lineHeight: 19, color: colors.textSub },
  outsideActions: { flexDirection: 'row', gap: 8, marginTop: 6 },
  danger: { backgroundColor: colors.surface, borderRadius: radius.card, padding: 8, marginTop: 4 },
  dangerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 56, paddingHorizontal: 8, borderRadius: 12 },
  pressed: { backgroundColor: colors.surfaceStrong },
  dangerIcon: { fontSize: 18 },
  dangerTitle: { fontSize: 14, fontWeight: '700', color: colors.danger },
  dangerSub: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  locked: { opacity: 0.6 },
  lockedTitle: { color: colors.textSub },
  chevron: { fontSize: 18, color: colors.textMuted },
  divider: { height: 1, backgroundColor: colors.line, marginHorizontal: 8 },
});
