import { useInitialize } from '../lib/effects';
import React, { useState } from 'react';
import { Linking, Switch, View } from 'react-native';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api, awaitOperation, documentUrl } from '../lib/api';
import { useAccount } from '../lib/state';
import { Screen, Field, Button, P, Card, useAction } from '../components/ui';
export default function Onboard() {
  const [docs, setDocs] = useState<any[]>([]),
    [agreed, setAgreed] = useState<Record<string, boolean>>({}),
    [name, setName] = useState('');
  const { refresh, profile } = useAccount(),
    a = useAction();
  useInitialize(() => {
    a.run(async () => { setDocs((await api('/consent-documents?locale=ko')).documents); if (!name && profile?.displayName) setName(profile.displayName); });
  }, [profile?.id]);
  return (
    <Screen title="처음 오셨네요" subtitle="함께할 이름과 동의 항목을 확인해 주세요.">
      <Field label="표시명 · 최대 20자" value={name} onChangeText={setName} />
      {docs.map((d) => (
        <Card key={d.id}>
          <View
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
          >
            <Button secondary onPress={() => Linking.openURL(documentUrl(d.url))}>
              {d.required ? '필수' : '선택'} · {d.itemKey} 열람
            </Button>
            <Switch
              accessibilityLabel={`${d.itemKey} 동의`}
              value={!!agreed[d.id]}
              onValueChange={(v) => setAgreed({ ...agreed, [d.id]: v })}
            />
          </View>
          {d.development && <P>개발용 예시 문서입니다.</P>}
        </Card>
      ))}
      <Button
        disabled={a.busy || !name.trim() || docs.some((d) => d.required && !agreed[d.id])}
        onPress={() =>
          a.run(async () => {
            await awaitOperation(
              await api('/onboarding', {
                displayName: name,
                consents: docs.map((d) => ({
                  documentId: d.id,
                  version: d.version,
                  agreed: !!agreed[d.id],
                })),
              }),
            );
            await refresh();
            router.replace((await AsyncStorage.getItem('atp.pending-invite')) ? '/invite' : '/');
          })
        }
      >
        동의하고 시작하기
      </Button>
      {a.errorView}
    </Screen>
  );
}
