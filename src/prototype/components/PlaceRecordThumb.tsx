import { Pressable, StyleSheet, Text, View } from 'react-native';

import { SafeImage } from '../../demo/SafeImage';
import type { PlaceRecordItem } from '../mock/tripData';
import { colors } from '../styles/tokens';

interface Props {
  item: PlaceRecordItem;
  onPress?: () => void;
  /** 남은 개수. 넘기면 이 타일 위에 반투명 검정 + "+N" 을 덮어 갤러리의 마지막 칸으로 쓴다. */
  overlayCount?: number;
}

/** 썸네일 모서리 둥글기(px). 카드(16~20px)보다 한 단계 작게 잡는다. */
const THUMB_RADIUS = 12;

/**
 * 스팟원들의 순간 갤러리에서 쓰는 정사각 썸네일 한 칸(실제 사진 URL).
 * 동영상이면 가운데 흰 원형 재생 아이콘과 오른쪽 아래 길이 배지를 얹는다.
 */
export function PlaceRecordThumb({ item, onPress, overlayCount }: Props) {
  const overlaid = overlayCount !== undefined && overlayCount > 0;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={item.kind === 'video' ? `동영상${item.durationLabel ? ` ${item.durationLabel}` : ''}` : '사진'}
      onPress={onPress}
      style={({ pressed }) => [styles.box, pressed && styles.pressed]}
    >
      <SafeImage source={item.imageUrl} compact style={styles.image} resizeMode="cover" />

      {item.kind === 'video' && (
        <View style={styles.playCircle}>
          <Text style={styles.playGlyph}>▶</Text>
        </View>
      )}
      {item.kind === 'video' && item.durationLabel && (
        <View style={styles.durationBadge}>
          <Text style={styles.durationText}>{item.durationLabel}</Text>
        </View>
      )}

      {overlaid && (
        <View style={styles.overlay}>
          <Text style={styles.overlayText}>+{overlayCount}</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  box: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: THUMB_RADIUS,
    overflow: 'hidden',
    backgroundColor: colors.surfaceStrong,
  },
  pressed: { opacity: 0.9 },
  image: { width: '100%', height: '100%' },
  playCircle: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginTop: -17,
    marginLeft: -17,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0px 2px 6px rgba(0,0,0,0.25)',
  },
  playGlyph: { color: colors.text, fontSize: 13, marginLeft: 2 },
  durationBadge: {
    position: 'absolute',
    right: 6,
    bottom: 6,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  durationText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlayText: { color: '#fff', fontSize: 20, fontWeight: '800' },
});
