import { emptyDraft, defaultSetting, type VlogDraft } from './model';

const object = (v: unknown): v is Record<string, any> => !!v && typeof v === 'object' && !Array.isArray(v);
const strings = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === 'string');
const lists = (v: unknown) => object(v) && Object.values(v).every(strings);

/** Reject corrupt or cross-group data without replacing the saved original. Result URIs are never restored. */
export function restoreDrafts(raw: string | null, groupId: string): Record<string, VlogDraft> {
  if (raw === null) return {};
  const parsed: unknown = JSON.parse(raw);
  if (!object(parsed)) throw new Error('Invalid draft storage');
  const clean: Record<string, VlogDraft> = {};
  for (const [id, d] of Object.entries(parsed)) {
    if (id !== groupId || !object(d) || d.groupId !== id || typeof d.title !== 'string' ||
        !strings(d.dayKeys) || !lists(d.placeKeys) || !lists(d.mediaIds) || !object(d.settings))
      throw new Error('Invalid draft');
    const settings: VlogDraft['settings'] = {};
    for (const [key, setting] of Object.entries(d.settings)) {
      if (!object(setting) || !['sequence', 'split'].includes(setting.mode) ||
          !object(setting.captions) || !Object.values(setting.captions).every((v) => typeof v === 'string') ||
          !object(setting.videoStart) || !Object.values(setting.videoStart).every((v) => Number.isFinite(v) && v >= 0) ||
          (setting.frames !== undefined && (!object(setting.frames) || !Object.values(setting.frames).every(object))))
        throw new Error('Invalid scene');
      settings[key] = { ...defaultSetting(), ...setting };
    }
    clean[id] = { ...emptyDraft(id), ...d, settings, render: undefined } as VlogDraft;
  }
  return clean;
}
