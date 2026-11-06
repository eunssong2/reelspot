import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const require = createRequire(import.meta.url);
test('production bypass needs explicit true and still requires provider authentication/OIDC', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'atp-config-'));
  try {
    for (const [mode, bypass, auth, ops, allowed] of [
      ['disabled', undefined, 'provider', 'oidc', false],
      ['disabled', 'false', 'provider', 'oidc', false],
      ['disabled', '1', 'provider', 'oidc', false],
      ['disabled', 'true', 'provider', 'oidc', true],
      ['disabled', 'true', 'development', 'oidc', false],
      ['disabled', 'true', 'provider', 'development', false],
      ['development', 'true', 'provider', 'oidc', false],
      ['typo', 'true', 'provider', 'oidc', false],
      ['review', undefined, 'provider', 'oidc', true],
      ['provider', undefined, 'provider', 'oidc', true],
    ] as const) {
      const env = {
        PATH: process.env.PATH,
        NODE_ENV: 'production',
        AUTH_MODE: auth,
        OPS_MODE: ops,
        MODERATION_MODE: mode,
        ...(bypass === undefined ? {} : { ALLOW_TEST_MODERATION_BYPASS: bypass }),
        TOKEN_SECRET: 'token-fixture-'.repeat(4),
        DATA_SECRET: 'data-fixture-'.repeat(4),
        CURSOR_SECRET: 'cursor-fixture-'.repeat(4),
        DEV_OPS_TOKEN: 'ops-fixture-'.repeat(4),
      };
      const r = spawnSync(
        process.execPath,
        [
          '--import',
          require.resolve('tsx/esm'),
          '-e',
          `import(${JSON.stringify(new URL('../server/core/config.ts', import.meta.url).href)})`,
        ],
        { cwd, env, encoding: 'utf8' },
      );
      assert.equal(r.status, allowed ? 0 : 1, r.stderr);
      if (r.status) assert.match(r.stderr, /Production requires/);
    }
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});
