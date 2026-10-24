import React, { useState } from 'react';
import { useLocalSearchParams, router } from 'expo-router';
import { inputText } from '../lib/validation';
import { api, currentSession } from '../lib/api';
import { Screen, Field, Button, useAction, confirm } from '../components/ui';
export default function Report() {
  const { targetType, targetId, userId } = useLocalSearchParams<{
      targetType: string;
      targetId: string;
      userId?: string;
    }>(),
    [reason, setReason] = useState('');
  const a = useAction();
  return (
    <Screen title="신고와 개인 차단" subtitle="신고 접수만으로 파일을 삭제하지 않습니다.">
      <Field label="신고 사유" value={reason} onChangeText={setReason} multiline />
      <Button
        disabled={a.busy || !reason.trim()}
        onPress={() =>
          a.run(async () => {
            inputText(reason, '신고 사유', 2000, true, true);
            await api('/reports', { targetType, targetId, reason });
            router.replace('/notifications');
          })
        }
      >
        신고 접수
      </Button>
      {userId && userId !== currentSession()?.userId && (
        <Button
          secondary
          onPress={() =>
            confirm(
              '이 사용자의 기록을 숨길까요?',
              '상대가 방장이어도 역할은 유지됩니다. 차단은 내 화면에만 적용됩니다.',
              () =>
                a.run(async () => {
                  await api('/me/blocks', { targetUserId: userId });
                  router.back();
                }),
            )
          }
        >
          이 사용자 개인 차단
        </Button>
      )}
      {a.errorView}
    </Screen>
  );
}
