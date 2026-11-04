import AsyncStorage from '@react-native-async-storage/async-storage';
import { currentSession } from '../lib/api';
const writes = new Map<string, Promise<void>>();
export const draftStorageKey = (userId: string, groupId: string) => `atp.draft:${userId}:vlog:v1:${groupId}`;
export function writeDrafts(userId: string, key: string, value: string) {
  const next = (writes.get(userId) ?? Promise.resolve()).catch(() => {}).then(async () => {
    if (currentSession()?.userId === userId) await AsyncStorage.setItem(key, value);
  });
  writes.set(userId, next);
  return next;
}
export async function flushDraftWrites(userId: string) { await writes.get(userId)?.catch(() => {}); }
