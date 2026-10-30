import { useInitialize } from '../lib/effects';
import React, { useState } from 'react';
import { api } from '../lib/api';
import { reauth, socialCredential } from '../lib/social';
import { Screen, Button, Card, H, P, useAction } from '../components/ui';
export default function Identities() {
  const [identities, setIdentities] = useState<any[]>([]);
  const [providers, setProviders] = useState<Record<string, boolean>>({});
  const a = useAction();
  async function load() {
    const [linked, config] = await Promise.all([api('/me/identities'), api('/app-config')]);
    setIdentities(linked.identities);
    setProviders(config.providers ?? {});
  }
  useInitialize(() => {
    a.run(load);
  }, []);
  return (
    <Screen title="로그인 수단 관리" subtitle="같은 이메일이어도 계정을 자동 병합하지 않습니다.">
      {identities.map((i) => (
        <Card key={i.id}>
          <H>{i.provider === 'google' ? 'Google' : '카카오'} · 연결됨</H>
          <Button
            secondary
            disabled={a.busy || identities.length <= 1}
            onPress={() =>
              a.run(async () => {
                const proof = await reauth();
                await api(
                  `/me/identities/${i.id}`,
                  { expectedVersion: i.version },
                  'DELETE',
                  undefined,
                  { 'X-Reauth-Proof': proof },
                );
                await load();
              })
            }
          >
            연결 해제
          </Button>
        </Card>
      ))}
      {(['kakao', 'google'] as const)
        .filter((p) => !identities.some((i) => i.provider === p))
        .map((provider) => (
          <Button
            key={provider}
            disabled={a.busy || !providers[provider]}
            onPress={() =>
              a.run(async () => {
                const proof = await reauth(),
                  social = await socialCredential(provider, true);
                await api('/me/identities', {
                  provider,
                  credential: social.credential,
                  reauthProof: proof,
                });
                await load();
              })
            }
          >
            {provider === 'google' ? 'Google' : '카카오'} 계정 연결
          </Button>
        ))}
      <P>마지막 로그인 수단은 남겨 둡니다. 다른 계정에 연결된 수단은 연결할 수 없습니다.</P>
      {a.errorView}
    </Screen>
  );
}
