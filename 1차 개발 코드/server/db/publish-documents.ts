import { publishDocuments } from '../services/documents.js';
import { pool } from '../core/db.js';
try {
  if (!process.argv[2]) throw new Error('Usage: npm run documents:publish -- path/to/manifest.json');
  console.log(JSON.stringify(await publishDocuments(process.argv[2]), null, 2));
} finally { await pool.end(); }
