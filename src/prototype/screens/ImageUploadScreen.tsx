import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppHeader } from '../components/AppHeader';
import { PrimaryButton } from '../components/PrimaryButton';
import { ScreenFrame } from '../components/ScreenFrame';
import { Toast, useToast } from '../components/Toast';
import { TEMPLATE_BY_ID, type MediaKind } from '../mock/tripData';
import type { Nav } from '../navigation/routes';
import { colors, GUTTER, radius } from '../styles/tokens';

interface Props {
  nav: Nav;
  cuts: number;
  templateId: string;
  kind: MediaKind;
}

interface Slot {
  uri: string;
  name: string;
}

/**
 * 5. 이미지 업로드: 선택한 컷 수만큼 세로형 칸을 보여 주고, 기기(웹에서는 파일 선택창)에서
 * 고른 파일을 미리보기로만 표시한다. 서버 업로드는 하지 않는다.
 */
export function ImageUploadScreen({ nav, cuts, templateId, kind }: Props) {
  const toast = useToast();
  const [slots, setSlots] = useState<(Slot | null)[]>(() => Array.from({ length: cuts }, () => null));

  const template = TEMPLATE_BY_ID[templateId];
  const noun = kind === 'photo' ? '사진' : '동영상';
  const filled = slots.filter(Boolean).length;
  // 1~3칸은 한 줄, 4칸은 2×2, 5칸은 3+2 로 배치한다.
  const perRow = cuts <= 3 ? cuts : cuts === 4 ? 2 : 3;

  const pick = async (index: number) => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: kind === 'photo' ? ['images'] : ['videos'],
        allowsMultipleSelection: false,
        quality: 0.8,
      });
      if (result.canceled || result.assets.length === 0) return;
      const asset = result.assets[0];
      const name = asset.fileName ?? asset.uri.split('/').pop() ?? noun;
      setSlots((prev) => prev.map((s, i) => (i === index ? { uri: asset.uri, name } : s)));
    } catch {
      toast.show(`${noun}을(를) 불러오지 못했어요`);
    }
  };

  const clear = (index: number) => setSlots((prev) => prev.map((s, i) => (i === index ? null : s)));

  const next = () => {
    if (filled < cuts) {
      toast.show(`${noun} ${cuts - filled}개를 더 추가해 주세요`);
    } else {
      toast.show('업로드 준비가 끝났어요 (프로토타입은 여기까지예요)');
    }
  };

  return (
    <ScreenFrame>
      <AppHeader title="이미지 업로드" onBack={nav.back} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.info}>
          <Text style={styles.infoLabel}>선택한 템플릿</Text>
          <View style={styles.infoDivider} />
          <Text style={styles.infoValue}>
            {cuts}컷 ({template?.label ?? '-'}) · {noun}
          </Text>
        </View>

        <View style={styles.grid}>
          {slots.map((slot, i) => (
            <View key={i} style={[styles.slotBox, { width: `${100 / perRow}%` }]}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={slot ? `${i + 1}번 ${noun} 변경` : `${i + 1}번 ${noun} 추가`}
                onPress={() => pick(i)}
                style={({ pressed }) => [styles.slot, slot ? styles.slotFilled : styles.slotEmpty, pressed && styles.pressed]}
              >
                {slot && kind === 'photo' ? (
                  <Image source={{ uri: slot.uri }} style={styles.preview} resizeMode="cover" />
                ) : slot ? (
                  <View style={styles.videoTile}>
                    <Text style={styles.videoIcon}>🎬</Text>
                    <Text style={styles.videoName} numberOfLines={3}>
                      {slot.name}
                    </Text>
                  </View>
                ) : (
                  <View style={styles.addWrap}>
                    <View style={styles.addCircle}>
                      <Text style={styles.addPlus}>+</Text>
                    </View>
                    <Text style={styles.addText}>{noun} 추가</Text>
                  </View>
                )}
              </Pressable>
              {slot ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${i + 1}번 ${noun} 삭제`}
                  onPress={() => clear(i)}
                  hitSlop={6}
                  style={styles.remove}
                >
                  <Text style={styles.removeText}>✕</Text>
                </Pressable>
              ) : null}
            </View>
          ))}
        </View>

        <Text style={styles.progress}>
          {filled} / {cuts} 추가됨
        </Text>
      </ScrollView>

      <View style={styles.footer}>
        <PrimaryButton label="다음" onPress={next} />
      </View>

      <Toast message={toast.message} bottom={92} />
    </ScreenFrame>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: GUTTER, paddingBottom: 24, gap: 14 },
  info: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.primarySoft,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  infoLabel: { fontSize: 13, fontWeight: '700', color: colors.text },
  infoDivider: { width: 1, height: 14, backgroundColor: colors.primaryBorder },
  infoValue: { flex: 1, fontSize: 13, fontWeight: '600', color: colors.primary },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -4 },
  slotBox: { padding: 4 },
  slot: { aspectRatio: 0.52, borderRadius: radius.item, overflow: 'hidden' },
  slotEmpty: { backgroundColor: colors.surface, borderWidth: 2, borderColor: colors.primaryBorder, borderStyle: 'dashed' },
  slotFilled: { backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.line },
  pressed: { opacity: 0.85 },
  addWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  addCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 2,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addPlus: { fontSize: 24, lineHeight: 27, color: colors.primary, fontWeight: '500' },
  addText: { fontSize: 12, fontWeight: '600', color: colors.textSub },
  preview: { flex: 1, width: '100%', height: '100%' },
  videoTile: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6, padding: 8, backgroundColor: colors.surfaceStrong },
  videoIcon: { fontSize: 30 },
  videoName: { fontSize: 11, color: colors.textSub, textAlign: 'center' },
  remove: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(35,39,47,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeText: { color: colors.onPrimary, fontSize: 12, fontWeight: '700' },
  progress: { textAlign: 'center', fontSize: 13, color: colors.textSub, fontWeight: '600' },
  footer: { paddingHorizontal: GUTTER, paddingTop: 8, paddingBottom: 16 },
});
