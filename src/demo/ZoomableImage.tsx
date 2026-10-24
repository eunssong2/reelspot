import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { SafeImage } from './SafeImage';

const ZOOM_LEVELS = [1, 2, 3, 4];
/** 연속 두 번 누른 것으로 보는 최대 간격(ms). */
const DOUBLE_TAP_MS = 300;

interface Props {
  source: string | number;
  /** 뷰어가 차지할 높이 비율(0~1). 기본 0.72 */
  heightRatio?: number;
}

/**
 * 사진 확대 보기. 라이브러리 없이 동작하도록 "확대 단계(1~4배)"만큼 이미지를 키운 뒤
 * 가로·세로 스크롤로 구석구석 본다. 두 번 탭하거나 ＋/－ 버튼으로 확대·축소한다(핀치 제스처는 없다).
 */
export function ZoomableImage({ source, heightRatio = 0.72 }: Props) {
  const { width, height } = useWindowDimensions();
  const viewW = width;
  const viewH = Math.round(height * heightRatio);
  const [level, setLevel] = useState(0);
  const lastTap = useRef(0);
  const zoom = ZOOM_LEVELS[level];
  const hScroll = useRef<ScrollView>(null);
  const vScroll = useRef<ScrollView>(null);

  // 확대하면 이미지 가운데가 보이도록 스크롤을 가운데로 옮긴다(위쪽 빈 여백부터 보이지 않게).
  useEffect(() => {
    const timer = setTimeout(() => {
      hScroll.current?.scrollTo({ x: (viewW * zoom - viewW) / 2, animated: false });
      vScroll.current?.scrollTo({ y: (viewH * zoom - viewH) / 2, animated: false });
    }, 0);
    return () => clearTimeout(timer);
  }, [zoom, viewW, viewH]);

  const step = (dir: 1 | -1) => setLevel((l) => Math.min(ZOOM_LEVELS.length - 1, Math.max(0, l + dir)));

  const onTap = () => {
    const now = Date.now();
    if (now - lastTap.current < DOUBLE_TAP_MS) {
      setLevel((l) => (l === 0 ? 1 : 0)); // 두 번 탭: 확대 ↔ 원래 크기
      lastTap.current = 0;
    } else {
      lastTap.current = now;
    }
  };

  return (
    <View>
      <View style={{ width: viewW, height: viewH }}>
        <ScrollView
          ref={hScroll}
          horizontal
          nestedScrollEnabled
          bounces={false}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ width: viewW * zoom }}
        >
          <ScrollView
            ref={vScroll}
            nestedScrollEnabled
            bounces={false}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ width: viewW * zoom, height: viewH * zoom }}
          >
            <Pressable onPress={onTap} accessibilityRole="imagebutton" accessibilityLabel="사진, 두 번 누르면 확대">
              <SafeImage source={source} resizeMode="contain" style={{ width: viewW * zoom, height: viewH * zoom }} />
            </Pressable>
          </ScrollView>
        </ScrollView>
      </View>

      <View style={styles.controls}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="축소"
          disabled={level === 0}
          onPress={() => step(-1)}
          style={[styles.btn, level === 0 && styles.btnOff]}
        >
          <Text style={styles.btnText}>－</Text>
        </Pressable>
        <Text style={styles.zoomText}>{zoom}배</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="확대"
          disabled={level === ZOOM_LEVELS.length - 1}
          onPress={() => step(1)}
          style={[styles.btn, level === ZOOM_LEVELS.length - 1 && styles.btnOff]}
        >
          <Text style={styles.btnText}>＋</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16, paddingTop: 10 },
  btn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  btnOff: { opacity: 0.35 },
  btnText: { color: '#fff', fontSize: 22, fontWeight: '700' },
  zoomText: { color: '#fff', fontSize: 14, fontWeight: '700', minWidth: 36, textAlign: 'center' },
});
