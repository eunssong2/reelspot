import { useVideoPlayer } from 'expo-video';
import { useEffect } from 'react';

import { MUSIC_VOLUMES, type MusicId, type MusicVolume } from './model';
import { MUSIC_TRACKS } from './musicTracks';

/**
 * 배경 음악을 반복 재생하는 보이지 않는 재생기(앱용). playing 이 true 일 때만 소리를 낸다.
 * trackId 가 'none' 이면 아무것도 하지 않는다. 화면을 나가면 재생기가 정리되며 소리도 멈춘다.
 * 웹은 expo-video 가 화면(VideoView)이 있어야 소리를 내므로 bgm.web.ts 가 따로 처리한다.
 */
export function useBgm(trackId: MusicId, volume: MusicVolume, playing: boolean): void {
  const source = trackId === 'none' ? null : (MUSIC_TRACKS.find((t) => t.id === trackId)?.source ?? null);
  const player = useVideoPlayer(source, (p) => {
    p.loop = true;
  });
  const level = MUSIC_VOLUMES.find((v) => v.id === volume)?.value ?? 0.55;
  useEffect(() => {
    try {
      player.volume = level;
    } catch {
      // 재생기가 정리된 뒤에는 무시한다.
    }
  }, [player, level]);
  useEffect(() => {
    if (!source) return;
    try {
      if (playing) player.play();
      else player.pause();
    } catch {
      // 재생하지 못하면 소리만 나지 않는다.
    }
  }, [player, playing, source]);
}
