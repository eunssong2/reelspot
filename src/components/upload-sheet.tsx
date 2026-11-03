import React, { useEffect, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { api, ApiError } from '../lib/api';
import { candidate, enqueueTask, submissionFile, type Candidate } from '../lib/uploads';
import { formatDuration } from '../lib/day-labels';
import { Button, Sheet, colors, useAction } from './ui';
export const UPLOAD_SHEET_MAX = 10;
/** "지금 이 순간 남기기": pick up to 10 photos/videos and upload them to one visit or date. */
export function UploadSheet({
  visible,
  onClose,
  scheduleId,
  visitId,
  recordDate,
  cameraParams,
}: {
  visible: boolean;
  onClose: () => void;
  scheduleId: string;
  visitId: string | null;
  recordDate: string;
  cameraParams: Record<string, string>;
}) {
  const [files, setFiles] = useState<Candidate[]>([]),
    [notice, setNotice] = useState(''),
    [limits, setLimits] = useState<{ photos: number; videos: number } | null>(null);
  const a = useAction({ inlineRetry: false });
  useEffect(() => {
    if (!visible) return;
    let live = true;
    const q = new URLSearchParams({ recordDate });
    if (visitId) q.set('visitId', visitId);
    api(`/schedules/${scheduleId}/upload-limits?${q}`)
      .then((r) => live && setLimits({ photos: r.photos, videos: r.videos }))
      .catch(() => live && setLimits(null));
    return () => {
      live = false;
    };
  }, [visible, scheduleId, visitId, recordDate]);
  const discard = (list: Candidate[]) =>
    list.forEach((f) => void FileSystem.deleteAsync(f.uri, { idempotent: true }).catch(() => {}));
  async function pickAlbum() {
    await a.run(async () => {
      const room = UPLOAD_SHEET_MAX - files.length;
      if (room <= 0) throw new Error(`사진·동영상은 한 번에 ${UPLOAD_SHEET_MAX}개까지 올릴 수 있어요.`);
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images', 'videos'],
        allowsMultipleSelection: true,
        orderedSelection: true,
        selectionLimit: room,
        quality: 1,
      });
      if (result.canceled) return;
      const added: Candidate[] = [];
      let duplicates = 0,
        failures = 0;
      for (const x of result.assets.slice(0, room)) {
        try {
          const c = await candidate(
            x.uri,
            x.fileName ?? 'file',
            x.mimeType ?? (x.type === 'video' ? 'video/mp4' : 'image/jpeg'),
            recordDate,
            visitId,
            files.length + added.length,
          );
          if ([...files, ...added].some((f) => f.fingerprint === c.fingerprint)) {
            duplicates++;
            discard([c]);
          } else added.push(c);
        } catch {
          failures++;
        }
      }
      setFiles((old) => [...old, ...added]);
      setNotice(
        [
          result.assets.length > room && `최대 ${UPLOAD_SHEET_MAX}개까지만 담았어요.`,
          duplicates && `같은 파일 ${duplicates}개는 제외했어요.`,
          failures && `${failures}개는 형식·용량·길이를 확인할 수 없어 제외했어요. (사진 50MB, 영상 200MB·60초 이내)`,
        ]
          .filter(Boolean)
          .join(' '),
      );
    });
  }
  function add() {
    Alert.alert('사진·동영상 추가', undefined, [
      { text: '취소', style: 'cancel' },
      {
        text: '지금 촬영하기',
        onPress: () => {
          onClose();
          router.push({ pathname: '/camera', params: cameraParams });
        },
      },
      { text: '앨범에서 선택', onPress: () => void pickAlbum() },
    ]);
  }
  async function upload() {
    await a.run(async () => {
      const r = await api(`/schedules/${scheduleId}/submissions`, {
        files: files.map((f, i) => submissionFile({ ...f, recordDate, visitId }, i)),
      });
      for (const t of r.tasks) {
        const f = files.find((f) => f.clientFileId === t.clientFileId);
        if (f) await enqueueTask(t, f);
      }
      if (r.fileErrors?.length) {
        setFiles(files.filter((f) => r.fileErrors.some((e: any) => e.clientFileId === f.clientFileId)));
        throw new Error(
          r.fileErrors
            .map((e: any) => `${files.find((f) => f.clientFileId === e.clientFileId)?.name ?? '파일'}: ${new ApiError(e.code).message}`)
            .join('\n'),
        );
      }
      setFiles([]);
      setNotice('');
      onClose();
      router.push('/uploads');
    });
  }
  return (
    <Sheet visible={visible} title="지금 이 순간 남기기" onClose={onClose}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingVertical: 4 }}>
        {files.map((f) => (
          <View key={f.clientFileId} style={{ width: 80, height: 80 }}>
            {f.kind === 'photo' ? (
              <Image source={{ uri: f.uri }} style={{ width: 80, height: 80, borderRadius: 16 }} />
            ) : (
              <View
                style={{
                  width: 80,
                  height: 80,
                  borderRadius: 16,
                  backgroundColor: '#333D4B',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ color: 'white', fontSize: 22 }}>▶</Text>
                <Text style={{ position: 'absolute', right: 6, bottom: 4, color: 'white', fontSize: 11, fontWeight: '700' }}>
                  {formatDuration(f.durationMs)}
                </Text>
              </View>
            )}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${f.name} 빼기`}
              disabled={a.busy}
              onPress={() => {
                discard([f]);
                setFiles((old) => old.filter((x) => x.clientFileId !== f.clientFileId));
              }}
              style={{
                position: 'absolute',
                top: 4,
                right: 4,
                width: 24,
                height: 24,
                borderRadius: 12,
                backgroundColor: '#191F28B3',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ color: 'white', fontSize: 12 }}>✕</Text>
            </Pressable>
          </View>
        ))}
        {files.length < UPLOAD_SHEET_MAX && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="사진·동영상 추가"
            disabled={a.busy}
            onPress={add}
            style={{
              width: 80,
              height: 80,
              borderRadius: 16,
              borderWidth: 1.5,
              borderStyle: 'dashed',
              borderColor: '#F5A9A5',
              backgroundColor: colors.sage,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: colors.accent, fontSize: 30 }}>+</Text>
          </Pressable>
        )}
      </ScrollView>
      <Text style={{ fontSize: 13, color: colors.muted, marginTop: 10 }}>
        사진·동영상 최대 {UPLOAD_SHEET_MAX}개
        {limits ? ` · 이 장소에 더 올릴 수 있는 사진 ${limits.photos} · 동영상 ${limits.videos}` : ''}
      </Text>
      {!!notice && <Text style={{ fontSize: 12, color: colors.sub, marginTop: 6 }}>{notice}</Text>}
      {a.errorView}
      <Button disabled={!files.length || a.busy} onPress={upload}>
        {a.busy ? '준비 중…' : files.length ? `${files.length}개 업로드하기` : '업로드하기'}
      </Button>
    </Sheet>
  );
}
