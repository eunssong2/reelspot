import { resolve } from 'node:path';
try {
  process.loadEnvFile();
} catch {
  /* Environment variables also work without .env. */
}
const mode = process.env.NODE_ENV ?? 'development';
function secret(name: string, fallback: string) {
  const value = process.env[name] ?? fallback;
  if (
    mode === 'production' &&
    (value === fallback || value.length < 32 || value.includes('replace-'))
  )
    throw new Error(`${name} must be a configured secret`);
  return value;
}
export const config = {
  mode,
  production: mode === 'production',
  port: Number(process.env.PORT ?? 8081),
  host: process.env.HOST ?? '127.0.0.1',
  databaseUrl: process.env.DATABASE_URL ?? 'postgres://atp:atp-local-only@127.0.0.1:55432/atp',
  tokenSecret: secret('TOKEN_SECRET', 'local-token-secret-for-development-only'),
  dataSecret: secret('DATA_SECRET', 'local-data-secret-for-development-only'),
  cursorSecret: secret('CURSOR_SECRET', 'local-cursor-secret-for-development-only'),
  objectRoot: resolve(process.env.OBJECT_ROOT ?? '.data/objects'),
  publicUrl: process.env.PUBLIC_URL ?? 'http://sphan0325.ddns.net:8081',
  authMode: process.env.AUTH_MODE ?? 'development',
  moderationMode: process.env.MODERATION_MODE ?? 'review',
  opsMode: process.env.OPS_MODE ?? 'development',
  devOpsToken: secret('DEV_OPS_TOKEN', 'local-operator-development-only'),
  cors: (process.env.CORS_ORIGINS ?? 'http://localhost:5173').split(','),
};
if (
  config.production &&
  (config.authMode !== 'provider' ||
    config.opsMode !== 'oidc' ||
    config.moderationMode === 'development')
)
  throw new Error('Production cannot use development adapters');
