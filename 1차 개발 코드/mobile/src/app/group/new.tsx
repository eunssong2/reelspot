import React from 'react';
import { router } from 'expo-router';
import { api, awaitOperation, ApiError, PendingOperationError } from '../../lib/api';
import { inputText, validPeriod } from '../../lib/validation';
import { useDraft } from '../../lib/state';
import { useFormExit } from '../../lib/unsaved';
import { PeriodPicker } from '../../components/period-picker';
import { Screen, Field, Button, Card, H, P, useAction } from '../../components/ui';
export default function NewGroup() {
  const [v, set, clear, draft] = useDraft('group-new', {
      name: '',
      title: '',
      startDate: '',
      endDate: '',
      pending: '',
    }),
    a = useAction();
  const pending = v.pending === 'yes',
    leave = useFormExit(!!v.name || !!v.title || !!v.startDate || !!v.endDate || pending, clear, pending);
  let valid = true;
  try {
    inputText(v.name, '모임 이름', 50);
    inputText(v.title, '일정 제목', 100);
    validPeriod(v.startDate, v.endDate);
  } catch {
    valid = false;
  }
  async function submit() {
    await a.run(async () => {
      const body = {
        name: inputText(v.name, '모임 이름', 50),
        firstSchedule: {
          title: inputText(v.title, '일정 제목', 100),
          startDate: v.startDate,
          endDate: v.endDate,
          timezone: 'Asia/Seoul',
        },
      };
      validPeriod(v.startDate, v.endDate);
      set('pending', 'yes');
      try {
        const result = await awaitOperation(await api('/groups', body));
        await clear();
        leave(() =>
          router.replace({
            pathname: '/group/[id]',
            params: { id: result.group.id, focusDate: v.startDate },
          }),
        );
      } catch (e) {
        if (
          e instanceof ApiError &&
          !(e instanceof PendingOperationError) &&
          (!e.httpStatus || (e.httpStatus < 500 && e.httpStatus !== 429))
        )
          set('pending', '');
        throw e;
      }
    });
  }
  return (
    <Screen
      compact
      title="새 모임 만들기"
      footer={
        <Button disabled={a.busy || !draft.ready || !valid} onPress={submit}>
          {pending ? '같은 요청의 결과 확인' : '모임과 첫 일정 만들기'}
        </Button>
      }
    >
      <Card style={{ backgroundColor: '#F2F4F6', borderWidth: 0 }}>
        <H>함께할 순간을 시작해볼까요?</H>
        <P>모임을 만들고 첫 일정을 함께 등록해요.</P>
      </Card>
      <Field
        label="모임 이름"
        placeholder="예: 주말 산책 모임"
        value={v.name}
        editable={!a.busy && !pending}
        onChangeText={(t) => set('name', t)}
      />
      <Field
        label="첫 일정 제목"
        placeholder="예: 우리의 서울 여행"
        value={v.title}
        editable={!a.busy && !pending}
        onChangeText={(t) => set('title', t)}
      />
      <PeriodPicker
        start={v.startDate}
        end={v.endDate}
        disabled={a.busy || pending}
        onChange={(start, end) => {
          set('startDate', start);
          set('endDate', end);
        }}
      />
      <Card style={{ backgroundColor: '#F2F4F6', borderWidth: 0 }}>
        <P>시간은 장소를 추가할 때 입력해요. 반복 설정은 없어요. 필요하면 일정을 더 추가해요.</P>
        <P>한국 시간 · 최대 10명 · 정원 변경 없음</P>
      </Card>
      {pending && (
        <P>
          저장 결과를 확인하고 있어요. 같은 요청을 다시 확인하므로 모임을 중복으로 만들지 않습니다.
        </P>
      )}
      {a.errorView}
    </Screen>
  );
}
