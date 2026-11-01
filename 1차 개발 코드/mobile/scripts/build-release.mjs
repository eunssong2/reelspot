import { spawnSync } from 'node:child_process';
import { randomBytes, createHash } from 'node:crypto';
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, resolve } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';

const mobile = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const project = resolve(mobile, '..');
const java = process.env.JAVA_HOME ?? resolve(project, '.data/tools/jdk21');
const sdk = process.env.ANDROID_HOME ?? resolve(homedir(), 'Android/Sdk');
const env = { ...process.env, NODE_ENV: 'production', JAVA_HOME: java, ANDROID_HOME: sdk };
const signing = resolve(project, '.data/release-signing');
const key = resolve(signing, 'release.jks'),
  passwordFile = resolve(signing, 'password');
const properties = resolve(signing, 'release.properties');
function run(command, args, cwd = mobile) {
  const result = spawnSync(command, args, { cwd, env, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
mkdirSync(signing, { recursive: true, mode: 0o700 });
chmodSync(signing, 0o700);
if (existsSync(key) !== existsSync(passwordFile))
  throw new Error(
    'Incomplete release signing files: restore the existing key/password; do not rotate automatically.',
  );
if (!existsSync(key)) {
  writeFileSync(passwordFile, randomBytes(32).toString('hex'), { mode: 0o600 });
  run(resolve(java, 'bin/keytool'), [
    '-genkeypair',
    '-keystore',
    key,
    '-storetype',
    'JKS',
    '-storepass:file',
    passwordFile,
    '-keypass:file',
    passwordFile,
    '-alias',
    'atp-release',
    '-keyalg',
    'RSA',
    '-keysize',
    '3072',
    '-validity',
    '10000',
    '-dname',
    'CN=At that place, OU=Mobile, O=Samsun, C=KR',
  ]);
  chmodSync(key, 0o600);
}
const password = readFileSync(passwordFile, 'utf8').trim();
writeFileSync(
  properties,
  `storeFile=${key}\nstorePassword=${password}\nkeyAlias=atp-release\nkeyPassword=${password}\n`,
  { mode: 0o600 },
);
chmodSync(properties, 0o600);
if (!process.argv.includes('--skip-prebuild'))
  run('npx', ['expo', 'prebuild', '--platform', 'android', '--no-install']);
// Native folders are generated and ignored. Read private signing values at build
// time; neither app config nor the JavaScript bundle receives the key/password.
const gradle = resolve(mobile, 'android/app/build.gradle');
let source = readFileSync(gradle, 'utf8').replace(
  /\n\/\/ ATP_RELEASE_SIGNING_START[\s\S]*?\/\/ ATP_RELEASE_SIGNING_END\n?/g,
  '\n',
);
source += `
// ATP_RELEASE_SIGNING_START
def atpSigning = new Properties()
rootProject.file('../../.data/release-signing/release.properties').withInputStream { atpSigning.load(new InputStreamReader(it, 'UTF-8')) }
android.signingConfigs.create('atpRelease') {
    storeFile file(atpSigning['storeFile'])
    storePassword atpSigning['storePassword']
    keyAlias atpSigning['keyAlias']
    keyPassword atpSigning['keyPassword']
}
android.buildTypes.release.signingConfig = android.signingConfigs.atpRelease
// ATP_RELEASE_SIGNING_END
`;
writeFileSync(gradle, source);
// Remove only generated JS outputs to force public environment values into the
// bundle. Avoid --rerun: Gradle can interpret it as the global --rerun-tasks
// abbreviation, needlessly recompiling every native dependency.
for (const output of ['generated/assets/react/release', 'generated/res/react/release', 'intermediates/sourcemaps/react/release'])
  rmSync(resolve(mobile, 'android/app/build', output), { recursive: true, force: true });
run(
  './gradlew',
  [
    ':app:assembleRelease',
    '--no-daemon',
    '--max-workers=2',
    '-PreactNativeArchitectures=x86_64,arm64-v8a',
  ],
  resolve(mobile, 'android'),
);
const apk = resolve(mobile, 'android/app/build/outputs/apk/release/app-release.apk');
run(resolve(sdk, 'build-tools/36.0.0/apksigner'), ['verify', '--verbose', '--print-certs', apk]);
const artifact = resolve(project, 'artifacts/at-that-place-release.apk');
mkdirSync(dirname(artifact), { recursive: true });
copyFileSync(apk, artifact);
copyFileSync(apk, resolve(project, '../at-that-place-release.apk'));
console.log(`Release APK: ${artifact}`);
console.log(`SHA-256: ${createHash('sha256').update(readFileSync(apk)).digest('hex')}`);
console.log(
  'Keep .data/release-signing private and backed up: the same key is required for future updates.',
);
