import type { ExpoConfig, ConfigContext } from 'expo/config';
export default ({ config }: ConfigContext): ExpoConfig => {
  const domain = process.env.EXPO_PUBLIC_APP_LINK_DOMAIN;
  const localPreview = process.env.ATP_LOCAL_PREVIEW === '1';
  return {
    ...config,
    name: config.name ?? 'At that place',
    slug: config.slug ?? 'at-that-place',
    plugins: [...(config.plugins ?? []), ['react-native-maps', { androidGoogleMapsApiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? '' }]].map((plugin) =>
      Array.isArray(plugin) && plugin[0] === 'expo-build-properties'
        ? [
            plugin[0],
            {
              ...plugin[1],
              android: { ...plugin[1]?.android, usesCleartextTraffic: localPreview },
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
