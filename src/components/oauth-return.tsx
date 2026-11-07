import React, { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { completePendingSignIn, pendingBrowserLogin } from '../lib/social';
import { useInitialize } from '../lib/effects';
import { Screen, P, Button, useAction } from './ui';
import { NetworkError } from '../lib/api-errors';
import { loginFailure } from '../lib/login-error';
export function OAuthReturn({ provider }: { provider: 'kakao' | 'google' }) {
  const { state } = useLocalSearchParams<{ state?: string }>();
  const [message, setMessage] = useState('인증 결과를 확인하고 있어요.');
  const [retryable, setRetryable] = useState(false);
  const a = useAction({ inlineRetry: false });
  async function resume() {
    setRetryable(false);
    setMessage('인증 결과를 확인하고 있어요.');
    try {
      if (!state) throw new Error('인증 정보가 없습니다. 다시 로그인해 주세요.');
      const pending = await pendingBrowserLogin();
      if (pending?.purpose === 'credential') {
        setMessage('본인 확인을 진행한 화면에서 결과를 확인해 주세요. 앱을 다시 실행했다면 해당 작업을 다시 시작해 주세요.');
        return;
      }
      const result = await completePendingSignIn(state, provider);
      router.replace(result.onboardingRequired ? '/onboarding' : (await AsyncStorage.getItem('atp.pending-invite')) ? '/invite' : '/');
    } catch (error) {
      setMessage('');
      const pending = await pendingBrowserLogin();
      setRetryable(Boolean(pending && pending.state === state && pending.provider === provider &&
        pending.purpose === 'signin' && (pending.result || error instanceof NetworkError)));
      const failure = loginFailure(error, provider);
      if (!failure) { router.replace('/login'); return; }
      throw failure;
    }
  }
  useInitialize(() => { void a.run(resume); }, [state]);
  return <Screen title="로그인 확인" back={false}>{!!message && <P>{message}</P>}{a.errorView}
    {a.error && retryable && <Button disabled={a.busy} onPress={() => a.run(resume)}>결과 다시 확인</Button>}
    <Button secondary={!a.error || retryable} disabled={a.busy} onPress={() => router.replace('/login')}>로그인 화면으로</Button>
  </Screen>;
}
