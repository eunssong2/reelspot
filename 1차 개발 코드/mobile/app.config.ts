import type { ExpoConfig, ConfigContext } from 'expo/config';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseEnv } from 'node:util';
export default ({ config }: ConfigContext): ExpoConfig => {
  let rootEnv: Record<string, string> = {};
  try {
    rootEnv = parseEnv(readFileSync(resolve(__dirname, '../.env'), 'utf8'));
  } catch {
    /* Public config may come from CI. */
  }
  const mapOrigin =
    process.env.EXPO_PUBLIC_KAKAO_WEB_ORIGIN ??
    rootEnv.EXPO_PUBLIC_KAKAO_WEB_ORIGIN ??
    'https://sphan0325.ddns.net';
  if (new URL(mapOrigin).protocol !== 'https:')
    throw new Error('Kakao map WebView origin must use HTTPS');
  const domain = process.env.EXPO_PUBLIC_APP_LINK_DOMAIN ?? new URL(process.env.EXPO_PUBLIC_API_URL ?? rootEnv.PUBLIC_URL ?? 'https://sphan0325.ddns.net').hostname;
  return {
    ...config,
    name: config.name ?? 'At that place',
    slug: config.slug ?? 'at-that-place',
    // Explicit allowlist: never spread rootEnv into the client bundle.
    extra: {
      ...config.extra,
      kakaoJsKey: process.env.EXPO_PUBLIC_KAKAO_JS_KEY ?? rootEnv.EXPO_PUBLIC_KAKAO_JS_KEY ?? '',
      kakaoWebOrigin: mapOrigin,
    },
    plugins: [...(config.plugins ?? [])].map((plugin) =>
      Array.isArray(plugin) && plugin[0] === 'expo-build-properties'
        ? [
            plugin[0],
            {
              ...plugin[1],
              android: { ...plugin[1]?.android, usesCleartextTraffic: false },
            },
          ]
        : plugin,
    ),
    android: {
      ...config.android,
      ...(domain
        ? {
            intentFilters: [
              {
                action: 'VIEW',
                autoVerify: true,
                category: ['BROWSABLE', 'DEFAULT'],
                data: [{ scheme: 'https', host: domain, pathPrefix: '/invite' }],
              },
            ],
          }
        : {}),
    },
  };
};
