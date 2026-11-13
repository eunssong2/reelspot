import { useFocusLoad } from '../lib/effects';
import React, { useState } from 'react';
import { View, Text } from 'react-native';
import { api } from '../lib/api';
import { Avatar } from '../components/profile-ui';
import { useAppToast } from '../components/toast-provider';
import { Screen, Button, P, colors, confirm, useAction } from '../components/ui';
/** N11 · UI31: people this account blocked personally. Separate from a group's re-entry block. */
export default function Blocks() {
  const [items, setItems] = useState<any[] | null>(null);
  const a = useAction();
  const toast = useAppToast();
  async function load() {
    setItems((await api('/me/blocks')).blocks);
  }
  useFocusLoad(() => {
    void a.run(load);
  }, []);
  return (
    <Screen
      title="개인 차단 관리"
      subtitle="차단한 사람의 기록은 내 화면과 다운로드에서만 빠져요. 모임 역할과 다른 사람의 화면은 그대로예요."
    >
      {items?.map((b) => (
        <View
          key={b.targetUserId}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.line }}
        >
          <Avatar initial name={b.displayName} size={44} userId={b.targetUserId} avatarVersion={b.avatarVersion} />
          <Text numberOfLines={1} style={{ flex: 1, fontSize: 16, fontWeight: '700', color: colors.ink }}>
            {b.displayName}
          </Text>
          <Button
            small
            secondary
            disabled={a.busy}
            onPress={() =>
              confirm(
                '개인 차단을 해제할까요?',
                '이 사람이 올린 기록이 다시 보이고 다운로드에도 포함돼요.',
                () =>
                  a.run(async () => {
                    await api(`/me/blocks/${b.targetUserId}`, {}, 'DELETE');
                    // The list is read again; record lists and counts reload when their screens return.
                    await load();
                    toast(`${b.displayName}님의 차단을 해제했어요`);
                  }),
                { confirm: '차단 해제', cancel: '돌아가기', subtitle: b.displayName, danger: false },
              )
            }
          >
            해제
          </Button>
        </View>
      ))}
      {items && !items.length && !a.error && (
        <View style={{ alignItems: 'center', paddingVertical: 48, gap: 8 }}>
          <Text style={{ fontSize: 16, fontWeight: '700', color: colors.ink }}>차단한 사람이 없어요</Text>
          <P>기록 확대 보기나 함께하는 친구에서 차단할 수 있어요.</P>
        </View>
      )}
      {a.errorView}
    </Screen>
  );
}
