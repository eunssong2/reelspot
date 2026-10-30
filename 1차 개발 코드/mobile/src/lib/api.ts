import { requireHttps } from './https';
import { randomUUID, digestStringAsync, CryptoDigestAlgorithm } from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Transfer } from '../../modules/atp-transfer';
import type { components } from '../../../contracts/generated';
export type Session = components['schemas']['Session'];
export type Media = components['schemas']['Media'] & { displayName?: string; visitName?: string; durationMs?: number | null };
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
export class ApiError extends Error {
  constructor(
    public code: string,
    public requestId?: string,
    public details?: any,
  ) {
    super(
      (
        {
          SERVICE_NOT_READY: '서비스 연결을 준비하고 있습니다. 잠시 후 다시 시도해 주세요.',
          KAKAO_NOT_CONFIGURED: '카카오 로그인 연결 설정이 필요합니다.',
          PROVIDER_NOT_CONFIGURED: '이 로그인 수단은 아직 연결되지 않았습니다.',
          DOCUMENT_UNAVAILABLE: '가입 문서를 불러올 수 없습니다. 잠시 후 다시 확인해 주세요.',
          AUTH_INVALID: '로그인 인증에 실패했습니다. 다시 시작해 주세요.',
          AUTH_CANCELLED: '카카오 로그인을 취소했습니다.',
          PROVIDER_QUOTA_EXCEEDED: '장소 검색 무료 한도에 도달했습니다. 지금은 직접 등록을 이용해 주세요.',
          PROVIDER_UNAVAILABLE: '외부 서비스에 연결할 수 없습니다. 잠시 후 다시 시도하거나 직접 등록해 주세요.',
          INVITE_INVALID: '유효하지 않은 초대입니다. 링크나 코드를 확인해 주세요.',
          INVITE_EXPIRED: '초대가 만료되었습니다. 새 초대를 받아 주세요.',
          INVITE_REVOKED: '취소된 초대입니다. 새 초대를 받아 주세요.',
          GROUP_FULL: '모임 정원 10명이 모두 찼습니다.',
          GROUP_CLOSED: '종료된 모임입니다.',
          REENTRY_BLOCKED: '이 모임의 재참여가 차단되어 있습니다.',
          DUPLICATE_VISIT: '이 날짜에 이미 추가한 장소입니다.',
          FILE_TOO_LARGE: '사진은 50MB, 영상은 200MB까지 선택할 수 있습니다.',
          FILE_NOT_READY: '파일을 아직 준비하고 있습니다. 잠시 후 다시 확인해 주세요.',
          AUTH_EXPIRED: '다시 로그인해 주세요.',
          VALIDATION_ERROR:
            '입력한 내용을 확인해 주세요. 날짜는 YYYY-MM-DD, 시각은 5분 단위 HH:mm 형식으로 입력합니다.',
          DATE_OUTSIDE_SCHEDULE: '일정 기간 안의 날짜를 선택해 주세요.',
          FORBIDDEN: '접근 권한이 변경되었습니다.',
          ACCESS_REVOKED: '현재 이용할 수 없는 기능입니다.',
          VERSION_CONFLICT:
            '다른 사람이 먼저 변경했어요. 입력을 유지했으니 최신 내용을 확인해 주세요.',
          EXPIRED: '기록 보관 기한이 지났습니다.',
          INVITE_EXHAUSTED: '초대 확인 횟수를 모두 사용했어요. 현재 참여자에게 새 초대를 요청해 주세요.',
          MEDIA_LIMIT: '이 장소에 올릴 수 있는 사진·영상 개수를 초과했습니다.',
          FILE_INVALID:
            '지원하지 않거나 손상된 파일입니다. 파일 형식을 확인하거나 다시 촬영해 주세요.',
          MEDIA_PROCESSING_FAILED: '파일 처리에 실패했습니다. 잠시 후 다시 시도해 주세요.',
          LOCATION_UNVERIFIED: '촬영 위치 정보를 안전하게 제거하지 못해 공개하지 않았습니다.',
          STORAGE_LIMIT: '모임 저장 공간이 부족합니다. 저장 공간을 확인해 주세요.',
          VISIT_LIMIT: '이 날짜에는 장소를 15개까지 추가할 수 있어요.',
          CONSENT_REQUIRED: '최신 필수 약관을 확인하고 동의해 주세요.',
          OWNER_ROLES_REMAIN: '방장인 모임의 역할을 먼저 정리해 주세요.',
        } as Record<string, string>
      )[code] ?? code,
    );
  }
}
async function fetchTimed(url: string, options: RequestInit) {
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 30000);
  try { return await fetch(url, { ...options, signal: controller.signal }); }
  catch { throw new Error('서버에 연결할 수 없습니다. 네트워크를 확인하고 다시 시도해 주세요. 입력과 대기 파일은 유지됩니다.'); }
  finally { clearTimeout(timer); }
}
export async function api<T = any>(
  path: string,
  body?: any,
  method = body === undefined ? 'GET' : 'POST',
  key?: string,
  extraHeaders: Record<string, string> = {},
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
  if (r.status === 401 && session && (!path.startsWith('/auth/') || ['/auth/reauthentication', '/auth/logout'].includes(path))) {
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
  const data = await r.json().catch(() => { throw new Error('서버 응답을 확인할 수 없습니다. 잠시 후 다시 시도해 주세요.'); });
  const waitingOperation = data.operationId && data.kind && !['succeeded','failed'].includes(data.state);
  if (mutation && waitingOperation) operationFingerprints.set(data.operationId, fingerprint);
  if (mutation && !waitingOperation && (r.ok || (r.status < 500 && r.status !== 429))) {
    pendingKeys.delete(fingerprint);
    await persistPending(fingerprint);
  }
  if (!r.ok) {
    if (method === 'GET' && /^\/(groups|schedules)\//.test(path) && [403, 410].includes(r.status))
      for (const listener of accessLostEvents) listener();
    throw new ApiError(data.code, data.requestId, data.details);
  }
  return data;
}
export class PendingOperationError extends ApiError {
  constructor(public operationId: string, message: string) { super(message, operationId); }
}
async function finishPending(id: string) {
  const fingerprint = operationFingerprints.get(id);
  if (fingerprint) { pendingKeys.delete(fingerprint); await persistPending(fingerprint); operationFingerprints.delete(id); }
}
export async function awaitOperation(result: any) {
  if (!result?.operationId || !result.kind) return result;
  if (!['succeeded','failed'].includes(result.state)) {
    const key = `atp.operations:${currentSession()?.userId}`;
    const saved: string[] = JSON.parse((await AsyncStorage.getItem(key)) ?? '[]');
    await AsyncStorage.setItem(key, JSON.stringify([...new Set([result.operationId,...saved])].slice(0,100)));
    result = await api(`/operations/${result.operationId}`);
  }
  for (let i = 0; i < 30; i++) {
    if (result.state === 'succeeded') { await finishPending(result.operationId); return result.result; }
    if (result.state === 'failed') { await finishPending(result.operationId); throw new ApiError(result.itemErrors?.[0]?.code ?? '처리에 실패했습니다.', result.operationId); }
    if (result.state === 'review') throw new PendingOperationError(result.operationId, '운영 검토를 기다리고 있습니다. 처리 상태에서 결과를 확인해 주세요.');
    await new Promise((r) => setTimeout(r, 1000)); result = await api(`/operations/${result.operationId}`);
  }
  throw new PendingOperationError(result.operationId, '처리 결과 확인이 필요합니다. 처리 상태에서 확인해 주세요.');
}
export async function getGroup(id: string) {
  let cursor: string | null = null;
  do {
    const r: any = await api(`/groups${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`);
    const g = r.items.find((g: any) => g.id === id);
    if (g) return g;
    cursor = r.nextCursor;
  } while (cursor);
  throw new ApiError('FORBIDDEN');
}
