import React, { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { completePendingSignIn, pendingBrowserLogin } from '../lib/social';
import { useInitialize } from '../lib/effects';
import { Screen, P, Button, useAction } from './ui';
export function OAuthReturn({ provider }: { provider: 'kakao' | 'google' }) {
  const { state } = useLocalSearchParams<{ state?: string }>();
  const [message, setMessage] = useState('인증 결과를 확인하고 있어요.');
  const a = useAction();
  async function resume() {
    if (!state) throw new Error('인증 정보가 없습니다. 다시 로그인해 주세요.');
    const pending = await pendingBrowserLogin();
    if (pending?.purpose === 'credential') {
      setMessage('본인 확인을 진행한 화면에서 결과를 확인해 주세요. 앱을 다시 실행했다면 해당 작업을 다시 시작해 주세요.');
      return;
    }
    const result = await completePendingSignIn(state, provider);
    router.replace(result.onboardingRequired ? '/onboarding' : (await AsyncStorage.getItem('atp.pending-invite')) ? '/invite' : '/');
  }
  useInitialize(() => { void a.run(resume); }, [state]);
  return <Screen title="로그인 확인" back={false}><P>{message}</P>{a.errorView}
    {a.error && <Button disabled={a.busy} onPress={() => a.run(resume)}>결과 다시 확인</Button>}
    <Button secondary disabled={a.busy} onPress={() => router.replace('/login')}>로그인 화면으로</Button>
  </Screen>;
}
