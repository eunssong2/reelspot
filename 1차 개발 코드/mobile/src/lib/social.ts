import * as AuthSession from 'expo-auth-session';
import * as SecureStore from 'expo-secure-store';
import { api } from './api';
export async function socialCredential(provider: 'google' | 'kakao') {
  const attempt = await api('/auth/attempts', { provider, deviceId: 'android-install' }),
    config = await api('/app-config');
  if (config.authMode === 'development') {
    const saved = await SecureStore.getItemAsync('atp.dev-credential');
    if (!saved) throw new Error('개발 사용자로 다시 로그인해 주세요.');
    return { credential: saved, ...attempt };
  }
  const google = provider === 'google',
    clientId = google
      ? process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID
      : process.env.EXPO_PUBLIC_KAKAO_CLIENT_ID;
  if (!clientId) throw new Error('로그인 연결 설정이 필요합니다.');
  const discovery = {
      authorizationEndpoint: google
        ? 'https://accounts.google.com/o/oauth2/v2/auth'
        : 'https://kauth.kakao.com/oauth/authorize',
      tokenEndpoint: google
        ? 'https://oauth2.googleapis.com/token'
        : 'https://kauth.kakao.com/oauth/token',
    },
    redirectUri = AuthSession.makeRedirectUri({ scheme: 'atthatplace', path: 'oauth' });
  const request = new AuthSession.AuthRequest({
    clientId,
    redirectUri,
    scopes: google ? ['openid', 'profile'] : ['openid'],
    responseType: AuthSession.ResponseType.Code,
    usePKCE: true,
    extraParams: { nonce: attempt.nonce },
  });
  const result = await request.promptAsync(discovery);
  if (result.type !== 'success') throw new Error('인증을 취소했습니다.');
  const token = await AuthSession.exchangeCodeAsync(
    {
      clientId,
      code: result.params.code,
      redirectUri,
      extraParams: { code_verifier: request.codeVerifier! },
    },
    discovery,
  );
  return { credential: google ? token.idToken! : token.accessToken, ...attempt };
}
export async function reauth() {
  const { identities } = await api('/me/identities');
  const provider = identities[0]?.provider;
  if (!provider) throw new Error('연결된 로그인 수단이 없습니다.');
  const { credential, nonce } = await socialCredential(provider);
  return (await api('/auth/reauthentication', { provider, credential, nonce }))
    .reauthProof as string;
}
