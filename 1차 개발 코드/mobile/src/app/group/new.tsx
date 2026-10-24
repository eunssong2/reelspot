import React from 'react';
import { router } from 'expo-router';
import { api, awaitOperation } from '../../lib/api';
import { inputText, validPeriod } from '../../lib/validation';
import { useDraft } from '../../lib/state';
import { Screen, Field, Button, useAction } from '../../components/ui';
export default function NewGroup() {
  const [v, set, clear] = useDraft('group-new', {
      name: '',
      title: '',
      startDate: new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' }),
      endDate: new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' }),
    }),
    a = useAction();
  return (
    <Screen title="우리의 모임 만들기" subtitle="첫 번째 일정을 함께 등록해 주세요.">
      <Field label="모임 이름" value={v.name} onChangeText={(t) => set('name', t)} />
      <Field label="첫 일정 제목" value={v.title} onChangeText={(t) => set('title', t)} />
      <Field
        label="시작 날짜 · YYYY-MM-DD"
        value={v.startDate}
        onChangeText={(t) => set('startDate', t)}
      />
      <Field
        label="종료 날짜 · YYYY-MM-DD"
        value={v.endDate}
        onChangeText={(t) => set('endDate', t)}
      />
      <Button
        disabled={a.busy}
        onPress={() =>
          a.run(async () => {
            inputText(v.name, '모임 이름', 50); inputText(v.title, '일정 제목', 100); validPeriod(v.startDate, v.endDate);
            const r = await awaitOperation(
              await api('/groups', {
                name: v.name,
                firstSchedule: {
                  title: v.title,
                  startDate: v.startDate,
                  endDate: v.endDate,
                  timezone: 'Asia/Seoul',
                },
              }),
            );
            await clear();
            router.replace(`/group/${r.group.id}`);
          })
        }
      >
        모임과 첫 일정 만들기
      </Button>
      {a.errorView}
    </Screen>
  );
}
