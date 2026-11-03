/** Web network endpoints must use TLS. Custom app and content/file URIs are separate. */
export function requireHttps(value: string): string {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password) {
    throw new Error('연결 주소는 HTTPS를 사용해야 합니다.');
  }
  return value;
}
