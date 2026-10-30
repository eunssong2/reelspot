import { useInitialize } from '../lib/effects';
import React, { useState } from 'react';
import { api } from '../lib/api';
import { Screen, Button, Card, H, P, useAction } from '../components/ui';
export default function Blocks() {
  const [items, setItems] = useState<any[]>([]);
  const a = useAction();
  async function load() {
    setItems((await api('/me/blocks')).blocks);
  }
  useInitialize(() => {
    a.run(load);
  }, []);
  return (
    <Screen
      title="개인 차단 관리"
      subtitle="내 공동 감상과 저장에서 상대의 기록을 숨깁니다. 모임 역할과 다른 사람의 화면에는 영향을 주지 않아요."
    >
      {items.map((b) => (
        <Card key={b.targetUserId}>
          <H>{b.displayName}</H>
          <Button
            secondary
            onPress={() =>
              a.run(async () => {
                await api(`/me/blocks/${b.targetUserId}`, {}, 'DELETE');
                await load();
              })
            }
          >
            개인 차단 해제
          </Button>
        </Card>
      ))}
      {!items.length && <P>차단한 사용자가 없습니다.</P>}
      {a.errorView}
    </Screen>
  );
}
