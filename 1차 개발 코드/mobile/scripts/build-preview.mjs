import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const mobile = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const project = resolve(mobile, '..');
const bundledJdk = resolve(project, '.data/tools/jdk21');
const env = {
  ...process.env,
  NODE_ENV: 'production',
  ...(existsSync(bundledJdk) && !process.env.JAVA_HOME ? { JAVA_HOME: bundledJdk } : {}),
};
const abi = process.argv.find((arg) => arg.startsWith('--abi='))?.slice(6) ?? 'x86_64';
if (!['x86_64', 'arm64-v8a', 'x86_64,arm64-v8a'].includes(abi))
  throw new Error('Use --abi=x86_64, --abi=arm64-v8a, or --abi=x86_64,arm64-v8a');

function run(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, env, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

if (!process.argv.includes('--skip-prebuild'))
  run('npx', ['expo', 'prebuild', '--platform', 'android', '--no-install'], mobile);
run(
  './gradlew',
  // Expo embeds EXPO_PUBLIC_* into JavaScript. Gradle may otherwise reuse a
  // previous bundle when only the environment (for example QA API URL) changes.
  [':app:createBundleReleaseJsAndAssets', '--rerun', ':app:assembleRelease', '--no-daemon', '--max-workers=2', `-PreactNativeArchitectures=${abi}`],
  resolve(mobile, 'android'),
);
const apk = resolve(mobile, 'android/app/build/outputs/apk/release/app-release.apk');
const artifact = resolve(project, 'artifacts/at-that-place-preview.apk');
mkdirSync(dirname(artifact), { recursive: true });
copyFileSync(apk, artifact);
copyFileSync(apk, resolve(project, '../at-that-place-preview.apk'));
console.log(`Local preview APK (${abi}): ${artifact}`);
console.log(
  'JavaScript is bundled; Metro is not required. The configured API must be running.',
);
