import React, { useState } from 'react';
import { View, Text } from 'react-native';
import { uploadAndApplyImage } from '../lib/uploads';
import { router, useLocalSearchParams } from 'expo-router';
import { useAccount } from '../lib/state';
import { useFocusLoad } from '../lib/effects';
import { api, awaitOperation } from '../lib/api';
import { inputText } from '../lib/validation';
import { canSaveNickname, editNickname } from '../lib/nickname';
import { useAppToast } from '../components/toast-provider';
import { EditableAvatar, MenuRow } from '../components/profile-ui';
import {
  Screen,
  ClearableInput,
  Button,
  P,
  Sheet,
  TextButton,
  colors,
  useAction,
} from '../components/ui';
export default function Account() {
  const showToast = useAppToast();
  const { edit } = useLocalSearchParams<{ edit?: string }>();
  const [editing, setEditing] = useState(edit === 'yes');
  const { profile, refresh } = useAccount(),
    [name, setName] = useState<string>(profile?.displayName ?? ''),
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
  const photo = useAction({ inlineRetry: false });
  const providers = [...new Set((identities ?? []).map((i) => i.provider))];
  const saveName = () => {
    if (a.busy || !profile || !canSaveNickname(name)) return;
    return a.run(async () => {
      const displayName = inputText(name, '닉네임', 12);
      await awaitOperation(await api('/me/profile', { displayName, expectedVersion: profile.version }, 'PATCH'));
      await refresh();
      setEditing(false);
      showToast('닉네임을 바꿨어요');
      if (edit === 'yes' && router.canGoBack()) router.back();
    });
  };
  return (
    <Screen title="프로필 및 계정">
      <View style={{ alignItems: 'center', marginTop: 24 }}>
        <EditableAvatar
          name={profile?.displayName ?? '나'}
          size={112}
          userId={profile?.id}
          avatarVersion={profile?.avatarVersion}
          disabled={photo.busy || !profile}
          onPress={() =>
            photo.run(async () => {
              const done = await uploadAndApplyImage({ kind: 'avatar' });
              if (done === false)
                throw new Error('사진을 올리고 있어요. 끝나면 파일 전송 상태에서 프로필 사진으로 적용할 수 있어요.');
              if (done) await refresh();
            })
          }
        />
        <Text style={{ fontSize: 24, fontWeight: '800', color: colors.ink, marginTop: 18 }}>
          {profile?.displayName}
        </Text>
        <TextButton
          color="#3182F6"
          onPress={() => {
            setName(profile?.displayName ?? '');
            setEditing(true);
          }}
        >
          수정
        </TextButton>
        {profile?.avatarVersion != null && (
          <TextButton
            color={colors.sub}
            disabled={photo.busy}
            onPress={() =>
              photo.run(async () => {
                await awaitOperation(
                  await api(
                    '/me/profile',
                    { restoreDefaultAvatar: true, expectedVersion: profile.version },
                    'PATCH',
                  ),
                );
                await refresh();
              })
            }
          >
            기본 사진으로 되돌리기
          </TextButton>
        )}
        {photo.busy && <P>사진을 바꾸고 있어요…</P>}
      </View>
      {photo.error ? photo.errorView : null}
      <View style={{ height: 1, backgroundColor: colors.line, marginVertical: 20 }} />
      <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 48 }}>
        <Text style={{ flex: 1, fontSize: 17, fontWeight: '800', color: colors.ink }}>로그인 방식</Text>
        {providers.map((p) => (
          <View key={p} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginLeft: 12 }}>
            {p === 'kakao' ? (
              <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: '#FEE500' }} />
            ) : (
              <Text style={{ color: '#4285F4', fontWeight: '900', fontSize: 16 }}>G</Text>
            )}
            <Text style={{ fontSize: 15, color: colors.ink }}>{p === 'kakao' ? '카카오' : 'Google'}</Text>
          </View>
        ))}
      </View>
      <MenuRow label="로그인 수단 관리" onPress={() => router.push('/identities')} />
      <Sheet visible={editing} title="닉네임 변경" onClose={() => setEditing(false)}>
        <ClearableInput
          accessibilityLabel="닉네임"
          limit={12}
          value={name}
          onChangeText={(next) => setName((old) => editNickname(old, next))}
          placeholder="닉네임을 입력하세요"
          returnKeyType="done"
          onSubmitEditing={saveName}
          normalizedCount
          editable={!a.busy}
          autoFocus
        />
        {a.errorCode === 'VERSION_CONFLICT' && (
          <Button secondary onPress={() => a.run(refresh)}>
            최신 프로필 확인 · 입력 유지
          </Button>
        )}
        {a.errorView}
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Button style={{ flex: 1 }} secondary onPress={() => setEditing(false)}>
            취소
          </Button>
          <Button
            style={{ flex: 1 }}
            disabled={a.busy || !profile || !canSaveNickname(name)}
            onPress={saveName}
          >
            저장
          </Button>
        </View>
      </Sheet>
      {!editing && a.errorView}
    </Screen>
  );
}
