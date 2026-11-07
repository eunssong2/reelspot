import React, { useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { API, api, ApiError, currentSession } from '../lib/api';
import { candidate, enqueueTask, submissionFile, type Candidate } from '../lib/uploads';
import { remainingCandidates } from '../lib/upload-acceptance';
import { useUploadDraft } from '../lib/upload-draft';
import { uploadDraftKey, assertUploadScope } from '../lib/upload-scope';
import { Transfer } from '../../modules/atp-transfer';
import { formatDuration } from '../lib/day-labels';
import { Button, Sheet, colors, useAction, confirm } from './ui';
export const UPLOAD_SHEET_MAX = 10;
/** "지금 이 순간 남기기": pick up to 10 photos/videos and upload them to one visit or date. */
function ScopedUploadSheet({
  visible,
  onClose,
  scheduleId,
  visitId,
  recordDate,
  onStateChange,
}: {
  visible: boolean;
  onClose: () => void;
  scheduleId: string;
  visitId: string | null;
  recordDate: string;
  onStateChange?: (state: { count: number; busy: boolean }) => void;
}) {
  const scope = { userId: currentSession()!.userId, scheduleId, recordDate, visitId };
  const draft = useUploadDraft(scope);
  const { files } = draft;
  const [choosing, setChoosing] = useState(false);
  const [existing, setExisting] = useState<any[]>([]);
  const [existingError, setExistingError] = useState('');
  const [reload, setReload] = useState(0);
  const [legacyDraft, setLegacyDraft] = useState(false);
  const [notice, setNotice] = useState(''),
    [limits, setLimits] = useState<{ photos: number; videos: number } | null>(null);
  const a = useAction({ inlineRetry: false });
  useEffect(() => { onStateChange?.({ count: files.length, busy: a.busy }); }, [files.length, a.busy, onStateChange]);
  useEffect(() => () => onStateChange?.({ count: 0, busy: false }), [onStateChange]);
  useEffect(() => {
    if (!visible) return;
    let live = true;
    AsyncStorage.getItem(`atp.upload-draft:${scope.userId}:${scheduleId}`)
      .then((saved) => live && setLegacyDraft(!!saved && saved !== '[]'))
      .catch(() => live && setLegacyDraft(true));
    void (async () => {
      const all: any[] = []; let cursor: string | null = null;
      do {
        const result: any = await api(`/schedules/${scheduleId}/media${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`);
        all.push(...result.items); cursor = result.nextCursor;
      } while (cursor && live);
      if (live) { setExisting(all.filter((m) => m.authorUserId === scope.userId && m.recordDate === recordDate && (m.visitId ?? null) === visitId)); setExistingError(''); }
    })().catch(() => { if (live) setExistingError('올린 기록을 불러오지 못했어요.'); });
    const q = new URLSearchParams({ recordDate });
    if (visitId) q.set('visitId', visitId);
    api(`/schedules/${scheduleId}/upload-limits?${q}`)
      .then((r) => live && setLimits({ photos: r.photos, videos: r.videos }))
      .catch(() => live && setLimits(null));
    return () => {
      live = false;
    };
  }, [visible, scheduleId, visitId, recordDate, scope.userId, reload]);
  const discard = (list: Candidate[]) =>
    list.forEach((f) => void FileSystem.deleteAsync(f.uri, { idempotent: true }).catch(() => {}));
  async function pick(kind: 'photo' | 'video', camera = false) {
    await draft.whileInUse(() => a.run(async () => {
      const room = UPLOAD_SHEET_MAX - files.length;
      if (room <= 0) throw new Error(`사진·동영상은 한 번에 ${UPLOAD_SHEET_MAX}개까지 올릴 수 있어요.`);
      setChoosing(false);
      if (camera) {
        const d = await api(`/schedules/${scheduleId}`);
        if (d.schedule.status !== 'active' || d.days.find((x: any) => x.date === recordDate)?.status !== 'active' || Date.parse(d.retention.expiresAt) <= Date.now())
          throw new Error('취소·만료된 날에는 새 기록을 올릴 수 없어요.');
        if (!(await ImagePicker.requestCameraPermissionsAsync()).granted) throw new Error('카메라 권한이 필요해요');
      }
      const options = { mediaTypes: [kind === 'photo' ? 'images' as const : 'videos' as const], quality: 1 };
      const result = camera
        ? await ImagePicker.launchCameraAsync({ ...options, cameraType: ImagePicker.CameraType.back, videoMaxDuration: 60 })
        : await ImagePicker.launchImageLibraryAsync({ ...options, allowsMultipleSelection: true, orderedSelection: true, selectionLimit: room });
      if (result.canceled) return;
      const added: Candidate[] = [];
      let duplicates = 0,
        failures = 0;
      for (const x of result.assets.slice(0, room)) {
        try {
          if (camera && kind === 'video' && !Transfer?.normalizeCapture) throw new Error('최신 Android 빌드가 필요해요.');
          const uri = camera && kind === 'video' ? await Transfer!.normalizeCapture(x.uri) : x.uri;
          const c = await candidate(
            uri,
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
      await draft.replace([...files, ...added]);
      setNotice(
        [
          result.assets.length > room && `최대 ${UPLOAD_SHEET_MAX}개까지만 담았어요.`,
          duplicates && `같은 파일 ${duplicates}개는 제외했어요.`,
          failures && `${failures}개는 형식·용량·길이를 확인할 수 없어 제외했어요. (사진 50MB, 영상 200MB·60초 이내)`,
        ]
          .filter(Boolean)
          .join(' '),
      );
    }));
  }
  async function upload() {
    await draft.whileInUse(() => a.run(async () => {
      assertUploadScope(scope, files);
      const r = await api(`/schedules/${scheduleId}/submissions`, {
        files: files.map((f, i) => submissionFile(f, i)),
      });
      const remaining = remainingCandidates(files, r.tasks);
      const enqueueErrors: string[] = [];
      for (const t of r.tasks) {
        const f = files.find((f) => f.clientFileId === t.clientFileId);
        if (f) { try { await enqueueTask(t, { ...f, scheduleId }); } catch { enqueueErrors.push(f.name); } }
      }
      await draft.replace(remaining);
      if (enqueueErrors.length) throw new Error('접수된 파일은 전송 상태에서 다시 시도해 주세요: ' + enqueueErrors.join(', '));
      if (remaining.length) {
        throw new Error(
          (r.fileErrors ?? [])
            .map((e: any) => `${files.find((f) => f.clientFileId === e.clientFileId)?.name ?? '파일'}: ${new ApiError(e.code).message}`)
            .join('\n') || '일부 파일의 접수 결과를 확인하지 못했어요. 남은 파일을 확인하고 다시 시도해 주세요.',
        );
      }
      await draft.replace([]);
      setNotice('');
      onClose();
      router.push('/uploads');
    }));
  }
  return (
    <Sheet visible={visible} title={choosing ? '사진·동영상 선택' : '지금 이 순간 남기기'} onClose={() => { setChoosing(false); onClose(); }}>
      {draft.error && <><Text>{draft.error}</Text><Button onPress={draft.retry}>다시 시도</Button></>}
      {choosing ? <>
        <Button onPress={() => pick('photo', true)}>📷 사진 촬영</Button>
        <Button onPress={() => pick('video', true)}>🎥 동영상 촬영</Button>
        <Button onPress={() => pick('photo')}>🖼️ 사진 보관함에서 선택</Button>
        <Button onPress={() => pick('video')}>🎞️ 동영상 보관함에서 선택</Button>
        <Button secondary onPress={() => setChoosing(false)}>취소</Button>
      </> : <>

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
              disabled={a.busy || !draft.ready}
              onPress={() => a.run(async () => {
                await draft.replace(files.filter((x) => x.clientFileId !== f.clientFileId));
                discard([f]);
              })}
              style={{
                position: 'absolute',
                top: 4,
                right: 4,
                width: 48,
                height: 48,
                borderRadius: 24,
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
            disabled={a.busy || !draft.ready}
            onPress={() => setChoosing(true)}
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
      {!!existing.length && <Text style={{ marginTop: 16, fontWeight: '700' }}>이미 올린 내 기록</Text>}
      <ScrollView horizontal contentContainerStyle={{ gap: 12, paddingVertical: 8 }}>
        {existing.map((m) => <View key={m.id} style={{ width: 96 }}>
          <Image accessibilityLabel="이미 올린 기록" source={[{ uri: `${API}/v1/media/${m.id}/content?variant=thumbnail`, headers: { Authorization: `Bearer ${currentSession()?.accessToken}` } }]} style={{ width: 96, height: 72, borderRadius: 8 }} />
          <Pressable accessibilityRole="button" accessibilityLabel={`${m.kind === 'video' ? '동영상' : '사진'} 삭제`} disabled={a.busy} style={{ minHeight: 48, minWidth: 48, justifyContent: 'center', alignItems: 'center' }} onPress={() => confirm('올린 기록을 삭제할까요?', `${m.kind === 'video' ? '동영상' : '사진'} 1개가 서버에서 삭제됩니다. 휴대폰 원본은 유지돼요.`, () => a.run(async () => {
            const result = await api('/media/deletions', { mediaIds: [m.id] });
            if (result.results.some((x: any) => x.status === 'failed')) throw new Error('삭제하지 못했어요. 다시 시도해 주세요.');
            setExisting((old) => old.filter((x) => x.id !== m.id)); setReload((n) => n + 1); setNotice('올린 기록을 삭제했어요.');
          }))}><Text>✕ 삭제</Text></Pressable>
        </View>)}
      </ScrollView>
      {!!existingError && <><Text>{existingError}</Text><Button secondary onPress={() => setReload((n) => n + 1)}>올린 기록 다시 불러오기</Button></>}
      {!!notice && <Text style={{ fontSize: 12, color: colors.sub, marginTop: 6 }}>{notice}</Text>}
      {a.errorView}
      {legacyDraft && <Button secondary disabled={a.busy} onPress={() => {
        onClose();
        router.push({ pathname: '/upload', params: { id: scheduleId } });
      }}>이전 업로드 후보 복구</Button>}
      <Button disabled={!files.length || a.busy || !draft.ready} onPress={upload}>
        {a.busy ? '준비 중…' : files.length ? `${files.length}개 업로드하기` : '업로드하기'}
      </Button>
      </>}
    </Sheet>
  );
}

export function UploadSheet(props: React.ComponentProps<typeof ScopedUploadSheet>) {
  const userId = currentSession()?.userId;
  if (!userId) return null;
  return <ScopedUploadSheet key={uploadDraftKey({ userId, ...props })} {...props} />;
}
