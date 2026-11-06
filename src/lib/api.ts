import { ApiError, NetworkError, shouldLeaveSharedScope } from './api-errors';
export { ApiError } from './api-errors';
import { requireHttps } from './https';
import { randomUUID, digestStringAsync, CryptoDigestAlgorithm } from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Transfer } from '../../modules/atp-transfer';
import type { components } from '../../contracts/generated';
export type Session = components['schemas']['Session'];
export type Media = components['schemas']['Media'] & {
  displayName?: string;
  visitName?: string;
  durationMs?: number | null;
};
export const API = requireHttps(process.env.EXPO_PUBLIC_API_URL ?? 'https://sphan0325.ddns.net');
let session: Session | null = null;
let refreshing: Promise<void> | null = null;
const pendingKeys = new Map<string, string>();
const operationFingerprints = new Map<string, string>();
let pendingWrite: Promise<void> = Promise.resolve();
function persistPending(fingerprint: string, key?: string) {
  pendingWrite = pendingWrite
    .catch(() => {})
    .then(async () => {
      const all = JSON.parse((await AsyncStorage.getItem('atp.pending-requests')) ?? '{}');
      if (key) all[fingerprint] = key;
      else delete all[fingerprint];
      await AsyncStorage.setItem('atp.pending-requests', JSON.stringify(all));
    });
  return pendingWrite;
}
export const sessionEvents = new Set<(s: Session | null) => void>();
export const accessLostEvents = new Set<() => void>();
export async function setSession(s: Session | null) {
  session = s;
  if (s) {
    await SecureStore.setItemAsync('atp.session', JSON.stringify(s));
    await Transfer?.credentials(JSON.stringify(s));
  } else {
    await SecureStore.deleteItemAsync('atp.session');
    await SecureStore.deleteItemAsync('atp.dev-credential');
  }

  for (const listener of sessionEvents) listener(s);
}
export async function restoreSession() {
  const saved = await SecureStore.getItemAsync('atp.session');
  session = saved ? JSON.parse(saved) : null;
  await syncNativeSession();
  return session;
}
export const currentSession = () => session;
// Android Image sends headers only for the array source form. The fragment is never sent
// to the server (which rejects unknown query keys) but still changes the image cache key.
export const coverSource = (groupId: string, version?: number) => [
  {
    uri: `${API}/v1/groups/${groupId}/cover${version === undefined ? '' : `#v=${version}`}`,
    headers: { Authorization: `Bearer ${session?.accessToken}` },
  },
];
export const avatarSource = (userId: string, version: number) => [
  {
    uri: `${API}/v1/users/${userId}/avatar?v=${version}`,
    headers: { Authorization: `Bearer ${session?.accessToken}` },
  },
];
export function documentUrl(value: string) {
  const u = new URL(value, API);
  if (['localhost', '127.0.0.1'].includes(u.hostname)) {
    const base = new URL(API);
    u.host = base.host;
    u.protocol = base.protocol;
  }
  return requireHttps(u.toString());
}
async function syncNativeSession() {
  if (!session || !Transfer) return;
  const raw = await Transfer.session(session.userId);
  if (raw) {
    const native = JSON.parse(raw) as Session;
    if (
      native.userId === session.userId &&
      Date.parse(native.expiresAt) > Date.parse(session.expiresAt)
    ) {
      session = native;
      await SecureStore.setItemAsync('atp.session', raw);
      for (const listener of sessionEvents) listener(session);
    }
  }
}
async function fetchTimed(url: string, options: RequestInit) {
  const controller = new AbortController(),
    timer = setTimeout(() => controller.abort(), 30000);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch {
    throw new NetworkError();
  } finally {
    clearTimeout(timer);
  }
}
export interface RequestOptions { handleAccessLossLocally?: boolean; }
export async function api<T = any>(
  path: string,
  body?: any,
  method = body === undefined ? 'GET' : 'POST',
  key?: string,
  extraHeaders: Record<string, string> = {},
  options: RequestOptions = {},
): Promise<T> {
  await syncNativeSession();
  const mutation = !['GET', 'HEAD'].includes(method),
    fingerprint = `${session?.userId ?? 'public'}:${await digestStringAsync(CryptoDigestAlgorithm.SHA256, `${method}:${path}:${JSON.stringify(body)}`)}`,
    pendingKey = 'atp.pending-requests';
  const pending: Record<string, string> = mutation
    ? JSON.parse((await AsyncStorage.getItem(pendingKey)) ?? '{}')
    : {};
  const idempotency = key ?? pendingKeys.get(fingerprint) ?? pending[fingerprint] ?? randomUUID();
  if (mutation) {
    pendingKeys.set(fingerprint, idempotency);
    await persistPending(fingerprint, idempotency);
  }
  const request = () =>
    fetchTimed(API + '/v1' + path, {
      method,
      headers: {
        ...(session ? { Authorization: `Bearer ${session.accessToken}` } : {}),
        'Content-Type': 'application/json',
        ...(mutation ? { 'Idempotency-Key': idempotency } : {}),
        ...extraHeaders,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  let r = await request();
  if (
    r.status === 401 &&
    session &&
    (!path.startsWith('/auth/') || ['/auth/reauthentication', '/auth/logout'].includes(path))
  ) {
    if (!refreshing)
      refreshing = (async () => {
        const rr = await fetchTimed(API + '/v1/auth/refresh', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Idempotency-Key':
              'refresh-' +
              (await digestStringAsync(CryptoDigestAlgorithm.SHA256, session!.refreshToken)),
          },
          body: JSON.stringify({ refreshToken: session!.refreshToken }),
        });
        if (!rr.ok) {
          if (rr.status === 401 || rr.status === 403) {
            await setSession(null);
            throw new ApiError('AUTH_EXPIRED');
          }
          throw new Error('로그인 상태를 확인할 수 없습니다. 잠시 후 다시 시도해 주세요.');
        }
        await setSession(await rr.json());
      })().finally(() => {
        refreshing = null;
      });
    await refreshing;
    r = await request();
  }
  const data = await r.json().catch(() => {
    throw new Error('서버 응답을 확인할 수 없습니다. 잠시 후 다시 시도해 주세요.');
  });
  const waitingOperation =
    data.operationId && data.kind && !['succeeded', 'failed'].includes(data.state);
  if (mutation && waitingOperation) operationFingerprints.set(data.operationId, fingerprint);
  if (mutation && !waitingOperation && (r.ok || (r.status < 500 && r.status !== 429))) {
    pendingKeys.delete(fingerprint);
    await persistPending(fingerprint);
  }
  if (!r.ok) {
    if (shouldLeaveSharedScope(method, path, r.status, data.code, options.handleAccessLossLocally))
      for (const listener of accessLostEvents) listener();
    throw new ApiError(data.code, data.requestId, data.details, r.status);
  }
  return data;
}
export class PendingOperationError extends ApiError {
  constructor(
    public operationId: string,
    message: string,
  ) {
    super('OPERATION_PENDING', operationId);
    this.message = message;
  }
}
async function finishPending(id: string) {
  const fingerprint = operationFingerprints.get(id);
  if (fingerprint) {
    pendingKeys.delete(fingerprint);
    await persistPending(fingerprint);
    operationFingerprints.delete(id);
  }
}
export async function awaitOperation(result: any) {
  if (!result?.operationId || !result.kind) return result;
  if (!['succeeded', 'failed'].includes(result.state)) {
    const key = `atp.operations:${currentSession()?.userId}`;
    const saved: string[] = JSON.parse((await AsyncStorage.getItem(key)) ?? '[]');
    await AsyncStorage.setItem(
      key,
      JSON.stringify([...new Set([result.operationId, ...saved])].slice(0, 100)),
    );
    result = await api(`/operations/${result.operationId}`);
  }
  for (let i = 0; i < 30; i++) {
    if (result.state === 'succeeded') {
      await finishPending(result.operationId);
      return result.result;
    }
    if (result.state === 'failed') {
      await finishPending(result.operationId);
      throw new ApiError(
        result.itemErrors?.[0]?.code ?? '처리에 실패했습니다.',
        result.operationId,
      );
    }
    if (result.state === 'review')
      throw new PendingOperationError(
        result.operationId,
        '운영 검토를 기다리고 있습니다. 처리 상태에서 결과를 확인해 주세요.',
      );
    await new Promise((r) => setTimeout(r, 1000));
    result = await api(`/operations/${result.operationId}`);
  }
  throw new PendingOperationError(
    result.operationId,
    '처리 결과 확인이 필요합니다. 처리 상태에서 확인해 주세요.',
  );
}
export async function getGroup(id: string, options: RequestOptions = {}) {
  let cursor: string | null = null;
  do {
    const r: any = await api(`/groups${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`, undefined, 'GET', undefined, {}, options);
    const g = r.items.find((g: any) => g.id === id);
    if (g) return g;
    cursor = r.nextCursor;
  } while (cursor);
  throw new ApiError('FORBIDDEN');
}
