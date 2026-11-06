import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync, copyFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';

test('deployment honors test .env and validates both services before stopping either', () => {
  const root = mkdtempSync(join(tmpdir(), 'atp-deploy-fixture-'));
  try {
    mkdirSync(join(root, 'scripts'));
    mkdirSync(join(root, 'bin'));
    copyFileSync(new URL('../scripts/start-server.mjs', import.meta.url), join(root, 'scripts/start-server.mjs'));
    const log = join(root, 'commands.jsonl');
    const stub = `#!${process.execPath}
const fs = require('node:fs');
const path = require('node:path');
const name = path.basename(process.argv[1]);
const args = process.argv.slice(2);
fs.appendFileSync(process.env.FIXTURE_LOG, JSON.stringify({name,args,mode:process.env.MODERATION_MODE,bypass:process.env.ALLOW_TEST_MODERATION_BYPASS})+'\\n');
if(name==='docker' && args[0]==='build') {process.stdin.resume();}
else if(name==='docker' && args.includes('run')) {
  // Startup semantics are exercised against the real config in production-config.test.ts.
  process.exit(process.env.MODERATION_MODE==='disabled' && process.env.ALLOW_TEST_MODERATION_BYPASS!=='true' ? 1 : 0);
}
else if(name==='npm') process.exit(42); // Stop the fixture before API start/health; never run a real deployment.
`;
    for (const name of ['docker', 'npm', 'tar']) writeFileSync(join(root, 'bin', name), stub, { mode: 0o755 });
    for (const [flag, shellMode] of [[false, undefined], [true, undefined], [false, 'review']] as const) {
      writeFileSync(log, '');
      writeFileSync(join(root, '.env'), `MODERATION_MODE=disabled\nALLOW_TEST_MODERATION_BYPASS=${flag}\n`);
      const result = spawnSync(process.execPath, [join(root, 'scripts/start-server.mjs')], {
        cwd: root,
        env: { PATH: join(root, 'bin'), FIXTURE_LOG: log, ...(shellMode ? { MODERATION_MODE: shellMode } : {}) },
        encoding: 'utf8',
      });
      assert.notEqual(result.status, 0); // Deliberate fixture stop or rejected config.
      const calls = readFileSync(log, 'utf8').trim().split('\n').map((line) => JSON.parse(line));
      const checks = calls.filter((c) => c.name === 'docker' && c.args.includes('run'));
      const stop = calls.findIndex((c) => c.args.includes('stop'));
      if (!flag && !shellMode) {
        assert.equal(checks.length, 1);
        assert.equal(stop, -1);
        assert.equal(calls.some((c) => c.args.includes('pg_dump') || c.name === 'npm'), false);
      } else {
        assert.equal(checks.length, 2);
        assert.ok(stop > calls.indexOf(checks[1]));
        for (const c of checks) {
          assert.equal(c.mode, shellMode ?? 'disabled');
          assert.equal(c.bypass, String(flag));
          assert.ok(c.args.includes('--no-deps'));
        }
        assert.equal(calls.at(-1).name, 'npm');
      }
    }
  } finally { rmSync(root, { recursive: true, force: true }); }
});
