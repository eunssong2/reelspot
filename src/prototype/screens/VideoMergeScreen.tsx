import * as ImagePicker from 'expo-image-picker';
import { useEffect, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { AppHeader } from '../components/AppHeader';
import { PrimaryButton } from '../components/PrimaryButton';
import { ScreenFrame } from '../components/ScreenFrame';
import { Toast, useToast } from '../components/Toast';
import type { Nav } from '../navigation/routes';
import { colors, GUTTER, radius } from '../styles/tokens';
import { MergedVideoPlayer } from '../video/MergedVideoPlayer';
import { MERGE_SUPPORTED, mergeVideos, type MergeProgress, type MergeResult } from '../video/mergeVideos';

interface Clip {
  id: string;
  uri: string;
  name: string;
}

type Status = { kind: 'idle' } | { kind: 'merging'; progress: MergeProgress | null } | { kind: 'done'; result: MergeResult };

const formatSeconds = (ms: number) => `${(ms / 1000).toFixed(1)}초`;
const formatSize = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)}MB`;

/**
 * 동영상 이어 붙이기 실험 화면(가능성 확인용).
 * 여러 동영상을 고르고 순서를 정한 뒤 "합치기"를 누르면 한 편으로 이어 붙여 바로 재생해 본다.
 * 실제 합치기는 브라우저에서만 된다(src/prototype/video/mergeVideos.web.ts).
 */
export function VideoMergeScreen({ nav }: { nav: Nav }) {
  const toast = useToast();
  const [clips, setClips] = useState<Clip[]>([]);
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  // 합친 영상 위쪽에 얹을 글씨(장소 이름 등). 비우면 글씨 없이 합친다.
  const [overlayText, setOverlayText] = useState('제천');

  const merging = status.kind === 'merging';
  const resultUri = status.kind === 'done' ? status.result.uri : null;

  // 새 결과로 바뀌거나 화면을 떠나면 이전 결과 blob 을 메모리에서 푼다.
  useEffect(() => {
    if (!resultUri || Platform.OS !== 'web') return;
    return () => URL.revokeObjectURL(resultUri);
  }, [resultUri]);

  const pick = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['videos'],
        allowsMultipleSelection: true,
        orderedSelection: true,
      });
      if (result.canceled) return;
      const added = result.assets.map((asset, i) => ({
        id: `${Date.now()}-${i}`,
        uri: asset.uri,
        name: asset.fileName ?? `동영상 ${clips.length + i + 1}`,
      }));
      setClips((prev) => [...prev, ...added]);
      setStatus({ kind: 'idle' });
    } catch {
      toast.show('동영상을 불러오지 못했어요');
    }
  };

  const move = (index: number, delta: -1 | 1) => {
    setClips((prev) => {
      const next = [...prev];
      const target = index + delta;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
    setStatus({ kind: 'idle' });
  };

  const remove = (id: string) => {
    setClips((prev) => prev.filter((clip) => clip.id !== id));
    setStatus({ kind: 'idle' });
  };

  const merge = async () => {
    setStatus({ kind: 'merging', progress: null });
    try {
      // 버튼 누른 흐름에서 바로 호출해야 브라우저가 소리 있는 재생을 허락한다(앞에 await 를 두지 않는다).
      const result = await mergeVideos(clips, {
        overlayText,
        onProgress: (progress) => setStatus({ kind: 'merging', progress }),
      });
      setStatus({ kind: 'done', result });
      if (result.muted) toast.show('브라우저 제한으로 소리 없이 합쳐졌어요');
    } catch (error) {
      setStatus({ kind: 'idle' });
      toast.show(error instanceof Error ? error.message : '합치지 못했어요');
    }
  };

  const download = () => {
    if (status.kind !== 'done' || Platform.OS !== 'web') return;
    const ext = status.result.mimeType.includes('mp4') ? 'mp4' : 'webm';
    const a = document.createElement('a');
    a.href = status.result.uri;
    a.download = `reelspot-merged.${ext}`;
    a.click();
  };

  const progressText =
    status.kind === 'merging' && status.progress
      ? `${status.progress.index + 1}/${status.progress.total}번째 영상 합치는 중 · ${Math.round(status.progress.clipRatio * 100)}%`
      : '준비 중…';
  const overallRatio =
    status.kind === 'merging' && status.progress
      ? (status.progress.index + status.progress.clipRatio) / status.progress.total
      : 0;

  return (
    <ScreenFrame>
      <AppHeader title="동영상 이어 붙이기" subtitle="실험 화면" onBack={merging ? undefined : nav.back} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {!MERGE_SUPPORTED ? (
          <Text style={styles.notice}>
            지금은 웹 브라우저에서만 합쳐 볼 수 있어요. 앱에서는 ffmpeg 같은 네이티브 모듈이 필요해요.
          </Text>
        ) : (
          <Text style={styles.guide}>
            동영상을 2개 이상 고르고 순서를 정한 뒤 합쳐 보세요. 영상 길이만큼 시간이 걸리고, 합치는 동안 이 탭을 열어 두어야 해요.
          </Text>
        )}

        {status.kind === 'done' && (
          <View style={styles.resultBox}>
            <View style={styles.player}>
              <MergedVideoPlayer uri={status.result.uri} />
            </View>
            <Text style={styles.resultMeta}>
              {formatSeconds(status.result.durationMs)} · {formatSize(status.result.sizeBytes)} · {status.result.mimeType}
            </Text>
            <Text style={styles.resultMeta}>합치는 데 {formatSeconds(status.result.elapsedMs)} 걸렸어요</Text>
            {Platform.OS === 'web' && (
              <Pressable accessibilityRole="button" onPress={download} style={({ pressed }) => [styles.ghost, pressed && styles.pressed]}>
                <Text style={styles.ghostText}>파일로 저장</Text>
              </Pressable>
            )}
          </View>
        )}

        {clips.map((clip, index) => (
          <View key={clip.id} style={styles.clip}>
            <View style={styles.order}>
              <Text style={styles.orderText}>{index + 1}</Text>
            </View>
            <Text style={styles.clipName} numberOfLines={1}>
              {clip.name}
            </Text>
            <IconButton label="위로" glyph="↑" onPress={() => move(index, -1)} disabled={merging || index === 0} />
            <IconButton label="아래로" glyph="↓" onPress={() => move(index, 1)} disabled={merging || index === clips.length - 1} />
            <IconButton label="빼기" glyph="✕" onPress={() => remove(clip.id)} disabled={merging} />
          </View>
        ))}

        <Text style={styles.section}>영상 위 글씨</Text>
        <TextInput
          value={overlayText}
          onChangeText={(text) => {
            setOverlayText(text);
            setStatus({ kind: 'idle' });
          }}
          editable={!merging}
          placeholder="비우면 글씨 없이 합쳐요"
          placeholderTextColor={colors.textMuted}
          maxLength={20}
          style={styles.textInput}
        />

        <Pressable
          accessibilityRole="button"
          onPress={pick}
          disabled={merging}
          style={({ pressed }) => [styles.add, pressed && styles.pressed, merging && styles.disabled]}
        >
          <Text style={styles.addText}>＋ 동영상 추가</Text>
        </Pressable>
      </ScrollView>

      <View style={styles.footer}>
        {merging && (
          <View style={styles.progress}>
            <Text style={styles.progressText}>{progressText}</Text>
            <View style={styles.track}>
              <View style={[styles.fill, { width: `${Math.round(overallRatio * 100)}%` }]} />
            </View>
          </View>
        )}
        <PrimaryButton
          label={merging ? '합치는 중…' : `${clips.length}개 합치기`}
          onPress={merge}
          disabled={!MERGE_SUPPORTED || merging || clips.length < 2}
        />
      </View>

      <Toast message={toast.message} bottom={92} />
    </ScreenFrame>
  );
}

function IconButton({ label, glyph, onPress, disabled }: { label: string; glyph: string; onPress: () => void; disabled: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      disabled={disabled}
      hitSlop={4}
      style={({ pressed }) => [styles.iconButton, pressed && styles.pressed, disabled && styles.disabled]}
    >
      <Text style={styles.iconGlyph}>{glyph}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: GUTTER, paddingBottom: 24, gap: 10 },
  guide: { fontSize: 14, color: colors.textSub, lineHeight: 20, marginBottom: 4 },
  notice: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.danger,
    lineHeight: 20,
    backgroundColor: colors.surface,
    borderRadius: radius.item,
    padding: 14,
  },
  resultBox: { gap: 6, marginBottom: 8 },
  player: { width: '100%', aspectRatio: 9 / 16, borderRadius: radius.item, overflow: 'hidden', backgroundColor: '#000' },
  resultMeta: { fontSize: 12, color: colors.textSub },
  ghost: {
    alignSelf: 'flex-start',
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginTop: 2,
  },
  ghostText: { fontSize: 13, fontWeight: '700', color: colors.primary },
  clip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.surface,
    borderRadius: radius.item,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  order: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orderText: { color: colors.onPrimary, fontSize: 13, fontWeight: '700' },
  clipName: { flex: 1, fontSize: 14, color: colors.text },
  iconButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surfaceStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconGlyph: { fontSize: 14, fontWeight: '700', color: colors.text },
  add: {
    borderRadius: radius.item,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.primaryBorder,
    backgroundColor: colors.primarySoft,
    paddingVertical: 16,
    alignItems: 'center',
  },
  addText: { fontSize: 15, fontWeight: '700', color: colors.primary },
  section: { fontSize: 15, fontWeight: '700', color: colors.text, marginTop: 6 },
  textInput: {
    backgroundColor: colors.surface,
    borderRadius: radius.item,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: colors.text,
  },
  pressed: { opacity: 0.8 },
  disabled: { opacity: 0.4 },
  footer: { paddingHorizontal: GUTTER, paddingTop: 8, paddingBottom: 16, gap: 10 },
  progress: { gap: 6 },
  progressText: { fontSize: 13, fontWeight: '600', color: colors.textSub },
  track: { height: 6, borderRadius: 3, backgroundColor: colors.surface, overflow: 'hidden' },
  fill: { height: 6, backgroundColor: colors.primary },
});
