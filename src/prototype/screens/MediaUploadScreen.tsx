import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { AppHeader } from '../components/AppHeader';
import { PrimaryButton } from '../components/PrimaryButton';
import { ScreenFrame } from '../components/ScreenFrame';
import { Toast, useToast } from '../components/Toast';
import { VideoTrimBar } from '../components/VideoTrimBar';
import type { ClipSeconds, MediaKind } from '../mock/tripData';
import type { Nav } from '../navigation/routes';
import { colors, GUTTER, radius } from '../styles/tokens';

interface Props {
  nav: Nav;
  placeName?: string;
  /** 방장이 방을 만들 때 정한 동영상 길이. 진입 경로가 넘겨주지 못하면 10초를 기본값으로 쓴다. */
  clipSeconds?: ClipSeconds;
}

interface Picked {
  uri: string;
  name: string;
  kind: MediaKind;
  /** 동영상일 때만: 원본 길이(ms). 기기가 알려주지 않으면 없다. */
  durationMs?: number;
  /** 앨범 동영상을 잘랐을 때만: 실제 사용할 구간의 시작 지점(ms). */
  trimStartMs?: number;
}

interface SourceOption {
  key: string;
  icon: string;
  label: string;
  sub: string;
  run: () => Promise<ImagePicker.ImagePickerResult>;
}

type Step = 'options' | 'trim' | 'ready';

/** 원본 길이와 목표 길이 차이가 이 값보다 작으면 자를 필요가 없다고 본다(측정 오차 보정). */
const TRIM_TOLERANCE_MS = 300;

const seconds = (ms: number) => Math.round(ms / 1000);

/**
 * 4. 사진·동영상 올리기: 앨범에서 고르거나 카메라로 바로 찍는다.
 * 한 사람이 이 장소에 남기는 기록은 한 건이라 화면 수·템플릿 선택은 없다(그건 나중에 영상을 만들 때 고른다).
 *
 * 동영상은 방에서 정한 고정 길이(clipSeconds)로만 올라간다.
 * - 카메라로 찍을 때는 그 길이를 녹화 최대 길이로 걸어 둔다(웹은 브라우저 제약상 적용되지 않는다).
 * - 앨범에서 고른 동영상이 그보다 길면, 어느 구간을 쓸지 고르는 화면으로 먼저 보낸다.
 * 실제로 그 구간만 남기는 재인코딩(자르기)은 서버/업로드 단계에서 처리할 몫이라
 * 여기서는 선택한 시작 지점(trimStartMs)까지만 정해서 넘긴다.
 */
export function MediaUploadScreen({ nav, placeName, clipSeconds }: Props) {
  const clip = clipSeconds ?? 10;
  const clipMs = clip * 1000;

  const toast = useToast();
  const [step, setStep] = useState<Step>('options');
  const [picked, setPicked] = useState<Picked | null>(null);
  const [trimStartMs, setTrimStartMs] = useState(0);
  const [caption, setCaption] = useState('');
  const [busy, setBusy] = useState(false);

  const handlePicked = (asset: ImagePicker.ImagePickerAsset, fallbackKind: MediaKind) => {
    const kind: MediaKind = asset.type === 'video' ? 'video' : fallbackKind;
    const name = asset.fileName ?? asset.uri.split('/').pop() ?? (kind === 'photo' ? '사진' : '동영상');
    const durationMs = kind === 'video' ? asset.duration ?? undefined : undefined;

    setPicked({ uri: asset.uri, name, kind, durationMs });
    setCaption('');

    if (kind === 'video' && durationMs !== undefined && durationMs > clipMs + TRIM_TOLERANCE_MS) {
      // 목표 길이보다 길다 — 먼저 구간을 고르게 한다.
      setTrimStartMs(0);
      setStep('trim');
    } else {
      setStep('ready');
    }
  };

  const options: SourceOption[] = [
    {
      key: 'library',
      icon: '🖼️',
      label: '앨범에서 선택',
      sub: `가지고 있는 사진 또는 동영상을 골라요 (동영상은 ${clip}초로 잘라 올려요)`,
      run: () =>
        ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images', 'videos'], allowsMultipleSelection: false, quality: 0.8 }),
    },
    {
      key: 'camera-photo',
      icon: '📷',
      label: '사진 직접 찍기',
      sub: '카메라로 새 사진을 찍어요',
      run: () => ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8 }),
    },
    {
      key: 'camera-video',
      icon: '🎥',
      label: '동영상 직접 찍기',
      sub: `최대 ${clip}초까지 찍혀요`,
      run: () =>
        ImagePicker.launchCameraAsync({ mediaTypes: ['videos'], quality: 0.8, videoMaxDuration: clip }),
    },
  ];

  const choose = async (option: SourceOption) => {
    if (busy) return;
    setBusy(true);
    try {
      if (option.key !== 'library') {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
          toast.show('카메라 권한이 필요해요');
          return;
        }
      }
      const result = await option.run();
      if (result.canceled || result.assets.length === 0) return;
      handlePicked(result.assets[0], option.key === 'camera-video' ? 'video' : 'photo');
    } catch {
      toast.show('불러오지 못했어요');
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setPicked(null);
    setCaption('');
    setStep('options');
  };

  const confirmTrim = () => {
    if (!picked) return;
    setPicked({ ...picked, trimStartMs });
    setStep('ready');
  };

  const complete = () => {
    toast.show('업로드 완료! (프로토타입은 여기까지예요)');
    nav.back();
  };

  // 실제 길이를 알 수 있고, 목표보다 짧게 찍힌 경우에만 짧다는 걸 알려준다(길면 이미 잘랐으니 항상 정확히 맞는다).
  const shortByMs =
    picked?.kind === 'video' && picked.durationMs !== undefined && picked.trimStartMs === undefined
      ? clipMs - picked.durationMs
      : 0;

  return (
    <ScreenFrame>
      <AppHeader
        title={step === 'trim' ? '구간 고르기' : '사진·동영상 올리기'}
        subtitle={placeName}
        onBack={step === 'trim' ? () => setStep('options') : nav.back}
      />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {step === 'trim' && picked?.durationMs !== undefined ? (
          <>
            <Text style={styles.trimGuide}>
              동영상이 조금 길어요. 이 방은 {clip}초로 올리니, 쓸 구간을 골라 주세요.
            </Text>

            <View style={styles.videoTile}>
              <Text style={styles.videoIcon}>🎬</Text>
              <Text style={styles.videoName} numberOfLines={2}>
                {picked.name}
              </Text>
            </View>

            <VideoTrimBar
              durationMs={picked.durationMs}
              clipMs={clipMs}
              startMs={trimStartMs}
              onChangeStart={setTrimStartMs}
            />
          </>
        ) : step === 'ready' && picked ? (
          <>
            <View style={styles.previewBox}>
              {picked.kind === 'photo' ? (
                <Image source={{ uri: picked.uri }} style={styles.preview} resizeMode="cover" />
              ) : (
                <View style={styles.videoTile}>
                  <Text style={styles.videoIcon}>🎬</Text>
                  <Text style={styles.videoName} numberOfLines={2}>
                    {picked.name}
                  </Text>
                </View>
              )}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="다시 선택"
                onPress={reset}
                hitSlop={6}
                style={styles.remove}
              >
                <Text style={styles.removeText}>✕</Text>
              </Pressable>
            </View>

            {picked.kind === 'video' && (
              <Text style={styles.durationNote}>
                {picked.trimStartMs !== undefined
                  ? `선택한 구간: ${seconds(picked.trimStartMs)}~${seconds(picked.trimStartMs + clipMs)}초 (${clip}초 사용)`
                  : picked.durationMs !== undefined
                    ? shortByMs > TRIM_TOLERANCE_MS
                      ? `${seconds(picked.durationMs)}초로 찍혔어요 · 이 방 길이(${clip}초)보다 짧아요`
                      : `${clip}초로 찍혔어요`
                    : '동영상 길이를 확인하지 못했어요. 업로드 전에 다시 한번 봐 주세요.'}
              </Text>
            )}

            <Text style={styles.section}>한마디 (선택)</Text>
            <TextInput
              value={caption}
              onChangeText={setCaption}
              placeholder="이 순간을 한마디로 남겨 보세요"
              placeholderTextColor={colors.textMuted}
              maxLength={40}
              style={styles.captionInput}
            />
          </>
        ) : (
          <View style={styles.options}>
            {options.map((option) => (
              <Pressable
                key={option.key}
                accessibilityRole="button"
                accessibilityLabel={option.label}
                onPress={() => choose(option)}
                disabled={busy}
                style={({ pressed }) => [styles.option, pressed && styles.pressed]}
              >
                <View style={styles.optionIcon}>
                  <Text style={styles.optionIconText}>{option.icon}</Text>
                </View>
                <View style={styles.optionText}>
                  <Text style={styles.optionLabel}>{option.label}</Text>
                  <Text style={styles.optionSub}>{option.sub}</Text>
                </View>
                <Text style={styles.chevron}>›</Text>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>

      {step === 'trim' ? (
        <View style={styles.footer}>
          <PrimaryButton label="이 구간 사용" onPress={confirmTrim} />
        </View>
      ) : step === 'ready' ? (
        <View style={styles.footer}>
          <PrimaryButton label="완료" onPress={complete} />
        </View>
      ) : null}

      <Toast message={toast.message} bottom={step === 'options' ? 24 : 92} />
    </ScreenFrame>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: GUTTER, paddingBottom: 24, gap: 14 },
  options: { gap: 10, marginTop: 4 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: colors.surface,
    borderRadius: radius.item,
    padding: 14,
  },
  pressed: { opacity: 0.8 },
  optionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionIconText: { fontSize: 22 },
  optionText: { flex: 1, gap: 2 },
  optionLabel: { fontSize: 15, fontWeight: '700', color: colors.text },
  optionSub: { fontSize: 12, color: colors.textSub },
  chevron: { fontSize: 22, color: colors.textMuted },
  trimGuide: { fontSize: 14, fontWeight: '600', color: colors.text, lineHeight: 20 },
  previewBox: { width: '100%', aspectRatio: 0.9, borderRadius: radius.item, overflow: 'hidden', backgroundColor: colors.surface },
  preview: { flex: 1, width: '100%', height: '100%' },
  videoTile: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 12, backgroundColor: colors.surfaceStrong, borderRadius: radius.item },
  videoIcon: { fontSize: 40 },
  videoName: { fontSize: 12, color: colors.textSub, textAlign: 'center' },
  remove: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(35,39,47,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeText: { color: colors.onPrimary, fontSize: 13, fontWeight: '700' },
  durationNote: { fontSize: 13, fontWeight: '600', color: colors.textSub },
  section: { fontSize: 15, fontWeight: '700', color: colors.text, marginTop: 4 },
  captionInput: {
    backgroundColor: colors.surface,
    borderRadius: radius.item,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: colors.text,
  },
  footer: { paddingHorizontal: GUTTER, paddingTop: 8, paddingBottom: 16 },
});
