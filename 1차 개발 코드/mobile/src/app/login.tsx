import { useInitialize } from '../lib/effects';
import React, { useState } from 'react';
import { router } from 'expo-router';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api, setSession } from '../lib/api';
import { Screen, Field, Button, P, useAction } from '../components/ui';
WebBrowser.maybeCompleteAuthSession();
export default function Login() {
  const [dev, setDev] = useState(false),
    [name, setName] = useState('demo');
  const a = useAction();
  useInitialize(() => {
    a.run(async () => setDev((await api('/app-config')).authMode === 'development'));
  }, []);
  async function login(provider: 'kakao' | 'google') {
    await a.run(async () => {
      const attempt = await api('/auth/attempts', { provider, deviceId: 'android-install' });
      let credential = `dev:${name}`;
      if (!dev) {
        const isGoogle = provider === 'google',
          clientId = isGoogle
            ? process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID
            : process.env.EXPO_PUBLIC_KAKAO_CLIENT_ID;
        if (!clientId) throw new Error('로그인 연결 설정이 필요합니다.');
        const discovery = {
          authorizationEndpoint: isGoogle
            ? 'https://accounts.google.com/o/oauth2/v2/auth'
            : 'https://kauth.kakao.com/oauth/authorize',
          tokenEndpoint: isGoogle
            ? 'https://oauth2.googleapis.com/token'
            : 'https://kauth.kakao.com/oauth/token',
        };
        const redirectUri = AuthSession.makeRedirectUri({ scheme: 'atthatplace', path: 'oauth' });
        const request = new AuthSession.AuthRequest({
          clientId,
          redirectUri,
          scopes: isGoogle ? ['openid', 'profile'] : ['openid'],
          responseType: AuthSession.ResponseType.Code,
          usePKCE: true,
          extraParams: { nonce: attempt.nonce },
        });
        const result = await request.promptAsync(discovery);
        if (result.type !== 'success') throw new Error('로그인을 취소했습니다.');
        const tokens = await AuthSession.exchangeCodeAsync(
          {
            clientId,
            code: result.params.code,
            redirectUri,
            extraParams: { code_verifier: request.codeVerifier! },
          },
          discovery,
        );
        credential = isGoogle ? tokens.idToken! : tokens.accessToken;
      }
      const r = await api('/auth/exchange', { provider, credential, ...attempt });
      if (dev) await SecureStore.setItemAsync('atp.dev-credential', credential);
      await setSession(r.session);
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
      <Button disabled={a.busy} onPress={() => login('kakao')}>
        카카오로 시작하기
      </Button>
      <Button secondary disabled={a.busy} onPress={() => login('google')}>
        Google로 시작하기
      </Button>
      {a.errorView}
    </Screen>
  );
}
