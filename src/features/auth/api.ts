import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';

import { isDemo } from '@/lib/env';
import { supabase } from '@/lib/supabase';

import { demoAuth } from './demoSession';

/**
 * 카카오 로그인.
 * Supabase 가 카카오로 리다이렉트할 URL 을 만들어 주고, 앱 안 브라우저로 띄운다.
 * 돌아온 URL 의 code 를 세션으로 바꾼다 (PKCE).
 */
export async function signInWithKakao() {
  if (isDemo) return demoAuth.set(true);

  const redirectTo = Linking.createURL('auth/callback');

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'kakao',
    options: {
      redirectTo,
      // scopes 는 지정하지 않는다. Supabase 는 넘긴 값을 기본값에 "덧붙일" 뿐
      // 대체하지 않아서, 무엇을 넘기든 account_email 이 항상 따라간다.
      // 따라서 카카오 앱의 동의항목에 '카카오계정(이메일)' 이 켜져 있어야 한다.
      // 켜져 있지 않으면 인가 단계에서 KOE205 로 막힌다.
      // 브라우저는 우리가 직접 연다 — 웹용 자동 리다이렉트를 막는다.
      skipBrowserRedirect: true,
    },
  });
  if (error) throw error;
  if (!data.url) throw new Error('카카오 로그인 주소를 받지 못했습니다.');

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);

  if (result.type !== 'success') {
    // 사용자가 취소한 경우도 여기로 온다. 에러로 취급하지 않는다.
    return;
  }

  const code = new URL(result.url).searchParams.get('code');
  if (!code) throw new Error('로그인 응답에 인증 코드가 없습니다.');

  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
  if (exchangeError) throw exchangeError;
}

export async function signOut() {
  if (isDemo) return demoAuth.set(false);

  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}
