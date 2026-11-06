import React from 'react';
import { randomUUID } from 'expo-crypto';
import { useAppToast } from '../../components/toast-provider';
import { router } from 'expo-router';
import { api, awaitOperation, ApiError, PendingOperationError } from '../../lib/api';
import { inputText, validPeriod } from '../../lib/validation';
import { useDraft } from '../../lib/state';
import { useFormExit } from '../../lib/unsaved';
import { PeriodPicker } from '../../components/period-picker';
import { Screen, Field, Button, Info, P, useAction } from '../../components/ui';
export default function NewGroup() {
  const [v, set, clear, draft] = useDraft('group-new', {
      name: '',
      title: '',
      startDate: '',
      endDate: '',
      pending: '',
      requestKey: '',
    }),
    a = useAction({ inlineRetry: false });
  const toast = useAppToast();
  const pending = v.pending === 'yes',
    leave = useFormExit(
      !!v.name || !!v.title || !!v.startDate || !!v.endDate || pending,
      clear,
      pending,
    );
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
      const requestKey = v.requestKey || randomUUID();
      set('requestKey', requestKey);
      set('pending', 'yes');
      try {
        const result = await awaitOperation(await api('/groups', body, 'POST', requestKey));
        await clear();
        toast('모임을 만들었어요');
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
          {a.busy
            ? '모임을 만들고 있어요…'
            : pending
              ? '같은 요청 결과 확인'
              : '모임과 첫 일정 만들기 →'}
        </Button>
      }
    >
      <Info icon="🎉" title="함께할 순간을 시작해볼까요?">
        모임을 열고 첫 일정을 가볍게 등록해보세요.
      </Info>
      <Field
        label="모임 이름"
        required
        limit={50}
        hint="어떤 이름이든 좋아요"
        placeholder="예: 주말 산책 모임"
        value={v.name}
        editable={!a.busy && !pending}
        onChangeText={(t) => { set('name', t); set('requestKey', ''); }}
      />
      <Field
        label="첫 일정 제목"
        required
        limit={100}
        hint="언제든 바꿀 수 있어요"
        placeholder="예: 우리의 서울 여행"
        value={v.title}
        editable={!a.busy && !pending}
        onChangeText={(t) => { set('title', t); set('requestKey', ''); }}
      />
      <PeriodPicker
        start={v.startDate}
        end={v.endDate}
        disabled={a.busy || pending}
        onChange={(start, end) => {
          set('requestKey', '');
          set('startDate', start);
          set('endDate', end);
        }}
      />
      <Info icon="">
        ℹ️ 시간은 장소를 추가할 때 입력해요. 반복 설정은 없어요. 필요하면 일정을 더 추가해요.
        {'\n\n'}👥 한국 시간 기준 · 최대 10명 고정 · 정원 변경 없음
      </Info>
      {pending && <Info title="저장 결과를 확인 중이에요">요청은 접수됐을 수 있어요. 내용을 다시 만들지 않고 확인할게요.{'\n'}문의용 번호 {v.requestKey}</Info>}
      {a.errorView}
    </Screen>
  );
}
