import React, { useState } from 'react';
import { vi, beforeEach } from 'vitest';
import { AppState } from './native';
import { setFocused, setParams, router, removal } from './router';
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
export const fixtures = {
  userId: 'user', api: vi.fn(), sessionChange: vi.fn(), storage: new Map<string, string>(), camera: vi.fn(), album: vi.fn(), queue: vi.fn(), source: vi.fn(), counter: 0,
};
vi.mock('../../src/lib/api', () => ({
  API: 'https://example.invalid', currentSession: () => ({ userId: fixtures.userId, accessToken: 'test' }),
  api: fixtures.api, getGroup: (id: string) => fixtures.api(`/groups/${id}`), awaitOperation: async (v: any) => v,
  setSession: fixtures.sessionChange, documentUrl: (url: string) => url,
  coverSource: () => ({ uri: 'test-cover' }),
  ApiError: class extends Error { constructor(public code: string) { super(code); } },
}));
vi.mock('@react-native-async-storage/async-storage', () => ({ default: {
  getItem: async (key: string) => fixtures.storage.get(key) ?? null,
  setItem: async (key: string, value: string) => { fixtures.storage.set(key, value); },
  getAllKeys: async () => [...fixtures.storage.keys()], removeItem: async (key: string) => { fixtures.storage.delete(key); },
} }));
vi.mock('expo-image-picker', () => ({
  CameraType: { back: 'back' }, requestCameraPermissionsAsync: async () => ({ granted: true }),
  launchCameraAsync: fixtures.camera, launchImageLibraryAsync: fixtures.album,
}));
vi.mock('expo-router/react-navigation', () => ({ usePreventRemove: (enabled: boolean, callback: any) => { removal.enabled = enabled; removal.callback = callback; } }));
vi.mock('expo-clipboard', () => ({ setStringAsync: async () => {} }));
vi.mock('expo-file-system/legacy', () => ({ documentDirectory: 'file:private/', deleteAsync: vi.fn(async () => {}) }));
vi.mock('../../modules/atp-transfer', () => ({ Transfer: { normalizeCapture: async (uri: string) => uri } }));
vi.mock('../../src/lib/uploads', () => ({
  candidate: async (uri: string, name: string, mime: string, recordDate: string, visitId: string | null, selectionIndex: number) => ({ uri, name, mime, recordDate, visitId, selectionIndex, kind: mime.startsWith('video/') ? 'video' : 'photo', clientFileId: `file-${++fixtures.counter}`, fingerprint: uri }),
  submissionFile: (f: any, selectionIndex: number) => ({ ...f, selectionIndex }), enqueueTask: fixtures.queue,
}));
vi.mock('../../src/lib/state', () => ({ useAccount: () => ({ session: { userId: fixtures.userId } }) }));
vi.mock('../../src/vlog/data', () => ({ loadVlog: fixtures.source }));
vi.mock('../../src/components/ui', () => ({
  resetTo: (path: string) => router.replace(path),
  colors: { ink: '#000', sub: '#555', surface: '#eee', accent: '#f00', muted: '#888' }, s: {},
  Screen: ({ children, footer, title, onBack }: any) => <screen title={title}><button onPress={onBack}>뒤로</button>{children}{footer}</screen>,
  Sheet: ({ visible, children, title, onClose }: any) => visible ? <sheet title={title}><button onPress={onClose}>시트 닫기</button>{children}</sheet> : null,
  Button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
  TextButton: ({ children, ...props }: any) => <button {...props}>{children}</button>,
  Badge: ({ children }: any) => <text>{children}</text>, CheckCircle: () => null, ClearableInput: (props: any) => <input {...props} />,
  P: ({ children }: any) => <text>{children}</text>, H: ({ children }: any) => <text>{children}</text>,
  Info: ({ children }: any) => <text>{children}</text>, confirm: (_title: string, _body: string, action: any) => action(),
  Field: (props: any) => <input {...props} />, Card: ({ children }: any) => <card>{children}</card>, Chip: ({ children }: any) => <chip>{children}</chip>,
  useAction: () => { const [error, setError] = useState(''); const [errorCode, setErrorCode] = useState(''); const [busy, setBusy] = useState(false); return { error, errorCode, busy, clear: () => setError(''), errorView: error ? <error>{error}</error> : null, run: async (fn: any) => { setBusy(true); setError(''); setErrorCode(''); try { await fn(); return true; } catch (e) { setError((e as Error).message); setErrorCode((e as any).code ?? ''); return false; } finally { setBusy(false); } } }; },
}));
vi.mock('../../src/components/schedule-plan', () => ({
  DateTabs: () => null,
  DayTimeline: ({ visits, onEdit, onVisit }: any) => <timeline>{visits.map((v: any) => <React.Fragment key={v.id}><button onPress={() => onEdit(v.id)}>{v.name} 시간 수정</button><button onPress={() => onVisit(v)}>{v.name} 기록</button></React.Fragment>)}</timeline>,
}));
vi.mock('../../src/components/records', () => ({ Records: ({ toolbar }: any) => <records view={toolbar.view} order={toolbar.order}><button onPress={() => toolbar.onView('by_author')}>사람별</button><button onPress={() => toolbar.onOrder('asc')}>오래된순</button><button onPress={() => router.push('/record/media')}>사진 열기</button></records> }));
vi.mock('../../src/lib/unsaved', () => ({ useUnsavedChanges: () => (fn: any) => fn() }));
vi.mock('react-native-safe-area-context', () => ({ SafeAreaView: ({ children }: any) => <safe>{children}</safe> }));
vi.mock('expo-video', () => ({ useVideoPlayer: () => ({ play() {} }), VideoView: () => null }));
beforeEach(() => { fixtures.storage.clear(); fixtures.userId = 'user'; fixtures.counter = 0; fixtures.api.mockReset(); fixtures.camera.mockReset(); fixtures.album.mockReset(); fixtures.source.mockReset(); fixtures.queue.mockReset(); AppState.clear(); setFocused(true); setParams({}); vi.clearAllMocks(); });
