import { defaultSetting, type CropRect, type FontId, type PlaceSetting, type VlogDraft, type VlogMedia } from './model';

export function cropMedia(draft: VlogDraft, placeKey: string, mediaId: string, crop?: CropRect): VlogDraft {
  const previous = draft.settings[placeKey] ?? defaultSetting();
  return { ...draft, settings: { ...draft.settings, [placeKey]: {
    ...previous, done: false,
    frames: { ...previous.frames, [mediaId]: { ...previous.frames?.[mediaId], crop } },
  } } };
}

export function applyFont(draft: VlogDraft, placeKeys: string[], fontId: FontId): VlogDraft {
  const settings = { ...draft.settings };
  for (const key of placeKeys) settings[key] = { ...(settings[key] ?? defaultSetting()), fontId, done: false };
  return { ...draft, settings };
}

export function resizeSplit(setting: PlaceSetting, media: VlogMedia[], requested: number, maximum: number): Partial<PlaceSetting> {
  const lengthSec = Math.max(Math.min(1, maximum), Math.min(maximum, requested));
  const videoStart = { ...setting.videoStart };
  for (const m of media.filter((m) => m.item.kind === 'video')) {
    videoStart[m.item.id] = Math.max(0, Math.min(videoStart[m.item.id] ?? 0, (m.seconds ?? 0) - lengthSec));
  }
  return { lengthSec, videoStart, done: false };
}
