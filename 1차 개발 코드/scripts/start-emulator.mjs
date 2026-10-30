import { spawnSync } from 'node:child_process';
import { homedir } from 'node:os';
import { resolve } from 'node:path';

// Local Linux/RDP profile verified on this workstation (NVIDIA + Mesa Zink).
// These settings affect only the emulator process, not the desktop or driver installation.
const sdk = process.env.ANDROID_HOME ?? resolve(homedir(), 'Android/Sdk');
const emulator = resolve(sdk, 'emulator/emulator');
const software = process.argv.includes('--software');
const avd = process.argv.find((arg) => arg.startsWith('--avd='))?.slice(6) ?? 'Android15';
const adb = resolve(sdk, 'platform-tools/adb');
const existing = spawnSync(adb, ['-s', 'emulator-5556', 'get-state'], { encoding: 'utf8' });
if (existing.stdout?.trim() === 'device' || existing.stderr?.includes('offline')) {
  console.log('emulator-5556 is already running or starting.');
  process.exit(0);
}
const env = {
  ...process.env,
  DISPLAY: process.env.DISPLAY ?? ':10.0',
  QT_OPENGL: software ? 'software' : 'desktop',
};
if (!software) {
  Object.assign(env, {
    __GLX_VENDOR_LIBRARY_NAME: 'mesa',
    MESA_LOADER_DRIVER_OVERRIDE: 'zink',
    GALLIUM_DRIVER: 'zink',
    LIBGL_KOPPER_DRI2: 'true',
    // Avoid the bundled allocator's TLS recursion and JIT unwinder incompatibility.
    LD_PRELOAD: [
      '/lib/x86_64-linux-gnu/libc.so.6',
      '/lib/x86_64-linux-gnu/libgcc_s.so.1',
      process.env.LD_PRELOAD,
    ]
      .filter(Boolean)
      .join(':'),
  });
}
const result = spawnSync(
  emulator,
  [
    '-avd',
    avd,
    '-port',
    '5556',
    '-gpu',
    software ? 'swiftshader' : 'host',
    '-feature',
    '-Vulkan',
    '-no-snapshot',
    '-no-boot-anim',
    '-vsync-rate',
    '60',
    '-crash-report-mode',
    'never',
  ],
  { env, stdio: 'inherit' },
);
if (result.error) throw result.error;
process.exit(result.status ?? 1);
