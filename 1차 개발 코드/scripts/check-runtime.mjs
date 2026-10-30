import { readFile } from 'node:fs/promises';
import { parseEnv } from 'node:util';
let file = {};
try { file = parseEnv(await readFile(new URL('../.env',import.meta.url),'utf8')); } catch { /* report missing settings */ }
const env = { ...file, ...process.env };
const checks = [];
function check(name, ok, needed) { checks.push({ name, ok:Boolean(ok), ...(ok ? {} : { needed }) }); }
check('카카오 로그인', env.KAKAO_APP_ID && env.KAKAO_REST_KEY, 'KAKAO_APP_ID, KAKAO_REST_KEY (Client Secret이 켜져 있으면 KAKAO_CLIENT_SECRET)');
check('Google 로그인', env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET, '웹 애플리케이션 OAuth 클라이언트 ID와 GOOGLE_CLIENT_SECRET');
check('장소 검색', env.KAKAO_REST_KEY, 'KAKAO_REST_KEY');
check('지도 화면', env.EXPO_PUBLIC_KAKAO_JS_KEY, 'EXPO_PUBLIC_KAKAO_JS_KEY');
check('HTTPS 주소', /^https:\/\//.test(env.PUBLIC_URL ?? ''), 'PUBLIC_URL=https://도메인');
check('운영 인증', env.NODE_ENV === 'production' && env.AUTH_MODE === 'provider' && env.OPS_MODE === 'oidc', 'NODE_ENV=production, AUTH_MODE=provider, OPS_MODE=oidc');
check('운영자 인증 설정', env.OPS_ISSUER?.startsWith('https://') && env.OPS_AUDIENCE, 'OPS_ISSUER, OPS_AUDIENCE 및 MFA/역할 발급');
check('공개 전 콘텐츠 검사', ['review','provider'].includes(env.MODERATION_MODE), 'MODERATION_MODE=review 또는 provider. review는 운영자 승인 전까지 비공개');
check('문의 연락처', /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(env.SUPPORT_EMAIL ?? ''), 'SUPPORT_EMAIL');
check('Android 앱 링크', /^(?:[A-Fa-f0-9]{2}:){31}[A-Fa-f0-9]{2}$/.test((env.ANDROID_APP_SHA256 ?? '').split(',')[0]), '설치 APK 서명 인증서의 ANDROID_APP_SHA256');
for(const key of ['TOKEN_SECRET','DATA_SECRET','CURSOR_SECRET']) check(key, env[key]?.length>=32 && !env[key].includes('replace-'), '서로 다른 무작위 32자 이상 비밀값');
for (const c of checks) console.log(`${c.ok ? 'OK' : '필요'} · ${c.name}${c.needed ? ' — '+c.needed : ''}`);
console.log('문서 게시·가입 연령·방장 탈퇴·GPS/백업 정책과 실기기 OAuth는 별도 검수 대상입니다.');
if (process.argv.includes('--require-ready') && checks.some((c)=>!c.ok)) process.exitCode=1;
