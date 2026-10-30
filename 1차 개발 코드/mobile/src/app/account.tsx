import React, { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useAccount } from '../lib/state';
import { useFocusLoad } from '../lib/effects';
import { api, awaitOperation } from '../lib/api';
import { inputText } from '../lib/validation';
import { Avatar, MenuRow } from '../components/profile-ui';
import { Screen, Field, P, H, Button, useAction } from '../components/ui';
export default function Account() {
  const { profile, refresh } = useAccount(),
    [name, setName] = useState(profile?.displayName ?? ''),
    [identities, setIdentities] = useState<any[] | null>(null);
  const a = useAction();
  useFocusLoad(() => {
    let live = true;
    void a.run(async () => {
      await refresh();
      const r = await api('/me/identities');
      if (live) setIdentities(r.identities);
    });
    return () => {
      live = false;
    };
  }, []);
  return (
    <Screen title="프로필 및 계정">
      <View style={{ alignItems: 'center', gap: 12, marginVertical: 20 }}>
        <Avatar name={profile?.displayName ?? '나'} size={104} />
        <H>{profile?.displayName}</H>
      </View>
      <Field label="닉네임 · 최대 20자" value={name} onChangeText={setName} />
      <Button
        disabled={a.busy || !profile}
        onPress={() =>
          a.run(async () => {
            const displayName = inputText(name, '닉네임', 20);
            await awaitOperation(
              await api('/me/profile', { displayName, expectedVersion: profile.version }, 'PATCH'),
            );
            await refresh();
          })
        }
      >
        닉네임 저장
      </Button>
      <H>로그인 방식</H>
      {identities?.map((i) => (
        <P key={i.id}>{i.provider === 'kakao' ? '카카오' : 'Google'} · 연결됨</P>
      ))}
      <MenuRow label="로그인 수단 관리" onPress={() => router.push('/identities')} />
      {a.errorCode === 'VERSION_CONFLICT' && (
        <Button secondary onPress={() => a.run(refresh)}>
          최신 프로필 확인 · 입력 유지
        </Button>
      )}
      {a.errorView}
    </Screen>
  );
}
