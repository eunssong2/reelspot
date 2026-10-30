import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, openSync, closeSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const env = {
  ...process.env,
  NODE_ENV: 'production', AUTH_MODE: 'provider', OPS_MODE: 'oidc', MODERATION_MODE: 'review',
  DATABASE_URL: 'postgres://atp:atp-local-only@127.0.0.1:55432/atp',
};
function run(command, args, options = {}) {
  const r = spawnSync(command, args, { cwd: root, env, stdio: 'inherit', ...options });
  if (r.error) throw r.error;
  if (r.status !== 0) throw new Error(`${command} failed (exit ${r.status})`);
}
// BuildKit uses the local context path in its session headers. Sending an
// allowlisted archive from an ASCII temp directory also works in Korean paths.
const scratch = mkdtempSync(resolve(tmpdir(), 'samsun-build-'));
try {
  const tar = spawn('tar', ['--exclude=node_modules', '--exclude=dist', '--exclude=.env',
    '--exclude=.env.*', '-C', root, '-cf', '-', 'Dockerfile', 'package.json',
    'package-lock.json', 'server', 'contracts', 'ops-web'], { stdio: ['ignore', 'pipe', 'inherit'] });
  const build = spawn('docker', ['build', '--tag', 'samsun-server:local', '-'],
    { cwd: scratch, stdio: ['pipe', 'inherit', 'inherit'] });
  // A failed builder may close its input early; report its exit below.
  build.stdin.on('error', () => {});
  tar.stdout.pipe(build.stdin);
  const done = (child) => new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('close', (code) => code === 0 ? resolve() : reject(new Error(`Build subprocess failed: ${code}`)));
  });
  const results = await Promise.allSettled([done(tar), done(build)]);
  const failed = results.find((r) => r.status === 'rejected');
  if (failed) throw failed.reason;
} finally { rmSync(scratch, { recursive: true, force: true }); }
if (process.argv.includes('--build-only')) process.exit(0);

run('docker', ['compose', 'up', '-d', '--wait', 'db']);
const backups = resolve(root, '.data/backups');
mkdirSync(backups, { recursive: true, mode: 0o700 });
const backup = resolve(backups, `before-server-start-${Date.now()}.dump`);
const fd = openSync(backup, 'wx', 0o600);
try { run('docker', ['compose', 'exec', '-T', 'db', 'pg_dump', '-U', 'atp', '-d', 'atp', '-Fc'], { stdio: ['ignore', fd, 'inherit'] }); }
finally { closeSync(fd); }
console.log('Database backup saved:', backup);
run('npm', ['run', 'db:migrate']);
run('docker', ['compose', '--profile', 'app', 'up', '-d', '--no-build', 'api', 'worker']);
let health;
for (let i = 0; i < 30; i++) {
  try {
    const r = await fetch('http://127.0.0.1:8081/health', { signal: AbortSignal.timeout(1500) });
    if (r.ok) { health = await r.json(); break; }
  } catch { /* Wait for the container to listen. */ }
  await new Promise((resolve) => setTimeout(resolve, 1000));
}
if (!health || health.mode !== 'production' || health.auth !== 'provider')
  throw new Error('API did not become ready. Check docker compose logs api.');
console.log('API running on loopback: production/provider, content review required.');
console.log('Nginx activation (sudo): python3 deploy/install-nginx.py');
console.log('Published documents and operator review configuration are still required for general release.');
