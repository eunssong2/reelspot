import React, { useState } from 'react';
import { View, Text } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useAccount } from '../lib/state';
import { useFocusLoad } from '../lib/effects';
import { api, awaitOperation } from '../lib/api';
import { inputText } from '../lib/validation';
import { Avatar, MenuRow } from '../components/profile-ui';
import { Screen, Field, H, Button, Sheet, TextButton, colors, useAction } from '../components/ui';
export default function Account() {
  const { edit } = useLocalSearchParams<{ edit?: string }>();
  const [editing, setEditing] = useState(edit === 'yes');
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
      <View style={{ alignItems: 'center', marginBottom: 32 }}>
        <TextButton
          onPress={() => {
            setName(profile?.displayName ?? '');
            setEditing(true);
          }}
        >
          수정
        </TextButton>
      </View>
      <Sheet visible={editing} title="닉네임 변경" onClose={() => setEditing(false)}>
        <Field label="닉네임" limit={20} value={name} onChangeText={setName} />
        <Button
          disabled={a.busy || !profile}
          onPress={() =>
            a.run(async () => {
              const displayName = inputText(name, '닉네임', 20);
              await awaitOperation(
                await api(
                  '/me/profile',
                  { displayName, expectedVersion: profile.version },
                  'PATCH',
                ),
              );
              await refresh();
              setEditing(false);
            })
          }
        >
          닉네임 저장
        </Button>
        <Button secondary onPress={() => setEditing(false)}>
          취소
        </Button>
        {a.errorView}
      </Sheet>
      <H>로그인 방식</H>
      {identities?.map((i) => (
        <View
          key={i.id}
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            paddingVertical: 20,
            borderTopWidth: 1,
            borderColor: colors.line,
          }}
        >
          <Text style={{ color: colors.sub }}>연결된 계정</Text>
          <Text style={{ color: colors.ink }}>
            {i.provider === 'kakao' ? '🟡 카카오' : 'Google'}
          </Text>
        </View>
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
