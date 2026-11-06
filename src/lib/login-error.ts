import { ApiError, NetworkError } from './api-errors';
export function loginFailure(error: unknown, provider: 'kakao' | 'google'): Error | null {
  if (error instanceof ApiError && error.code === 'AUTH_CANCELLED') return null;
  if (error instanceof NetworkError) return error;
  if (error instanceof ApiError && ['PROVIDER_UNAVAILABLE', 'PROVIDER_QUOTA_EXCEEDED', 'PROVIDER_NOT_CONFIGURED', 'KAKAO_NOT_CONFIGURED'].includes(error.code))
    return new Error(`${provider === 'kakao' ? '카카오' : 'Google'} 로그인이 잠시 원활하지 않아요. 잠시 후 다시 시도하거나 다른 방법으로 시작해 주세요.`);
  return new Error('로그인하지 못했어요. 다시 시도해 주세요.');
}
