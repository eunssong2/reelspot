import pg, { type PoolClient, type QueryResultRow } from 'pg';
import { config } from './config.js';
pg.types.setTypeParser(20, Number);
pg.types.setTypeParser(1082, (v) => v);
export const pool = new pg.Pool({
  connectionString: config.databaseUrl,
  max: 12,
  options: '-c search_path=atp,pg_catalog -c timezone=Asia/Seoul',
});
export type DB = PoolClient;
export type DBRow = { id: string; version: number; [column: string]: any };
export async function rows<T extends QueryResultRow = DBRow>(
  db: DB,
  sql: string,
  args: unknown[] = [],
): Promise<T[]> {
  return (await db.query<T>(sql, args)).rows;
}
export async function one<T extends QueryResultRow = DBRow>(
  db: DB,
  sql: string,
  args: unknown[] = [],
): Promise<T> {
  const result = await rows<T>(db, sql, args);
  return result[0];
}
export async function tx<T>(fn: (db: DB) => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    const db = await pool.connect();
    try {
      await db.query('BEGIN ISOLATION LEVEL SERIALIZABLE');
      const value = await fn(db);
      await db.query('COMMIT');
      return value;
    } catch (e) {
      await db.query('ROLLBACK');
      if (attempt < 3 && ['40001', '40P01'].includes((e as { code: string }).code)) continue;
      throw e;
    } finally {
      db.release();
    }
  }
}
