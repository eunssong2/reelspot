import { StyleSheet, Text, View } from 'react-native';

import type { CoverKind } from '../mock/tripData';

const SCENES: Record<CoverKind, { sky: string; ground: string; emoji: string }> = {
  beach: { sky: '#9ADBF7', ground: '#4FC3D9', emoji: '🏝️' },
  sunset: { sky: '#FFB58A', ground: '#C0556B', emoji: '🌴' },
  town: { sky: '#F1D6B8', ground: '#C98F6B', emoji: '🏘️' },
};

/** 모임 카드 대표 이미지: 하늘 + 바닥 색 띠 + 이모지로 만든 여행 풍경 썸네일. */
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
