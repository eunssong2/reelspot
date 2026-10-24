import { Pressable, StyleSheet, Text, View } from 'react-native';

import { SafeImage } from '../../demo/SafeImage';
import type { CoverKind } from '../mock/tripData';

const SCENES: Record<CoverKind, { sky: string; ground: string; emoji: string }> = {
  beach: { sky: '#FFF0E7', ground: '#FFD9C5', emoji: '🌉' },
  sunset: { sky: '#EEF4E8', ground: '#CDDFBE', emoji: '🏞️' },
  town: { sky: '#EEEAF8', ground: '#D8CFF0', emoji: '🏙️' },
};

interface Props {
  kind: CoverKind;
  /** 직접 고른 대표 사진(URI). 없으면 기본 그림을 쓴다. */
  imageUri?: string;
  /** 있으면 배너를 눌러 사진을 바꿀 수 있다(오른쪽 아래에 "배경 변경" 표시). */
  onEdit?: () => void;
}

/**
 * 일정 요약 화면 상단의 대표 이미지. 사진을 고르지 않았다면 모임 커버(CoverThumb)와 같은 방식의
 * 기본 그림을 보여주고, 고른 사진이 있으면 그 사진을 꽉 채워 보여준다.
 */
export function ItineraryCoverBanner({ kind, imageUri, onEdit }: Props) {
  const scene = SCENES[kind];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="배경 사진 변경"
      disabled={!onEdit}
      onPress={onEdit}
      style={[styles.box, { backgroundColor: scene.sky }]}
    >
      {imageUri ? (
        <SafeImage source={imageUri} resizeMode="cover" style={StyleSheet.absoluteFill} />
      ) : (
        <>
          <View style={[styles.ground, { backgroundColor: scene.ground }]} />
          <Text style={styles.emoji}>{scene.emoji}</Text>
        </>
      )}
      {onEdit ? (
        <View style={styles.editBadge} pointerEvents="none">
          <Text style={styles.editText}>📷 배경 변경</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  box: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: 20,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ground: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '38%' },
  emoji: { fontSize: 56 },
  editBadge: {
    position: 'absolute',
    right: 10,
    bottom: 10,
    backgroundColor: 'rgba(25, 31, 40, 0.68)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  editText: { color: '#fff', fontSize: 12, fontWeight: '700' },
});
