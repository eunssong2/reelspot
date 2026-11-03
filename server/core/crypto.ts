import {
  createHash,
  createHmac,
  createCipheriv,
  createDecipheriv,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';
import { config } from './config.js';
import { demand } from './errors.js';
export const hash = (v: string | Buffer) => createHash('sha256').update(v).digest('hex');
export const randomToken = () => randomBytes(32).toString('base64url');
export function encrypt(value: unknown): string {
  const iv = randomBytes(12),
    c = createCipheriv('aes-256-gcm', Buffer.from(hash(config.dataSecret), 'hex'), iv);
  const b = Buffer.concat([c.update(JSON.stringify(value), 'utf8'), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), b]).toString('base64');
}
export function decrypt<T = any>(value: string | Buffer): T {
  const b = Buffer.from(value.toString(), 'base64'),
    d = createDecipheriv(
      'aes-256-gcm',
      Buffer.from(hash(config.dataSecret), 'hex'),
      b.subarray(0, 12),
    );
  d.setAuthTag(b.subarray(12, 28));
  return JSON.parse(Buffer.concat([d.update(b.subarray(28)), d.final()]).toString());
}
export function signCursor(value: unknown) {
  const data = Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${data}.${createHmac('sha256', config.cursorSecret).update(data).digest('base64url')}`;
}
export function readCursor<T>(cursor: string): T {
  try {
    const [d, s] = cursor.split('.');
    const expected = createHmac('sha256', config.cursorSecret).update(d).digest();
    const actual = Buffer.from(s, 'base64url');
    demand(
      actual.length === expected.length && timingSafeEqual(actual, expected),
      'INVALID_CURSOR',
    );
    return JSON.parse(Buffer.from(d, 'base64url').toString());
  } catch {
    throw new Error('INVALID_CURSOR');
  }
}
