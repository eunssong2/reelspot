import { requireOptionalNativeModule } from 'expo-modules-core';
export const Transfer = requireOptionalNativeModule<{
  normalizeCapture(uri: string): Promise<string>;
  inspect(uri: string): Promise<string>;
  digest(uri: string): Promise<string>;
  enqueue(spec: string): Promise<void>;
  statuses(userId: string): Promise<string>;
  cancel(taskId: string): void;
  credentials(session: string): Promise<void>;
  session(userId: string): Promise<string | null>;
  clearAccount(userId: string): Promise<void>;
  saveToAlbum(uri: string, mime: string, name: string): Promise<string>;
}>('AtpTransfer');
