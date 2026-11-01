import { publishDocuments } from '../services/documents.js';
import { pool } from '../core/db.js';
try {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const paths = args.filter((arg) => arg !== '--dry-run');
  if (paths.length !== 1 || paths[0].startsWith('--')) throw new Error('Usage: npm run documents:publish -- path/to/manifest.json [--dry-run]');
  console.log(JSON.stringify({ dryRun, documents: await publishDocuments(paths[0], { dryRun }) }, null, 2));
} finally { await pool.end(); }
