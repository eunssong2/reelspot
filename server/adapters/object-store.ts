import { mkdir, open, rename, readFile, stat, rm } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import { config } from '../core/config.js';
import { demand } from '../core/errors.js';
export class LocalObjectStore {
  path(key: string) {
    demand(/^[a-zA-Z0-9_./-]+$/.test(key) && !key.split('/').includes('..'), 'INVALID_OBJECT_KEY');
    const p = resolve(config.objectRoot, key);
    demand(p.startsWith(config.objectRoot + '/'), 'INVALID_OBJECT_KEY');
    return p;
  }
  async put(key: string, data: Buffer) {
    const p = this.path(key);
    await mkdir(dirname(p), { recursive: true, mode: 0o700 });
    const temp = `${p}.${randomUUID()}.tmp`,
      h = await open(temp, 'wx', 0o600);
    try {
      await h.writeFile(data);
      await h.sync();
    } finally {
      await h.close();
    }
    await rename(temp, p);
    const d = await open(dirname(p), 'r');
    try {
      await d.sync();
    } finally {
      await d.close();
    }
    return key;
  }
  async get(key: string) {
    return readFile(this.path(key));
  }
  async exists(key: string) {
    try {
      await stat(this.path(key));
      return true;
    } catch {
      return false;
    }
  }
  async remove(key: string) {
    await rm(this.path(key), { force: true, recursive: true });
  }
}
export const objects = new LocalObjectStore();
