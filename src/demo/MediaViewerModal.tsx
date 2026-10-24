import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { PlaceRecordItem } from '../prototype/mock/tripData';
import { ZoomableImage } from './ZoomableImage';

export interface ViewerTarget {
  item: PlaceRecordItem;
  /** 작성자 이름 */
  author: string;
  /** 작성 시각 문자열 */
  time: string;
}

interface Props {
  target: ViewerTarget | null;
  onClose: () => void;
}

/**
 * 장소 기록 상세 보기: 사진은 확대해서, 동영상은 앱에 포함된 영상이 있을 때만 재생해서 보여준다.
 * 작성자·작성 시각·설명을 함께 보여주고, 닫기 버튼·Android 뒤로 가기로 닫는다.
 */
export function MediaViewerModal({ target, onClose }: Props) {
  const isVideo = target?.item.kind === 'video' && target.item.videoSource !== undefined;

  return (
    <Modal visible={!!target} animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <SafeAreaView style={styles.root}>
        <View style={styles.top}>
          <Pressable accessibilityRole="button" accessibilityLabel="닫기" onPress={onClose} hitSlop={12} style={styles.close}>
            <Text style={styles.closeGlyph}>✕</Text>
          </Pressable>
        </View>

        <View style={styles.body}>
          {target ? (
            isVideo ? (
              <VideoBody key={target.item.id} source={target.item.videoSource as number} />
            ) : (
              <ZoomableImage source={target.item.imageUrl} />
            )
          ) : null}
        </View>

        {target ? (
          <View style={styles.caption}>
            <Text style={styles.captionTitle}>
              {target.author} · {target.time}
            </Text>
            {target.item.caption ? <Text style={styles.captionSub}>{target.item.caption}</Text> : null}
          </View>
        ) : null}
      </SafeAreaView>
    </Modal>
  );
}

function VideoBody({ source }: { source: number }) {
  const { width } = useWindowDimensions();
  const [error, setError] = useState<string | null>(null);
  const player = useVideoPlayer(source, (p) => {
    p.loop = false;
    p.play();
  });

  useEffect(() => {
    const sub = player.addListener('statusChange', ({ status, error: err }) => {
      if (status === 'error') setError(err?.message ?? '동영상을 재생하지 못했어요');
    });
    return () => sub.remove();
  }, [player]);

  if (error) {
    return (
      <View style={[styles.videoError, { width }]}>
        <Text style={styles.videoErrorTitle}>동영상을 재생하지 못했어요</Text>
        <Text style={styles.videoErrorBody}>{error}</Text>
      </View>
    );
  }
  return <VideoView player={player} style={{ width, height: Math.round((width * 3) / 4) }} nativeControls contentFit="contain" surfaceType="textureView" />;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'rgba(10,10,12,0.96)' },
  top: { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 16, paddingTop: 8 },
  close: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center' },
  closeGlyph: { color: '#fff', fontSize: 18, fontWeight: '700' },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  caption: { paddingHorizontal: 20, paddingBottom: 24, gap: 2 },
  captionTitle: { color: '#fff', fontSize: 14, fontWeight: '700' },
  captionSub: { color: 'rgba(255,255,255,0.82)', fontSize: 14 },
  videoError: { alignItems: 'center', gap: 6, padding: 24 },
  videoErrorTitle: { color: '#fff', fontSize: 15, fontWeight: '700' },
  videoErrorBody: { color: 'rgba(255,255,255,0.7)', fontSize: 12, textAlign: 'center' },
});
