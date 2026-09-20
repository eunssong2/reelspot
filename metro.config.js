const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

/**
 * 개발 서버 전용 진단 엔드포인트: GET /__kakao-sdk-check?origin=http://localhost:8081
 * 브라우저는 카카오 SDK 요청이 거부돼도 응답 본문을 읽을 수 없다(CORS).
 * 그래서 개발 서버가 같은 출처(Referer)로 카카오에 다시 요청해 실제 응답 메시지만 돌려준다.
 * - JavaScript 키는 서버의 process.env 에서 읽고, 응답에서는 가려서 브라우저로 나가지 않는다.
 * - localhost / 127.0.0.1 출처만 허용한다. (릴리스 앱에는 포함되지 않는 Metro 전용 코드)
 */
const previous = config.server && config.server.enhanceMiddleware;
config.server = {
  ...config.server,
  enhanceMiddleware: (middleware, server) => {
    const base = previous ? previous(middleware, server) : middleware;
    return (req, res, next) => {
      if (!req.url || !req.url.startsWith('/__kakao-sdk-check')) return base(req, res, next);

      const send = (status, message) => {
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ status, message }));
      };
      const key = process.env.EXPO_PUBLIC_KAKAO_JS_KEY || '';
      const origin = new URL(req.url, 'http://x').searchParams.get('origin') || '';
      if (!key) return send(0, 'EXPO_PUBLIC_KAKAO_JS_KEY 가 설정되지 않았습니다.');
      if (!/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
        return send(0, `허용되지 않는 출처입니다: ${origin}`);
      }
      const url =
        'https://dapi.kakao.com/v2/maps/sdk.js?appkey=' +
        encodeURIComponent(key) +
        '&libraries=services&autoload=false';
      fetch(url, { headers: { Referer: origin + '/' } })
        .then(async (r) => {
          let message = r.ok ? '' : 'HTTP ' + r.status;
          if (!r.ok) {
            try {
              message = (await r.json()).message || message;
            } catch (e) {
              // JSON 이 아니면 상태 코드만
            }
          }
          send(r.status, String(message).split(key).join('<키>'));
        })
        .catch(() => send(0, '카카오 서버에 연결하지 못했습니다.'));
    };
  },
};

module.exports = config;
