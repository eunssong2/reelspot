import React, { useState } from 'react';
import { Alert, Text, View, Pressable } from 'react-native';
import { router } from 'expo-router';
import { useAccount } from '../lib/state';
import { useFocusLoad } from '../lib/effects';
import { api, awaitOperation } from '../lib/api';
import { inputText } from '../lib/validation';
import { canSaveNickname, editNickname } from '../lib/nickname';
import { useAppToast } from '../components/toast-provider';
import { uploadAndApplyImage } from '../lib/uploads';
import { EditableAvatar } from '../components/profile-ui';
import { Screen, Button, ClearableInput, Sheet, colors, useAction } from '../components/ui';
export default function MyPage() {
  const showToast = useAppToast();
  const { profile, refresh } = useAccount();
  const [count, setCount] = useState<number | null>(null);
  const a = useAction();
  useFocusLoad(() => {
    let live = true;
    setCount(null);
    void a.run(async () => {
      await refresh();
      const ids = new Set<string>();
      let cursor: string | null = null;
      const seen = new Set<string>();
      do {
        const r: any = await api(`/groups${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`);
        if (!live) return;
        r.items.forEach((g: any) => ids.add(g.id));
        cursor = r.nextCursor;
        if (cursor && seen.has(cursor)) throw new Error('모임 목록을 다시 불러와 주세요.');
        if (cursor) seen.add(cursor);
      } while (cursor);
      if (live) setCount(ids.size);
    });
    return () => {
      live = false;
    };
  }, []);
  const photo = useAction({ inlineRetry: false }),
    save = useAction({ inlineRetry: false });
  const [editing, setEditing] = useState(false),
    [name, setName] = useState('');
  const saveName = () => {
    if (save.busy || !profile || !canSaveNickname(name)) return;
    return save.run(async () => {
      const displayName = inputText(name, '닉네임', 12);
      await awaitOperation(await api('/me/profile', { displayName, expectedVersion: profile.version }, 'PATCH'));
      await refresh();
      setEditing(false);
      showToast('닉네임을 바꿨어요');
    });
  };
  return (
    <Screen
      title="마이페이지"
      compact
      back={false}
      tabs
      headerRight={
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="설정"
          onPress={() => router.push('/settings')}
          style={{ padding: 10 }}
        >
          <Text style={{ fontSize: 24, color: colors.ink }}>⚙</Text>
        </Pressable>
      }
      footer={
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Pressable
            accessibilityRole="button"
            onPress={() => Alert.alert('공지사항', '공지사항은 준비 중이에요.')}
            style={{ flex: 1, minHeight: 52, alignItems: 'center', justifyContent: 'center' }}
          >
            <Text style={{ fontSize: 15, fontWeight: '800', color: colors.ink }}>공지사항</Text>
          </Pressable>
          <View style={{ width: 1, height: 24, backgroundColor: colors.line }} />
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/inquiry')}
            style={{ flex: 1, minHeight: 52, alignItems: 'center', justifyContent: 'center' }}
          >
            <Text style={{ fontSize: 15, fontWeight: '800', color: colors.ink }}>고객센터</Text>
          </Pressable>
        </View>
      }
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 18, marginVertical: 16 }}>
        <EditableAvatar
          name={profile?.displayName ?? '나'}
          size={96}
          userId={profile?.id}
          avatarVersion={profile?.avatarVersion}
          disabled={photo.busy || !profile}
          onPress={() =>
            photo.run(async () => {
              const done = await uploadAndApplyImage({ kind: 'avatar' });
              if (done) showToast('프로필 사진을 바꿨어요');
              if (done === false)
                throw new Error('사진을 올리고 있어요. 끝나면 파일 전송 상태에서 프로필 사진으로 적용할 수 있어요.');
              if (done) await refresh();
            })
          }
        />
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 24, fontWeight: '800', color: colors.ink }}>
            {profile?.displayName ?? '불러오는 중'}
          </Text>
          <Text style={{ fontSize: 14, color: colors.muted, marginTop: 6 }}>
            {photo.busy ? '사진을 올리고 있어요…' : '함께한 순간을 기록하는 중'}
          </Text>
        </View>
      </View>
      {photo.error ? photo.errorView : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`참여한 모임 ${count ?? ''}개, 내 모임으로 이동`}
        onPress={() => router.replace('/')}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: colors.surface,
          borderRadius: 22,
          paddingHorizontal: 20,
          minHeight: 76,
          marginVertical: 7,
          opacity: pressed ? 0.72 : 1,
        })}
      >
        <Text style={{ flex: 1, fontSize: 15, fontWeight: '700', color: colors.sub }}>참여한 모임</Text>
        <Text style={{ fontSize: 24, fontWeight: '900', color: colors.ink }}>
          {count === null ? '—' : `${count}개`}
        </Text>
        <Text style={{ fontSize: 20, color: colors.muted, marginLeft: 10 }}>›</Text>
      </Pressable>
      <Button
        secondary
        onPress={() => {
          setName(profile?.displayName ?? '');
          setEditing(true);
        }}
      >
        닉네임 변경
      </Button>
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
          editable={!save.busy}
          autoFocus
        />
        {save.errorView}
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Button style={{ flex: 1 }} secondary onPress={() => setEditing(false)}>
            취소
          </Button>
          <Button
            style={{ flex: 1 }}
            disabled={save.busy || !profile || !canSaveNickname(name)}
            onPress={saveName}
          >
            저장
          </Button>
        </View>
      </Sheet>
      {a.errorView}
    </Screen>
  );
}
