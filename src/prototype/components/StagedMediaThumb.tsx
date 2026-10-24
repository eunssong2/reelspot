import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import type { MediaKind } from '../mock/tripData';
import { colors } from '../styles/tokens';

export interface StagedMedia {
  id: string;
  kind: MediaKind;
  /**
   * 미리보기 이미지 URL. 사진은 실제 고른 사진(또는 예시 사진), 동영상은 커버로 쓸 사진이다.
   * 방금 고른 동영상처럼 커버 사진을 만들 수 없을 때는 비워 둔다(재생 아이콘만 보여준다).
   */
  imageUrl?: string;
  /** 동영상일 때만: mm:ss 형태의 길이 표시 */
  durationLabel?: string;
  /** 같은 파일을 다시 추가하지 못하게 막는 데 쓰는 식별 키(내부용, 화면에는 안 보인다). */
  dedupeKey?: string;
}

interface Props {
  item: StagedMedia;
  onRemove: () => void;
  size: number;
}

/** 썸네일 모서리 둥글기(px). */
const THUMB_RADIUS = 12;

/** "내 순간 올리기" 줄에서 쓰는 선택된 사진·동영상 한 칸(실제 미리보기 + 빼기 버튼). */
export function StagedMediaThumb({ item, onRemove, size }: Props) {
  return (
    <View style={[styles.box, { width: size, height: size }]}>
      {item.imageUrl ? (
        <Image source={{ uri: item.imageUrl }} style={styles.image} resizeMode="cover" />
      ) : (
        <View style={styles.blank} />
      )}

      {item.kind === 'video' && (
        <>
          <View style={styles.playCircle}>
            <Text style={styles.playGlyph}>▶</Text>
          </View>
          {item.durationLabel && (
            <View style={styles.durationBadge}>
              <Text style={styles.durationText}>{item.durationLabel}</Text>
            </View>
          )}
        </>
      )}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="빼기"
        hitSlop={6}
        onPress={onRemove}
        style={styles.remove}
      >
        <Text style={styles.removeText}>✕</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderRadius: THUMB_RADIUS, overflow: 'hidden', backgroundColor: colors.surfaceStrong },
  image: { width: '100%', height: '100%' },
  blank: { flex: 1, backgroundColor: colors.surfaceStrong },
  playCircle: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginTop: -16,
    marginLeft: -16,
    width: 32,
    height: 32,
    borderRadius: 16,
    // 반투명 원형 재생 버튼(유리 느낌): 배경 사진이 은은하게 비친다.
    backgroundColor: 'rgba(255,255,255,0.32)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playGlyph: { color: '#fff', fontSize: 12, marginLeft: 2 },
  durationBadge: {
    position: 'absolute',
    right: 5,
    bottom: 5,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 5,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  durationText: { color: '#fff', fontSize: 9, fontWeight: '700' },
  remove: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(35,39,47,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeText: { color: colors.onPrimary, fontSize: 11, fontWeight: '700' },
});
