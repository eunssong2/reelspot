import { StyleSheet, Text, View } from 'react-native';

import type { CoverKind } from '../mock/tripData';

const SCENES: Record<CoverKind, { sky: string; ground: string; emoji: string }> = {
  beach: { sky: '#FFF0E7', ground: '#FFD9C5', emoji: '☕' },
  sunset: { sky: '#EEF4E8', ground: '#CDDFBE', emoji: '🌿' },
  town: { sky: '#EEEAF8', ground: '#D8CFF0', emoji: '🍜' },
};

/** 모임 카드 대표 이미지: 카페·산책·맛집처럼 평범한 일상의 분위기를 담는다. */
export function CoverThumb({ kind, size = 84 }: { kind: CoverKind; size?: number }) {
  const scene = SCENES[kind];
  return (
    <View style={[styles.box, { width: size, height: size, backgroundColor: scene.sky }]}>
      <View style={[styles.ground, { backgroundColor: scene.ground, height: size * 0.36 }]} />
      <Text style={[styles.emoji, { fontSize: size * 0.46 }]}>{scene.emoji}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderRadius: 16, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  ground: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  emoji: { textAlign: 'center' },
});
