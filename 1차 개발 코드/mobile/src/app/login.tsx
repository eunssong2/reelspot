import { installationId } from '../lib/device';
import { useInitialize } from '../lib/effects';
import React, { useState } from 'react';
import { Linking } from 'react-native';
import { router } from 'expo-router';
import { signInWithProvider } from '../lib/social';
import * as WebBrowser from 'expo-web-browser';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api, documentUrl, setSession } from '../lib/api';
import { Screen, Field, Button, P, useAction } from '../components/ui';
WebBrowser.maybeCompleteAuthSession();
export default function Login() {
  const [dev, setDev] = useState(false),
    [name, setName] = useState('demo'),
    [providers, setProviders] = useState<{ kakao: boolean; google: boolean }>({
      kakao: false,
      google: false,
    });
  const [docs, setDocs] = useState<any[]>([]);
  const a = useAction();
  async function load() {
    const config = await api('/app-config');
    setDev(config.authMode === 'development');
    setProviders(config.providers ?? { kakao: false, google: false });
    setDocs((await api('/consent-documents')).documents);
  }
  useInitialize(() => { void a.run(load); }, []);
  async function login(provider: 'kakao' | 'google', development = false) {
    await a.run(async () => {
      let r;
      if (development) {
        const credential = `dev:${name}`;
        const attempt = await api('/auth/attempts', { provider, deviceId: await installationId() });
        r = await api('/auth/exchange', { provider, credential, ...attempt });
        await SecureStore.setItemAsync('atp.dev-credential', credential);
        await setSession(r.session);
      } else r = await signInWithProvider(provider);
      const invite = await AsyncStorage.getItem('atp.pending-invite');
      router.replace(r.onboardingRequired ? '/onboarding' : invite ? '/invite' : '/');
    });
  }
  return (
    <Screen
      title={'함께한 순간을\n한곳에 모아요'}
      subtitle="여행도, 주말의 산책도. 함께 남기고 오래 기억해요."
      back={false}
    >
      {dev && (
        <>
          <P>개발 환경 로그인</P>
          <Field
            label="테스트 사용자 식별자"
            value={name}
            onChangeText={setName}
            autoCapitalize="none"
          />
        </>
      )}
      <Button tone="kakao" disabled={a.busy || !providers.kakao} onPress={() => login('kakao')}>
        카카오로 시작하기
      </Button>
      {!providers.kakao && <P>카카오 로그인 연결을 준비하고 있어요.</P>}
      <Button secondary disabled={a.busy || !providers.google} onPress={() => login('google')}>
        Google로 시작하기
      </Button>
      {dev && (
        <Button secondary disabled={a.busy} onPress={() => login('google', true)}>
          개발용 테스트 로그인
        </Button>
      )}
      <P>로그인 시 소셜 계정 식별정보를 받아 계정을 연결합니다. 가입 전에 이용약관과 개인정보 처리 안내를 확인해 주세요.</P>
      {docs.map((d) => <Button key={d.id} secondary onPress={() => a.run(() => Linking.openURL(documentUrl(d.url)))}>{d.title || d.itemKey} 보기</Button>)}
      {a.errorView}
      {a.error && <Button secondary disabled={a.busy} onPress={() => a.run(load)}>연결 다시 확인</Button>}
    </Screen>
  );
}
