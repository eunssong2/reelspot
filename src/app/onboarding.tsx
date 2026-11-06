import { installationId } from '../lib/device';
import { useInitialize } from '../lib/effects';
import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api, awaitOperation, documentUrl, ApiError, setSession } from '../lib/api';
import { inputText } from '../lib/validation';
import { useAccount } from '../lib/state';
import { useFormExit } from '../lib/unsaved';
import {
  Screen,
  Sheet,
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
    [name, setName] = useState(''),
    [touched, setTouched] = useState(false),
    [reading, setReading] = useState<any>(null),
    [documentLoaded, setDocumentLoaded] = useState(false),
    [documentFailed, setDocumentFailed] = useState(false),
    [documentRetry, setDocumentRetry] = useState(0);
  const { refresh, profile } = useAccount(),
    a = useAction();
  const leave = useFormExit(true, async () => {
    await api('/auth/logout', { deviceId: await installationId(), pendingAction: 'none' });
    await setSession(null);
  }, false, { title: '가입을 그만둘까요?', body: '입력한 내용은 저장되지 않아요.', cancel: '계속하기', discard: '그만두기' });
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
        if (e instanceof ApiError && e.code === 'CONSENT_REQUIRED') { await load(); throw new Error('동의 문서가 바뀌었어요. 바뀐 항목을 다시 확인해 주세요.'); }
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
          style={{ minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' }}
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
        accessibilityLabel={`${d.title || d.itemKey} ${d.kind === 'consent' ? '동의 선택' : '전문 보기'}`}
        onPress={() => { if (d.kind === 'consent') setAgreed((old) => ({ ...old, [d.id]: !old[d.id] })); else { setReading(d); setDocumentLoaded(false); setDocumentFailed(false); } }}
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
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={`${d.title || d.itemKey} 전문 보기`} onPress={() => { setReading(d); setDocumentLoaded(false); setDocumentFailed(false); }} style={{ minWidth: 48, minHeight: 48, justifyContent: 'center', alignItems: 'center' }}><Text>›</Text></Pressable>
    </View>
  );
  return (
    <Screen
      onBack={() => {
        leave.confirmExit(() => router.replace('/login'));
        return true;
      }}
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
        onBlur={() => setTouched(true)}
        onChangeText={(value) => setName(value.replace(/[\r\n]/g, ''))}
      />
      {(!!name || touched) && !!nameError && (
        <Text accessibilityRole="alert" style={{ color: '#B8433F', marginBottom: 8 }}>
          {nameError}
        </Text>
      )}
      <Info icon="👥">친구들과의 약속 캘린더에서 가장 친근한 별칭으로 함께해보세요!</Info>
      {a.error && !docs.length && <P>동의 문서를 불러오지 못했어요</P>}
      {a.errorView}
      <Sheet visible={!!reading} title={reading?.title ?? '동의 문서'} onClose={() => setReading(null)}>
        {!!reading && <>
          <P>버전 {reading.version}{reading.effectiveAt ? ` · 시행일 ${reading.effectiveAt.slice(0, 10).replaceAll('-', '.')}` : ''}</P>
          {String(reading.version).startsWith('dev-') && <P>초안 · 법무 검토 전이며 운영 문서 확정 후 바뀔 수 있어요.</P>}
          <View style={{ height: 300 }}><WebView key={`${reading.id}:${documentRetry}`} source={{ uri: documentUrl(reading.url) }} javaScriptEnabled={false} mixedContentMode="never" onLoad={() => setDocumentLoaded(true)} onError={() => { setDocumentFailed(true); setDocumentLoaded(false); }} onHttpError={() => { setDocumentFailed(true); setDocumentLoaded(false); }} /></View>
          {documentFailed && <Button onPress={() => { setDocumentFailed(false); setDocumentLoaded(false); setDocumentRetry((v) => v + 1); }}>문서 다시 시도</Button>}
          <Button disabled={!documentLoaded || documentFailed} onPress={() => { if (reading.kind === 'consent') setAgreed((old) => ({ ...old, [reading.id]: true })); setReading(null); }}>{reading.kind === 'consent' ? '동의하고 닫기' : '닫기'}</Button>
        </>}
      </Sheet>
    </Screen>
  );
}
