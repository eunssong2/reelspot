/**
 * app.json 을 기본으로 쓰고, APP_VARIANT=demo 일 때만 "테스트 앱(데모)" 설정으로 바꾼다.
 *
 *   APP_VARIANT 없음  → app.json 그대로(기존 서비스 앱)
 *   APP_VARIANT=demo  → 앱 이름·패키지 ID 를 따로 써서 기존 앱과 나란히 설치할 수 있다.
 *
 * 데모 APK 만드는 법은 docs/demo-apk.md, 빌드 스크립트는 scripts/build-demo-apk.ps1 참고.
 * (app.json 을 직접 고치지 않으므로 팀의 기존 설정과 충돌하지 않는다.)
 */
module.exports = ({ config }) => {
  if (process.env.APP_VARIANT !== 'demo') return config;

  return {
    ...config,
    name: 'AT THAT PLACE 테스트(데모)',
    scheme: 'reelspot-demo',
    ios: { ...config.ios, bundleIdentifier: 'com.reelspot.app.demo' },
    android: { ...config.android, package: 'com.reelspot.app.demo' },
    extra: { ...config.extra, demo: true },
  };
};
