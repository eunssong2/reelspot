import { useInitialize } from '../lib/effects';
import React, { useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api, awaitOperation, documentUrl, ApiError, setSession } from '../lib/api';
import { inputText } from '../lib/validation';
import { useAccount } from '../lib/state';
import { useFormExit } from '../lib/unsaved';
import { Screen, Field, Button, P, Card, colors, useAction } from '../components/ui';
export default function Onboard() {
  const [docs, setDocs] = useState<any[]>([]),
    [agreed, setAgreed] = useState<Record<string, boolean>>({}),
    [name, setName] = useState('');
  const { refresh, profile } = useAccount(),
    a = useAction();
  const leave = useFormExit(!!name || Object.values(agreed).some(Boolean), async () => {
    await api('/auth/logout', {});
    await setSession(null);
  });
  const load = async () => {
    const next = (await api('/consent-documents?locale=ko')).documents;
    setAgreed((old) =>
      Object.fromEntries(
        next.map((d: any) => [
          d.id,
          !!old[d.id] && docs.some((x) => x.id === d.id && x.version === d.version),
        ]),
      ),
    );
    setDocs(next);
  };
  useInitialize(() => {
    void a.run(async () => {
      await load();
      if (!name && profile?.displayName) setName(profile.displayName);
    });
  }, [profile?.id]);
  let nameError = '';
  try {
    inputText(name, '표시명', 20);
  } catch (e) {
    nameError = (e as Error).message;
  }
  const consentDocs = docs.filter((d) => d.kind === 'consent');
  const valid =
    !nameError &&
    consentDocs.some((d) => d.required && ['terms', 'terms-service'].includes(d.itemKey)) &&
    !consentDocs.some((d) => d.required && !agreed[d.id]);
  async function submit() {
    await a.run(async () => {
      try {
        await awaitOperation(
          await api('/onboarding', {
            displayName: inputText(name, '표시명', 20),
            consents: consentDocs.map((d) => ({
              documentId: d.id,
              version: d.version,
              agreed: !!agreed[d.id],
            })),
          }),
        );
        await refresh();
        const invite = await AsyncStorage.getItem('atp.pending-invite');
        leave(() => router.replace(invite ? '/invite' : '/'));
      } catch (e) {
        if (e instanceof ApiError && e.code === 'CONSENT_REQUIRED') await load();
        throw e;
      }
    });
  }
  return (
    <Screen
      compact
      title="처음 오셨네요 👋"
      subtitle="문서를 읽고 함께 사용할 이름을 정해 주세요."
      footer={
        <Button disabled={!valid || a.busy} onPress={submit}>
          동의하고 시작하기 →
        </Button>
      }
    >
      {docs.map((d) => (
        <Card key={d.id} style={{ backgroundColor: '#F2F4F6', borderWidth: 0 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            {d.kind === 'consent' && (
              <Pressable
                disabled={a.busy}
                accessibilityRole="checkbox"
                accessibilityLabel={`${d.title || d.itemKey} 동의`}
                accessibilityState={{ checked: !!agreed[d.id] }}
                onPress={() => setAgreed((old) => ({ ...old, [d.id]: !old[d.id] }))}
                style={{
                  minWidth: 48,
                  minHeight: 48,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ fontSize: 26, color: agreed[d.id] ? colors.accent : colors.muted }}>
                  {agreed[d.id] ? '☑' : '□'}
                </Text>
              </Pressable>
            )}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${d.title || d.itemKey} 전문 보기`}
              onPress={() => a.run(() => Linking.openURL(documentUrl(d.url)))}
              style={{ flex: 1, minHeight: 48, justifyContent: 'center' }}
            >
              <Text style={{ color: colors.ink, fontSize: 16 }}>{d.title || d.itemKey}　›</Text>
              <P>{d.kind === 'notice' ? '개인정보 처리 안내' : d.required ? '필수' : '선택'}</P>
            </Pressable>
          </View>
        </Card>
      ))}
      {a.hasRun && !a.busy && !consentDocs.some((d) => d.required) && (
        <P>가입에 필요한 게시 이용약관을 준비하고 있어요. 문서가 제공되면 가입할 수 있습니다.</P>
      )}
      <Field
        label="표시명"
        placeholder="사용하실 이름을 적어주세요"
        value={name}
        editable={!a.busy}
        onChangeText={setName}
      />
      <P>중복 표시명도 사용할 수 있어요. 최대 20자</P>
      {!!name && !!nameError && (
        <Text accessibilityRole="alert" style={{ color: '#B8433F' }}>
          {nameError}
        </Text>
      )}
      <P>친구들과의 기록에 표시할 이름입니다. 나중에 변경할 수 있어요.</P>
      {a.errorView}
    </Screen>
  );
}
