import { installationId } from '../lib/device';
import { useInitialize } from '../lib/effects';
import React, { useState } from 'react';
import { ActivityIndicator, Image, Linking, Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { LoginCancelled, claimLoginEntry, signInWithProvider } from '../lib/social';
import { loginFailure } from '../lib/login-error';
import * as WebBrowser from 'expo-web-browser';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api, documentUrl, setSession } from '../lib/api';
import { Screen, Field, Button, P, colors, useAction } from '../components/ui';
WebBrowser.maybeCompleteAuthSession();
export default function Login() {
  const [signing, setSigning] = useState<'kakao' | 'google' | null>(null),
    [dev, setDev] = useState(false),
    [name, setName] = useState('demo'),
    [kakao, setKakao] = useState(false),
    [google, setGoogle] = useState(false),
    [docs, setDocs] = useState<any[]>([]),
    [pending, setPending] = useState(false);
  const a = useAction();
  async function load() {
    const config = await api('/app-config');
    setDev(__DEV__ && config.authMode === 'development');
    setKakao(config.providers?.kakao === true);
    setGoogle(config.providers?.google === true);
    setPending(!!(await AsyncStorage.getItem('atp.pending-invite')));
    setDocs((await api('/consent-documents')).documents);
  }
  useInitialize(() => {
    void a.run(load);
  }, []);
  async function login(development = false, provider: 'kakao' | 'google' = 'kakao') {
    await a.run(async () => {
      let r;
      if (development && __DEV__) {
        const credential = `dev:${name}`,
          attempt = await api('/auth/attempts', {
            provider: 'kakao',
            deviceId: await installationId(),
          });
        r = await api('/auth/exchange', { provider: 'kakao', credential, ...attempt });
        await SecureStore.setItemAsync('atp.dev-credential', credential);
        await setSession(r.session);
      } else {
        setSigning(provider);
        try { r = await signInWithProvider(provider); }
        catch (error) {
          if (error instanceof LoginCancelled) return;
          const failure = loginFailure(error, provider);
          if (!failure) return;
          throw failure;
        } finally { setSigning(null); }
      }
      const target = r.onboardingRequired
        ? '/onboarding'
        : (await AsyncStorage.getItem('atp.pending-invite'))
          ? '/invite'
          : '/';
      if (!claimLoginEntry(r)) return;
      // Leave no login screen underneath: back from the next screen must not show it again.
      if (router.canDismiss()) router.dismissAll();
      router.replace(target);
    });
  }
  return (
    <Screen
      title=""
      compact
      back={false}
      footer={
        <>
          <Button tone="kakao" disabled={a.busy || !kakao} onPress={() => login()}>
            {signing === 'kakao' ? <ActivityIndicator accessibilityLabel="카카오 로그인 중" /> : '💬　카카오로 시작하기'}
          </Button>
          {(
            <Button tone="outline" style={{ borderColor: colors.line }} disabled={a.busy || !google} onPress={() => login(false, 'google')}>
              <Text style={{ color: '#4285F4', fontWeight: '800' }}>G</Text>
              {signing === 'google' ? <ActivityIndicator accessibilityLabel="Google 로그인 중" /> : <Text style={{ color: colors.ink }}>　Google로 시작하기</Text>}
            </Button>
          )}
          {!google && !a.busy && <P>Google 로그인을 준비하고 있어요.</P>}
          {!kakao && !a.busy && <P>카카오 로그인 연결을 확인해 주세요.</P>}
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              justifyContent: 'center',
              gap: 8,
              marginTop: 8,
            }}
          >
            {[
              docs.find((d) => ['terms', 'terms-service'].includes(d.itemKey)),
              docs.find((d) => d.itemKey?.startsWith('privacy')) ?? docs.find((d) => d.kind === 'notice'),
            ]
              .filter(Boolean)
              .map((d, i) => (
                <React.Fragment key={d.id}>
                  {i > 0 && <Text style={{ color: colors.muted, alignSelf: 'center' }}>·</Text>}
                  <Pressable
                    accessibilityRole="link"
                    onPress={() => a.run(() => Linking.openURL(documentUrl(d.url)))}
                    style={{ minHeight: 48, justifyContent: 'center' }}
                  >
                    <Text style={{ color: colors.sub, fontSize: 12, textDecorationLine: 'underline' }}>
                      {i === 0 && ['terms', 'terms-service'].includes(d.itemKey) ? '이용약관' : '개인정보처리방침'}
                    </Text>
                  </Pressable>
                </React.Fragment>
              ))}
          </View>
        </>
      }
    >
      <View style={{ alignItems: 'center', paddingTop: 44, gap: 10 }}>
        <Image
          source={require('../../assets/logo.jpg')}
          style={{ width: 90, height: 90, borderRadius: 45 }}
          accessibilityLabel="At that place 로고"
        />
        <Text style={{ color: colors.ink, fontSize: 19, fontWeight: '800', letterSpacing: 1 }}>
          AT THAT PLACE
        </Text>
        <Text style={{ color: colors.muted, fontSize: 10, letterSpacing: 3 }}>
          SHARED MEMORY SPACE
        </Text>
        <Text
          style={{
            fontSize: 24,
            fontWeight: '800',
            textAlign: 'center',
            color: colors.ink,
            marginTop: 24,
          }}
        >
          함께한 순간을{'\n'}한곳에 모아요
        </Text>
        <P>모임의 일정별로 사진과 영상을 함께 보관해요.</P>
      </View>
      {pending && <P>초대받은 모임에 참여하려면 로그인해 주세요.</P>}

      {dev && (
        <>
          <Field label="테스트 사용자 식별자" value={name} onChangeText={setName} />
          <Button secondary disabled={a.busy} onPress={() => login(true)}>
            개발용 테스트 로그인
          </Button>
        </>
      )}
      {a.errorView}
    </Screen>
  );
}
