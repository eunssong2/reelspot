import { useInitialize } from '../lib/effects';
import React, { useRef, useState } from 'react';
import { useLocalSearchParams, router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api, API } from '../lib/api';
import { parseInviteInput } from '../lib/invite-input';
import { useAccount } from '../lib/state';
import { Screen, Field, Button, H, P, Card, Badge, Info, useAction } from '../components/ui';
export default function Invite() {
  const params = useLocalSearchParams<{ token?: string; code?: string }>(),
    [token, setToken] = useState(params.token ?? params.code ?? ''),
    [opaqueToken, setOpaqueToken] = useState(!!params.token),
    [preview, setPreview] = useState<any>(null),
    generation = useRef(0);
  const { session, profile } = useAccount(),
    a = useAction();
  async function check(input = token, preserveToken = opaqueToken) {
    const request = ++generation.current;
    setToken(input);
    setOpaqueToken(preserveToken);
    setPreview(null);
    await a.run(async () => {
      await AsyncStorage.removeItem('atp.pending-invite');
      const value = parseInviteInput(input, API, preserveToken);
      const result = await api(`/invite-preview?tokenOrCode=${encodeURIComponent(value)}`);
      if (request !== generation.current) return;
      setToken(value);
      setOpaqueToken(true);
      setPreview(result);
      await AsyncStorage.setItem(
        'atp.pending-invite',
        JSON.stringify({ token: value, preview: result }),
      );
    });
  }
  useInitialize(() => {
    void a.run(async () => {
      let saved: any = null;
      try {
        saved = JSON.parse((await AsyncStorage.getItem('atp.pending-invite')) ?? 'null');
      } catch {
        await AsyncStorage.removeItem('atp.pending-invite');
      }
      const incoming = params.token ?? params.code;
      if (saved?.token && saved?.preview && (!incoming || incoming === saved.token)) {
        setToken(saved.token);
        setOpaqueToken(true);
        setPreview(saved.preview);
      } else if (incoming) await check(incoming, !!params.token);
    });
  }, [params.token, params.code]);
  async function join() {
    if (!session || profile?.status === 'onboarding') {
      router.push(session ? '/onboarding' : '/login');
      return;
    }
    await a.run(async () => {
      const result = await api('/invitations/join', { tokenOrCode: token });
      await AsyncStorage.removeItem('atp.pending-invite');
      router.replace(`/group/${result.groupId}`);
    });
  }
  return (
    <Screen
      compact
      title="초대 확인"
      subtitle="초대를 확인하고 모임의 순간을 함께 남겨요."
      footer={
        preview ? (
          <Button disabled={a.busy} onPress={join}>
            {!session
              ? '로그인하고 참여 계속하기'
              : profile?.status === 'onboarding'
                ? '가입하고 참여 계속하기'
                : '모임 참여하기 →'}
          </Button>
        ) : (
          <Button disabled={a.busy || !token.trim()} onPress={() => check()}>
            초대 확인
          </Button>
        )
      }
    >
      <H>{preview ? '모임에 초대받았어요!' : '초대 코드 입력'}</H>
      <Field
        label="초대 코드 또는 링크"
        placeholder="받은 코드 또는 링크를 입력해 주세요"
        value={token}
        editable={!a.busy}
        autoCapitalize="none"
        onChangeText={(v) => {
          generation.current++;
          setToken(v);
          setOpaqueToken(false);
          setPreview(null);
          void AsyncStorage.removeItem('atp.pending-invite');
        }}
      />
      {preview && (
        <>
          <Card style={{ backgroundColor: '#FDEDEB', borderWidth: 0 }}>
            <Badge>초대받은 모임</Badge>
            <H>{preview.groupName}</H>
            <P>{preview.scheduleSummary?.title ?? '예정된 일정이 없어요.'}</P>
            {preview.scheduleSummary?.startDate && (
              <P>
                {preview.scheduleSummary.startDate} ~ {preview.scheduleSummary.endDate}
              </P>
            )}
            <P>참여 후 이 모임의 일정과 기록을 볼 수 있어요.</P>
          </Card>
          <Info>확인한 내용은 로그인 뒤에도 유지돼요. 참여 버튼을 눌러야 모임에 참여합니다.</Info>
        </>
      )}
      {a.errorView}
    </Screen>
  );
}
