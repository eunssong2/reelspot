import type { DB } from './db.js';
export type Actor = {
  id: string;
  status: string;
  sessionId: string;
  display_name: string;
  version: number;
};
export type Context = {
  db: DB;
  actor: Actor;
  body: any;
  params: Record<string, string>;
  query: Record<string, any>;
  headers: Record<string, any>;
  opId: string;
  operator?: { subject: string; roles: string[] };
};
export type Handler = (ctx: Context) => Promise<any>;
