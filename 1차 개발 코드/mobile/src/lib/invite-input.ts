/** Parse only this app's HTTPS invitations; never follow an arbitrary URL. */
export function parseInviteInput(input: string, apiOrigin: string, fromTokenParameter = false) {
  const value = input.trim();
  if (!value) throw new Error('초대 코드 또는 링크를 입력해 주세요.');
  if (fromTokenParameter) {
    if (!/^[A-Za-z0-9_-]{1,256}$/.test(value)) throw new Error('초대 링크의 토큰을 확인해 주세요.');
    return value;
  }
  if (/^[a-z][a-z0-9+.-]*:/i.test(value)) {
    const url = new URL(value),
      base = new URL(apiOrigin);
    const https =
      url.protocol === 'https:' &&
      url.origin === base.origin &&
      /^\/invite(?:\/[^/]+)?\/?$/.test(url.pathname);
    const app = url.protocol === 'atthatplace:' && url.hostname === 'invite' && !url.pathname;
    if ((!https && !app) || url.username || url.password)
      throw new Error('이 앱에서 발급한 HTTPS 초대 링크를 입력해 주세요.');
    const token =
      url.searchParams.get('token') ||
      url.searchParams.get('code') ||
      (https ? decodeURIComponent(url.pathname.split('/')[2] ?? '') : '');
    if (!token || !/^[A-Za-z0-9_-]{1,256}$/.test(token))
      throw new Error('초대 링크에 올바른 코드가 없어요.');
    return token;
  }
  const code = value.replace(/[\s-]/g, '').toUpperCase();
  if (!/^[A-Z0-9]{1,64}$/.test(code)) throw new Error('초대 코드를 확인해 주세요.');
  return code;
}
/** Live hint for the code field: new codes are 8 × [A-Z0-9]; a link or legacy 12-hex code is also accepted. */
export function inviteCodeHint(input: string) {
  const value = input.trim();
  if (/^[a-z][a-z0-9+.-]*:/i.test(value)) return { kind: 'link' as const, count: 0, valid: true };
  const code = value.replace(/[\s-]/g, '').toUpperCase();
  const valid = /^[A-Z0-9]{8}$/.test(code) || /^[0-9A-F]{12}$/.test(code);
  return { kind: 'code' as const, code, count: code.length, valid };
}
