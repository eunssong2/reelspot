import type { FastifyInstance } from 'fastify';
import { config } from '../core/config.js';
import { demand } from '../core/errors.js';
export function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}
export function page(title: string, body: string) {
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="no-referrer"><meta name="robots" content="noindex,nofollow"><title>${escapeHtml(title)} · At that place</title><style>body{font-family:system-ui,sans-serif;max-width:680px;margin:40px auto;padding:24px;color:#191f28;line-height:1.7}a{color:#b83e3a}a.button{display:inline-block;padding:12px 24px;border-radius:14px;background:#f1706b;color:#fff;text-decoration:none}pre{white-space:pre-wrap;overflow-wrap:anywhere;font:inherit}input{box-sizing:border-box;width:100%;padding:12px;font:inherit}</style></head><body><h1>${escapeHtml(title)}</h1>${body}</body></html>`;
}
export const publicPageHeaders = {
  'Cache-Control': 'no-store',
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
  'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
};
export function registerPublicPages(app: FastifyInstance) {
  app.get('/invite', async (req, reply) => {
    const { token } = req.query as { token?: string };
    demand(typeof token === 'string' && /^[A-Za-z0-9_-]{12,128}$/.test(token), 'INVITE_INVALID');
    const appUrl = `atthatplace://invite?token=${encodeURIComponent(token)}`;
    // Link scanners and social preview bots must not consume the 50-preview allowance.
    // Only the explicit "초대 확인" action inside the app calls invite-preview.
    return reply.headers(publicPageHeaders).type('text/html; charset=utf-8').send(page('모임에 초대받았어요', `
      <p>함께한 사진과 영상을 모임 안에서 모아 보세요.</p>
      <p><a class="button" href="${escapeHtml(appUrl)}">앱에서 초대 확인</a></p>
      <p>앱이 열리지 않으면 앱을 설치한 뒤 ‘설정 → 초대코드 입력’에 아래 링크를 붙여 넣어 주세요. 설치 파일은 초대한 사람에게 받을 수 있습니다.</p>
      <label>초대 링크<input readonly aria-label="초대 링크" value="${escapeHtml(new URL('/invite?token=' + encodeURIComponent(token), config.publicUrl).href)}"></label>
      <p>초대는 발급일부터 7일간, 초대 확인 50회까지 사용할 수 있습니다. 다른 사람에게 전달하면 그 사람도 참여할 수 있으니 공유 대상을 확인해 주세요.</p>`));
  });
  app.get('/.well-known/assetlinks.json', async (_req, reply) => {
    const fingerprints = (process.env.ANDROID_APP_SHA256 ?? '').split(',').map((v) => v.trim().toUpperCase()).filter(Boolean);
    demand(fingerprints.length && fingerprints.every((v) => /^(?:[A-F0-9]{2}:){31}[A-F0-9]{2}$/.test(v)), 'APP_LINK_NOT_CONFIGURED', 503);
    return reply.header('Cache-Control', 'public, max-age=300').send([{
      relation: ['delegate_permission/common.handle_all_urls'],
      target: { namespace: 'android_app', package_name: 'kr.atthatplace.app', sha256_cert_fingerprints: fingerprints },
    }]);
  });
}
