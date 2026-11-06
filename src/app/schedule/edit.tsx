import { useAppToast } from '../../components/toast-provider';
import { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { api, awaitOperation, ApiError, getGroup, PendingOperationError } from '../../lib/api';
import { useInitialize } from '../../lib/effects';
import { loadGroupDays } from '../../lib/group-days';
import { inputText, validPeriod } from '../../lib/validation';
import { useDraft, useAccount } from '../../lib/state';
import { useFormExit } from '../../lib/unsaved';
import { PeriodPicker } from '../../components/period-picker';
import { todayInSeoul } from '../../lib/preferences';
import { datesBetween, shortDate } from '../../lib/day-labels';
import { Screen, Field, Button, P, useAction } from '../../components/ui';
export default function ScheduleForm() {
  const { id, groupId, date } = useLocalSearchParams<{ id?: string; groupId?: string; date?: string }>();
  if (id) return <Screen title="하루 일정 변경"><P>모임 달력에서 변경할 날짜를 선택해 주세요.</P><Button onPress={() => router.replace({ pathname: '/schedule/[id]', params: { id, ...(date ? { date } : {}) } })}>날짜별 장소 열기</Button></Screen>;
  return <CreateSchedule groupId={groupId} date={date} />;
}
function CreateSchedule({ groupId, date }: { groupId?: string; date?: string }) {
  const { session } = useAccount();
  const toast = useAppToast();
  const [v, set, clear, draft] = useDraft(`schedule:${groupId ?? 'new'}`, { title: '', startDate: date ?? todayInSeoul(), endDate: date ?? todayInSeoul(), pending: '', pendingBody: '' });
  const a = useAction({ inlineRetry: false });
  const [groupName, setGroupName] = useState('');
  const [allowed, setAllowed] = useState(false);
  const [taken, setTaken] = useState<Awaited<ReturnType<typeof loadGroupDays>>>([]);
  const pending = v.pending === 'yes';
  const leave = useFormExit(!!v.title || draft.hasDraft || pending, clear, pending);
  useInitialize(() => {
    if (!session || !groupId || !draft.ready) return;
    void a.run(async () => {
      const g = await getGroup(groupId);
      if (g.ownerUserId !== session.userId) throw new Error('방장만 일정을 추가할 수 있어요.');
      const days = await loadGroupDays(groupId);
      setGroupName(g.name); setTaken(days); setAllowed(true);
    });
  }, [groupId, session?.userId, draft.ready]);
  let valid = true;
  try { inputText(v.title, '일정 제목', 100); validPeriod(v.startDate, v.endDate); } catch { valid = false; }
  const clashes = taken.filter((x) => x.date >= v.startDate && x.date <= v.endDate);
  async function save() {
    await a.run(async () => {
      if (!allowed || !groupId) throw new Error('모임과 권한을 다시 확인해 주세요.');
      try {
        const title = inputText(v.title, '일정 제목', 100); validPeriod(v.startDate, v.endDate);
        if (!pending) {
          const clash = taken.filter((x) => datesBetween(v.startDate, v.endDate).includes(x.date));
          if (clash.length) throw new Error(`이미 다른 일정이 있는 날짜가 들어 있어요: ${clash.map((x) => shortDate(x.date)).join(', ')}. 하루에는 일정을 하나만 만들 수 있어요.`);
        }
        const body = pending && v.pendingBody ? JSON.parse(v.pendingBody) : { title, startDate: v.startDate, endDate: v.endDate, timezone: 'Asia/Seoul' };
        set('pendingBody', JSON.stringify(body)); set('pending', 'yes');
        await awaitOperation(await api(`/groups/${groupId}/schedules`, body));
        toast('일정을 추가했어요');
        await clear(); leave(() => router.dismissTo({ pathname: '/group/[id]', params: { id: groupId, focusDate: v.startDate } }));
      } catch (e) {
        if (e instanceof ApiError && !(e instanceof PendingOperationError) && e.httpStatus && e.httpStatus < 500 && e.httpStatus !== 429) set('pending', '');
        throw e;
      }
    });
  }
  return <Screen title="일정 추가" subtitle={groupName}>
    <Field label="일정 제목" required limit={100} value={v.title} editable={allowed && !pending && !a.busy} onChangeText={(text) => set('title', text)} />
    <PeriodPicker start={v.startDate} end={v.endDate} disabled={!allowed || pending || a.busy} disabledDates={new Set(taken.map((d) => d.date))} onChange={(start, end) => { set('startDate', start); set('endDate', end); }} />
    {!!clashes.length && <P>이미 다른 일정이 있는 날짜가 들어 있어요. 하루에는 일정을 하나만 만들 수 있어요. {clashes.map((x) => shortDate(x.date)).join(', ')}</P>}
    <P>시간은 각 장소에서 입력해요. 반복 설정은 없어요. 한국 시간 기준이에요.</P>
    {pending && <P>저장 결과를 확인 중이에요. 같은 요청으로 결과를 다시 확인해 주세요.</P>}
    <Button disabled={!allowed || !valid || a.busy || (!pending && clashes.length > 0)} onPress={save}>{pending ? '같은 요청 결과 확인' : '저장하기'}</Button>
    {a.errorView}
  </Screen>;
}
