import { useEffect, useRef } from 'react';

import { MUSIC_VOLUMES, type MusicId, type MusicVolume } from './model';
import { MUSIC_TRACKS } from './musicTracks';

// 앱에 포함한 음원(require 한 번호)의 웹 주소를 얻는다. expo-video 가 웹에서 쓰는 방식과 같다.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { getAssetByID } = require('@react-native/assets-registry/registry') as {
  getAssetByID: (id: number) => { httpServerLocation: string; name: string; type?: string } | null;
};
function assetUri(id: number): string | null {
  const asset = getAssetByID(id);
  if (!asset) return null;
  const file = `${asset.name}${asset.type ? `.${asset.type}` : ''}`;
  return __DEV__ ? `${asset.httpServerLocation}/${file}` : `${asset.httpServerLocation.replace(/\.\.\//g, '_')}/${file}`;
}

/**
 * 배경 음악 재생기(웹용). expo-video 는 웹에서 화면(VideoView)이 있어야 소리가 나므로
 * 브라우저의 Audio 로 직접 재생한다. 브라우저는 사용자가 누른 뒤에만 소리를 허용한다.
 */
export function useBgm(trackId: MusicId, volume: MusicVolume, playing: boolean): void {
  const audio = useRef<HTMLAudioElement | null>(null);
  const source = trackId === 'none' ? null : (MUSIC_TRACKS.find((t) => t.id === trackId)?.source ?? null);
  const level = MUSIC_VOLUMES.find((v) => v.id === volume)?.value ?? 0.55;

  // 곡이 바뀌면 새 재생기를 만들고, 이전 것은 멈춰 정리한다.
  useEffect(() => {
    if (source === null) return;
    // 웹 번들에서는 require 한 음원이 번호가 아니라 주소 문자열로 올 때가 있다.
    const uri = typeof (source as unknown) === 'string' ? (source as unknown as string) : assetUri(source);
    if (!uri) return;
    const el = new Audio(uri);
    el.loop = true;
    el.volume = level;
    audio.current = el;
    return () => {
      el.pause();
      audio.current = null;
    };
    // 소리 크기는 아래 효과에서 따로 바꾼다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source]);

  useEffect(() => {
    if (audio.current) audio.current.volume = level;
  }, [level]);

  useEffect(() => {
    const el = audio.current;
    if (!el) return;
    if (playing) el.play().catch(() => {});
    else el.pause();
  }, [playing, source]);
}
