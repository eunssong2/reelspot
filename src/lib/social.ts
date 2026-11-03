import { installationId } from './device';
import * as WebBrowser from 'expo-web-browser';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { api, setSession } from './api';
import { requireHttps } from './https';
type Provider = 'google' | 'kakao';
type PendingLogin = {
  provider: Provider; state: string; verifier: string; expiresAt: number;
  purpose: 'signin' | 'credential';
  result?: { credential: string; loginAttemptId: string; nonce: string };
};
const pendingKey = 'atp.browser-login';
const finishes = new Map<string, Promise<PendingLogin['result']>>();
const signins = new Map<string, Promise<any>>();
export async function pendingBrowserLogin() {
  const raw = await SecureStore.getItemAsync(pendingKey);
  if (!raw) return null;
  let pending: PendingLogin;
  try { pending = JSON.parse(raw); } catch { await SecureStore.deleteItemAsync(pendingKey); return null; }
  if (!pending.state || !pending.verifier || pending.expiresAt <= Date.now()) {
    await SecureStore.deleteItemAsync(pendingKey); return null;
  }
  return pending;
}
async function finishCredential(pending: PendingLogin) {
  if (pending.result) return pending.result;
  let flight = finishes.get(pending.state);
  if (!flight) {
    flight = (async () => {
      const result = await api(`/auth/${pending.provider}/finish`, { state: pending.state, verifier: pending.verifier });
      // Preserve the exchanged credential only until sign-in/reauthentication completes.
      if ((await pendingBrowserLogin())?.state === pending.state)
        await SecureStore.setItemAsync(pendingKey, JSON.stringify({ ...pending, result }));
      return result;
    })();
    finishes.set(pending.state, flight);
    flight.catch(() => finishes.delete(pending.state));
  }
  return (await flight)!;
}
async function beginBrowser(provider: Provider, purpose: PendingLogin['purpose']) {
  const verifier = Crypto.randomUUID().replace(/-/g, '') + Crypto.randomUUID().replace(/-/g, '');
  const verifierHash = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, verifier);
  const start = await api(`/auth/${provider}/start`, {
    verifierHash, deviceId: await installationId(), reauthenticate: purpose === 'credential',
  });
  const expectedReturn = `atthatplace://oauth/${provider}`;
  if (start.returnUri !== expectedReturn) throw new Error('로그인 복귀 주소를 확인할 수 없습니다.');
  const pending: PendingLogin = { provider, state: start.state, verifier, purpose, expiresAt: Date.now() + 600000 };
  await SecureStore.setItemAsync(pendingKey, JSON.stringify(pending));
  const result = await WebBrowser.openAuthSessionAsync(requireHttps(start.authorizationUrl), expectedReturn);
  if (result.type !== 'success') {
    if ((await pendingBrowserLogin())?.state === pending.state) await clearBrowserLogin(pending.state);
    throw new Error('로그인을 취소했습니다.');
  }
  const returned = new URL(result.url);
  if (returned.protocol !== 'atthatplace:' || returned.hostname !== 'oauth' ||
      returned.pathname !== `/${provider}` || returned.searchParams.get('state') !== start.state)
    throw new Error('로그인 요청이 일치하지 않습니다. 다시 시작해 주세요.');
  return pending;
}
export async function clearBrowserLogin(state?: string) {
  const pending = await pendingBrowserLogin();
  if (!state || pending?.state === state) await SecureStore.deleteItemAsync(pendingKey);
  if (state) finishes.delete(state);
}
export async function completePendingSignIn(state: string, provider: Provider) {
  if (signins.has(state)) return signins.get(state)!;
  const flight = (async () => {
    const pending = await pendingBrowserLogin();
    if (!pending || pending.state !== state || pending.provider !== provider || pending.purpose !== 'signin')
      throw new Error('이어갈 로그인 요청이 없습니다. 로그인 화면에서 다시 시작해 주세요.');
    const result = await finishCredential(pending);
    const login = await api('/auth/exchange', { provider, ...result });
    await SecureStore.deleteItemAsync('atp.dev-credential');
    await setSession(login.session);
    await clearBrowserLogin(state);
    return login;
  })();
  signins.set(state, flight);
  // Keep a completed promise briefly so both the browser and deep-link screen share one exchange.
  flight.then(() => { setTimeout(() => signins.delete(state), 60000); }, () => signins.delete(state));
  return flight;
}
export async function signInWithProvider(provider: Provider) {
  const pending = await beginBrowser(provider, 'signin');
  return completePendingSignIn(pending.state, provider);
}
export async function socialCredential(provider: Provider, forceProvider = false) {
  const config = await api('/app-config');
  const saved = config.authMode === 'development' && !forceProvider
    ? await SecureStore.getItemAsync('atp.dev-credential') : null;
  if (saved) return { credential: saved, ...(await api('/auth/attempts', { provider, deviceId: await installationId() })) };
  const pending = await beginBrowser(provider, 'credential');
  try { return await finishCredential(pending); }
  finally { await clearBrowserLogin(pending.state); }
}
export async function reauth() {
  const { identities } = await api('/me/identities');
  const config = await api('/app-config');
  const provider = identities.find((i: any) => i.provider === 'kakao' && config.providers?.kakao)?.provider ?? identities.find((i: any) => config.providers?.[i.provider])?.provider ?? identities[0]?.provider;
  if (!provider) throw new Error('연결된 로그인 수단이 없습니다.');
  const { credential, nonce } = await socialCredential(provider);
  return (await api('/auth/reauthentication', { provider, credential, nonce })).reauthProof as string;
}
