import { useNavigation } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { AppHeader } from '../components/AppHeader';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { DatePickSheet } from '../components/DatePickSheet';
import { ActionButton, ErrorText, FieldLabel, NoteBox } from '../components/FormParts';
import { ScreenFrame } from '../components/ScreenFrame';
import type { Group, Schedule } from '../mock/groupData';
import type { Nav } from '../navigation/routes';
import { commonErrorText, useGroups } from '../state/GroupsProvider';
import { colors, GUTTER, radius } from '../styles/tokens';
import { countChars, dotDate, type DateStr } from '../utils/calendar';

const TITLE_MAX = 100;

interface Props {
  nav: Nav;
  group: Group;
  /** 이 하루가 속한 일정 */
  schedule: Schedule;
  dayId: string;
  initialTitle: string;
  initialDate: DateStr;
  /** 이 날에 담긴 장소 수(있으면 날짜를 지울 수 없다) */
  places: number;
  /** 다른 일정(과 같은 일정의 다른 날)이 이미 쓰는 날짜. 날짜를 옮길 때 고를 수 없다. */
  takenDates: string[];
}

type Dialog = null | 'cancel' | 'delete' | 'leave';

/**
 * 하루 일정 변경. 모임 달력의 하루 일정에서 "일정 변경"을 누르면 열린다.
 * 일정 기간이 아니라 그날의 제목과 날짜만 고친다(날짜를 옮기면 같은 모임의 다른 일정이 있는 날짜는 고를 수 없다).
 */
export function DayEditScreen({ nav, group, schedule, dayId, initialTitle, initialDate, places, takenDates }: Props) {
  const { updateScheduleDay, removeScheduleDay, cancelScheduleDay, setFlash } = useGroups();
  const navigation = useNavigation();
  const [title, setTitle] = useState(initialTitle);
  const [date, setDate] = useState<DateStr>(initialDate);
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState<null | 'save' | 'cancel' | 'delete'>(null);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [error, setError] = useState<string | null>(null);
  const pendingLeave = useRef<null | (() => void)>(null);
  const done = useRef(false);

  const titleLen = countChars(title);
  const dirty = title !== initialTitle || date !== initialDate;
  const valid = titleLen >= 1 && titleLen <= TITLE_MAX;

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

  const save = async () => {
    setBusy('save');
    setError(null);
    try {
      const result = await updateScheduleDay(schedule.id, dayId, { title: title.trim(), date });
      if (result.ok) return leaveWith('일정을 바꿨어요');
      if (result.error === 'DATE_TAKEN') setError('이미 다른 일정이 있는 날짜예요. 하루에는 일정을 하나만 만들 수 있어요.');
      else if (result.error === 'TEXT_REJECTED') setError('사용할 수 없는 표현이 있어요. 일정 제목을 바꿔 주세요.');
      else if (result.error === 'SCHEDULE_CANCELLED') setError('취소된 일정은 바꿀 수 없어요.');
      else if (result.error === 'FORBIDDEN') setError('방장만 일정을 바꿀 수 있어요.');
      else setError(commonErrorText(result.error));
    } finally {
      setBusy(null);
    }
  };

  const doCancel = async () => {
    setBusy('cancel');
    const result = await cancelScheduleDay(schedule.id, dayId);
    setBusy(null);
    setDialog(null);
    if (!result.ok) {
      if (result.error === 'FORBIDDEN') return setError('방장만 일정을 취소할 수 있어요.');
      return setError(`일정을 취소하지 못했어요. ${commonErrorText(result.error)}`);
    }
    leaveWith('일정을 취소했어요');
  };

  const doDelete = async () => {
    setBusy('delete');
    const result = await removeScheduleDay(schedule.id, dayId);
    setBusy(null);
    setDialog(null);
    if (!result.ok) {
      if (result.error === 'NOT_EMPTY') return setError('장소가 담긴 날은 삭제할 수 없어요. 장소를 먼저 비워 주세요.');
      if (result.error === 'FORBIDDEN') return setError('방장만 삭제할 수 있어요.');
      return setError(`삭제하지 못했어요. ${commonErrorText(result.error)}`);
    }
    leaveWith('일정을 삭제했어요');
  };

  return (
    <ScreenFrame>
      <AppHeader title="일정 변경" subtitle={group.name} onBack={nav.back} />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
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
              onChangeText={(v) => setTitle(v.replace(/[\r\n]/g, ''))}
              placeholder="예: 북한산 둘레길"
              placeholderTextColor={colors.textMuted}
              style={[styles.input, titleLen > TITLE_MAX && styles.inputError]}
              editable={!busy}
              accessibilityLabel="일정 제목"
            />
            <ErrorText message={titleLen > TITLE_MAX ? '일정 제목은 100자까지 쓸 수 있어요' : null} />
          </View>

          <View style={styles.field}>
            <FieldLabel label="날짜" required />
            <Pressable
              onPress={() => setPicking(true)}
              disabled={busy !== null}
              accessibilityRole="button"
              accessibilityLabel={`날짜 ${dotDate(date)}`}
              style={({ pressed }) => [styles.dateBox, pressed && styles.pressed]}
            >
              <Text style={styles.dateValue}>{dotDate(date)}</Text>
              <Text style={styles.dateIcon}>📅</Text>
            </Pressable>
          </View>

          <NoteBox
            lines={[
              { icon: '🕘', text: '시간은 각 장소에서 입력해요' },
              { icon: '🌏', text: '한국 표준시(Asia/Seoul) 기준' },
            ]}
          />

          <ErrorText message={error} />

          <ActionButton label="저장하기" icon="✓" onPress={save} disabled={!valid || !dirty} loading={busy === 'save'} />

          <View style={styles.danger}>
            <>
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
              </>
            <Pressable
              onPress={() => (places > 0 ? setError('장소가 담긴 날은 삭제할 수 없어요. 장소를 먼저 비워 주세요.') : setDialog('delete'))}
              accessibilityRole="button"
              accessibilityState={{ disabled: places > 0 }}
              style={({ pressed }) => [styles.dangerRow, places > 0 && styles.locked, pressed && styles.pressed]}
            >
              <Text style={styles.dangerIcon}>🗑</Text>
              <View style={styles.flex}>
                <Text style={[styles.dangerTitle, places > 0 && styles.lockedTitle]}>이 날 일정 삭제</Text>
                <Text style={styles.dangerSub}>{places > 0 ? '장소가 담긴 날은 삭제할 수 없어요' : '장소가 없는 날만 지울 수 있어요'}</Text>
              </View>
              <Text style={styles.chevron}>{places > 0 ? '🔒' : '›'}</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <DatePickSheet
        visible={picking}
        single
        title="날짜 변경"
        existingDates={takenDates}
        maxPick={1}
        initialDate={date}
        initialPicked={[date]}
        onCancel={() => setPicking(false)}
        onConfirm={(dates) => {
          if (dates[0]) setDate(dates[0]);
          setPicking(false);
        }}
      />

      <ConfirmDialog
        visible={dialog === 'cancel'}
        warning
        title="이 날 일정을 취소할까요?"
        subtitle={title}
        body="기록은 보관 기한까지 남아요. 취소하면 누구도 새 사진·영상을 올릴 수 없고 되돌릴 수 없어요."
        onRequestClose={() => setDialog(null)}
        buttons={[
          { label: '일정 취소하기', tone: 'danger', onPress: doCancel, loading: busy === 'cancel' },
          { label: '돌아가기', tone: 'plain', onPress: () => setDialog(null) },
        ]}
      />
      <ConfirmDialog
        visible={dialog === 'delete'}
        warning
        title="이 날 일정을 삭제할까요?"
        subtitle={title}
        body="되돌릴 수 없어요."
        onRequestClose={() => setDialog(null)}
        buttons={[
          { label: '삭제', tone: 'danger', onPress: doDelete, loading: busy === 'delete' },
          { label: '돌아가기', tone: 'plain', onPress: () => setDialog(null) },
        ]}
      />
      <ConfirmDialog
        visible={dialog === 'leave'}
        title="저장하지 않고 나갈까요?"
        body="바꾼 내용이 사라져요."
        onRequestClose={() => setDialog(null)}
        buttons={[
          {
            label: '나가기',
            tone: 'danger',
            onPress: () => {
              setDialog(null);
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
  content: { paddingHorizontal: GUTTER, paddingTop: 8, paddingBottom: 32, gap: 20 },
  field: { gap: 8 },
  counter: { fontSize: 12, fontWeight: '700', color: colors.textMuted },
  counterOver: { color: colors.danger },
  input: { minHeight: 56, backgroundColor: colors.surface, borderRadius: radius.item, paddingHorizontal: 16, fontSize: 17, color: colors.text },
  inputError: { borderWidth: 1, borderColor: colors.danger },
  dateBox: { minHeight: 56, backgroundColor: colors.surface, borderRadius: radius.item, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dateValue: { fontSize: 17, fontWeight: '700', color: colors.text },
  dateIcon: { fontSize: 18 },
  pressed: { opacity: 0.85 },
  danger: { backgroundColor: colors.surface, borderRadius: radius.card, paddingHorizontal: 16, paddingVertical: 6 },
  dangerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64 },
  dangerIcon: { fontSize: 18 },
  dangerTitle: { fontSize: 15, fontWeight: '800', color: colors.danger },
  dangerSub: { fontSize: 12, color: colors.textSub, marginTop: 2 },
  chevron: { fontSize: 20, color: colors.textMuted },
  divider: { height: 1, backgroundColor: colors.line },
  locked: { opacity: 0.7 },
  lockedTitle: { color: colors.textMuted },
});
