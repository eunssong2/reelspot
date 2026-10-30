import * as SecureStore from 'expo-secure-store';
import { randomUUID } from 'expo-crypto';
let pending: Promise<string> | undefined;
/** A random per-installation ID, never a hardware identifier. */
export function installationId(): Promise<string> {
  if (!pending) pending = (async () => {
    const saved = await SecureStore.getItemAsync('atp.installation-id');
    if (saved) return saved;
    const id = randomUUID();
    await SecureStore.setItemAsync('atp.installation-id', id);
    return id;
  })().catch((error) => { pending = undefined; throw error; });
  return pending;
}
