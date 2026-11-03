import { useInitialize } from '../lib/effects';
import React, { useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api, awaitOperation, documentUrl, ApiError, setSession } from '../lib/api';
import { inputText } from '../lib/validation';
import { useAccount } from '../lib/state';
import { useFormExit } from '../lib/unsaved';
import {
  Screen,
  Button,
  P,
  Info,
  Badge,
  CheckCircle,
  ClearableInput,
  colors,
  useAction,
} from '../components/ui';
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
  const allChecked = consentDocs.length > 0 && consentDocs.every((d) => agreed[d.id]);
  const row = (d: any) => (
    <View
      key={d.id}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        minHeight: 52,
      }}
    >
      {d.kind === 'consent' ? (
        <Pressable
          disabled={a.busy}
          accessibilityRole="checkbox"
          accessibilityLabel={`${d.title || d.itemKey} 동의`}
          accessibilityState={{ checked: !!agreed[d.id] }}
          onPress={() => setAgreed((old) => ({ ...old, [d.id]: !old[d.id] }))}
          style={{ minWidth: 44, minHeight: 48, alignItems: 'center', justifyContent: 'center' }}
        >
          <CheckCircle checked={!!agreed[d.id]} />
        </Pressable>
      ) : (
        <View style={{ minWidth: 44, alignItems: 'center' }}>
          <Text style={{ fontSize: 16 }}>📄</Text>
        </View>
      )}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${d.title || d.itemKey} 전문 보기`}
        onPress={() => a.run(() => Linking.openURL(documentUrl(d.url)))}
        style={{ flex: 1, minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 8 }}
      >
        <Text style={{ color: colors.ink, fontSize: 15, flex: 1 }}>{d.title || d.itemKey}</Text>
        {d.kind === 'notice' ? (
          <Text style={{ fontSize: 12, color: colors.muted, fontWeight: '600' }}>안내</Text>
        ) : d.required ? (
          <Badge style={{ marginBottom: 0 }}>필수</Badge>
        ) : (
          <Text style={{ fontSize: 12, color: colors.sub, fontWeight: '700', paddingHorizontal: 10 }}>
            선택
          </Text>
        )}
        <Text style={{ fontSize: 20, color: colors.muted }}>›</Text>
      </Pressable>
    </View>
  );
  return (
    <Screen
      compact
      heading
      title="처음 오셨네요 👋"
      subtitle="문서를 읽고 필요한 항목에 동의해 주세요."
      footer={
        <Button disabled={!valid || a.busy} onPress={submit}>
          동의하고 시작하기 →
        </Button>
      }
    >
      {consentDocs.length > 0 && (
        <Pressable
          disabled={a.busy}
          accessibilityRole="checkbox"
          accessibilityLabel="약관 전체 동의"
          accessibilityState={{ checked: allChecked }}
          onPress={() =>
            setAgreed(Object.fromEntries(consentDocs.map((d) => [d.id, !allChecked])))
          }
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            gap: 14,
            backgroundColor: colors.surface,
            borderRadius: 20,
            padding: 16,
            marginBottom: 12,
            opacity: pressed ? 0.72 : 1,
          })}
        >
          <View style={{ minWidth: 28, alignItems: 'center' }}>
            <CheckCircle checked={allChecked} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: colors.ink }}>약관 전체 동의</Text>
            <Text style={{ fontSize: 12, color: colors.muted, marginTop: 3 }}>
              선택 동의 항목까지 한 번에 완료해요
            </Text>
          </View>
        </Pressable>
      )}
      {docs.length > 0 && (
        <View
          style={{
            backgroundColor: colors.surface,
            borderRadius: 20,
            paddingVertical: 8,
            paddingHorizontal: 6,
            marginBottom: 24,
          }}
        >
          {[
            ...consentDocs.filter((d) => d.required),
            ...consentDocs.filter((d) => !d.required),
            ...docs.filter((d) => d.kind !== 'consent'),
          ].map(row)}
        </View>
      )}
      {a.hasRun && !a.busy && !consentDocs.some((d) => d.required) && (
        <P>가입에 필요한 게시 이용약관을 준비하고 있어요. 문서가 제공되면 가입할 수 있습니다.</P>
      )}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 10,
        }}
      >
        <Text style={{ fontSize: 15, fontWeight: '800', color: colors.ink }}>
          표시명<Text style={{ color: colors.accent }}> •</Text>
        </Text>
        <Text
          style={{
            fontSize: 11,
            color: colors.sub,
            backgroundColor: colors.surface,
            paddingHorizontal: 8,
            paddingVertical: 5,
            borderRadius: 8,
            overflow: 'hidden',
          }}
        >
          추후 언제든 변경 가능
        </Text>
      </View>
      <ClearableInput
        accessibilityLabel="표시명"
        limit={20}
        helper="중복 표시명도 사용할 수 있어요. 최대 20자"
        placeholder="사용하실 이름을 적어주세요"
        value={name}
        editable={!a.busy}
        onChangeText={setName}
      />
      {!!name && !!nameError && (
        <Text accessibilityRole="alert" style={{ color: '#B8433F', marginBottom: 8 }}>
          {nameError}
        </Text>
      )}
      <Info icon="👥">친구들과의 약속 캘린더에서 가장 친근한 별칭으로 함께해보세요!</Info>
      {a.errorView}
    </Screen>
  );
}
