import { useInitialize } from '../lib/effects';
import React, { useState } from 'react';
import { useLocalSearchParams, router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../lib/api';
import { useAccount } from '../lib/state';
import { Screen, Field, Button, H, P, Card, useAction } from '../components/ui';
export default function Invite() {
  const params = useLocalSearchParams<{ token?: string }>(),
    [token, setToken] = useState(params.token ?? ''),
    [preview, setPreview] = useState<any>(null);
  const { session } = useAccount(),
    a = useAction();
  useInitialize(() => {
    AsyncStorage.getItem('atp.pending-invite').then((v) => {
      if (v && !params.token) {
        const p = JSON.parse(v);
        setToken(p.token);
        setPreview(p.preview);
      }
    });
  }, []);
  async function check() {
    await a.run(async () => {
      let value = token.trim();
      if (/^(https?:|atthatplace:)/i.test(value)) { try { value = new URL(value).searchParams.get('token') ?? ''; } catch { throw new Error('초대 링크 형식을 확인해 주세요.'); } }
      if (!value) throw new Error('초대 코드 또는 링크를 입력해 주세요.');
      setToken(value);
      const p = await api(`/invite-preview?tokenOrCode=${encodeURIComponent(value)}`);
      setPreview(p);
      await AsyncStorage.setItem('atp.pending-invite', JSON.stringify({ token: value, preview: p }));
    });
  }
  return (
    <Screen title="모임에 초대받았어요" subtitle="초대를 확인한 뒤 참여할 수 있어요.">
      <Field
        label="초대 코드 또는 링크"
        value={token}
        onChangeText={(v) => {
          setToken(v);
          setPreview(null);
        }}
        autoCapitalize="none"
      />
      {!preview ? (
        <Button onPress={check}>초대 확인</Button>
      ) : (
        <Card>
          <H>{preview.groupName}</H>
          <P>{preview.scheduleSummary?.title ?? '예정된 일정이 없어요.'}</P>
          <P>받은 초대는 다른 사람에게 전달하면 그 사람도 참여할 수 있어요.</P>
          <Button
            disabled={a.busy}
            onPress={() =>
              session
                ? a.run(async () => {
                    const r = await api('/invitations/join', { tokenOrCode: token });
                    await AsyncStorage.removeItem('atp.pending-invite');
                    router.replace(`/group/${r.groupId}`);
                  })
                : router.push('/login')
            }
          >
            {session ? '참여하기' : '로그인하고 참여하기'}
          </Button>
        </Card>
      )}
      {a.errorView}
    </Screen>
  );
}
