import { useInitialize } from '../lib/effects';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { inputText, validDate } from '../lib/validation';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Image, Modal } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { api, currentSession, ApiError } from '../lib/api';
import { candidate, enqueueTask, submissionFile, type Candidate } from '../lib/uploads';
import { Screen, Field, Button, Card, H, P, useAction } from '../components/ui';
function VideoPreview({ uri }: { uri: string }) { const player = useVideoPlayer(uri); return <VideoView player={player} nativeControls style={{ height: 360 }} />; }
export default function Upload() {
  const p = useLocalSearchParams<{
      id?: string;
      startDate?: string;
      endDate?: string;
      visitId?: string;
      recordDate?: string;
      uri?: string;
      mime?: string;
      coverGroupId?: string;
    }>(),
    [files, setFiles] = useState<Candidate[]>([]),
    [visits, setVisits] = useState<any[]>([]),
    [errors, setErrors] = useState<any[]>([]), [pickErrors, setPickErrors] = useState<string[]>([]),
    [previewVideo, setPreviewVideo] = useState<string | null>(null), [draftReady, setDraftReady] = useState(false), [limits, setLimits] = useState<Record<string, any>>({});
  const draftKey = `atp.upload-draft:${currentSession()?.userId}:${p.coverGroupId ?? p.id}`;
  const draftWrite = useRef(Promise.resolve());
  const persist = useCallback((items: Candidate[]) => { draftWrite.current = draftWrite.current.catch(() => {}).then(() => AsyncStorage.setItem(draftKey, JSON.stringify(items))); return draftWrite.current; }, [draftKey]);
  useEffect(() => { if (draftReady) void persist(files); }, [files, draftReady, persist]);
  const a = useAction();
  const [selected, setSelected] = useState<string[]>([]),
    [bulkDate, setBulkDate] = useState('');
  const toggle = (id: string) =>
    setSelected((old) => (old.includes(id) ? old.filter((i) => i !== id) : [...old, id]));
  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' }),
    defaultDate =
      p.recordDate ||
      (today >= (p.startDate ?? '') && today <= (p.endDate ?? '') ? today : (p.startDate ?? today));
  useInitialize(() => {
    a.run(async () => {
      let items: Candidate[] = JSON.parse((await AsyncStorage.getItem(draftKey)) ?? '[]');
      let initialDate = defaultDate;
      if (p.id) {
        const r = await api(`/schedules/${p.id}`);
        const allVisits = r.plan.flatMap((d: any) => d.visits); setVisits(allVisits);
        initialDate = allVisits.find((v: any) => v.id === p.visitId)?.visitDate ?? initialDate;
        if (r.schedule.status !== 'active') throw new Error('취소된 일정에는 새 파일을 올릴 수 없습니다. 대기 파일은 전송 상태에서 확인해 주세요.');
      }
      if (p.uri && !items.some((f) => f.sourceUri === p.uri)) {
        if (items.length >= 120) throw new Error('촬영·가져오기 합계 최대 120개입니다.');
        items = [...items, await candidate(p.uri, 'camera.' + (p.mime?.startsWith('video/') ? 'mp4' : 'jpg'), p.mime ?? 'image/jpeg', initialDate, p.visitId || null, items.length)];
      }
      setFiles(items); setDraftReady(true);
    });
  }, [draftKey, p.uri]);
  const bucketKey = (f: Pick<Candidate, 'recordDate' | 'visitId'>) => `${f.recordDate}:${f.visitId ?? ''}`;
  const bucketSignature = files.map((f) => bucketKey(f)).join('|');
  useInitialize(() => {
    if (!p.id || !draftReady) return;
    let live = true;
    const buckets = [...new Map((files.length ? files : [{ recordDate: defaultDate, visitId: p.visitId || null }]).map((f) => [bucketKey(f), f])).values()];
    Promise.all(buckets.map(async (f) => { const q = new URLSearchParams({ recordDate: f.recordDate }); if (f.visitId) q.set('visitId', f.visitId); return [bucketKey(f), await api(`/schedules/${p.id}/upload-limits?${q}`)] as const; }))
      .then((entries) => { if (live) setLimits(Object.fromEntries(entries)); }).catch(() => { if (live) setLimits({}); });
    return () => { live = false; };
  }, [bucketSignature, draftReady, p.id]);
  async function pick() {
    await a.run(async () => {
      let picked: { uri: string; name: string; mime: string }[] = [];
      try {
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: p.coverGroupId ? ['images'] : ['images', 'videos'],
          allowsMultipleSelection: !p.coverGroupId,
          orderedSelection: true,
          selectionLimit: p.coverGroupId ? 1 : Math.max(1, 120 - files.length),
          quality: 1,
        });
        if (!result.canceled)
          picked = result.assets.map((x) => ({
            uri: x.uri,
            name: x.fileName ?? 'file',
            mime: x.mimeType ?? (x.type === 'video' ? 'video/mp4' : 'image/jpeg'),
          }));
      } catch {
        const r = await DocumentPicker.getDocumentAsync({
          type: p.coverGroupId ? 'image/*' : ['image/*', 'video/*'],
          multiple: !p.coverGroupId,
          copyToCacheDirectory: true,
        });
        if (!r.canceled)
          picked = r.assets.map((x) => ({
            uri: x.uri,
            name: x.name,
            mime: x.mimeType ?? 'application/octet-stream',
          }));
      }
      if (files.length + picked.length > 120)
        throw new Error('한 번에 최대 120개를 선택할 수 있어요.');
      const added: Candidate[] = [], failures: string[] = [];
      for (const f of picked) {
        try { added.push(await candidate(f.uri, f.name, f.mime, defaultDate, p.visitId || null, files.length + added.length)); }
        catch { failures.push(`${f.name}: 파일 접근·형식·용량·길이를 확인할 수 없습니다. 사진 50MB/100메가픽셀, 영상 200MB/60초 이내의 지원 파일을 선택해 주세요.`); }
      }
      setPickErrors(failures);
      setFiles(p.coverGroupId ? added : [...files, ...added]);
    });
  }
  return (
    <Screen
      title={p.coverGroupId ? '모임 대표 사진' : '기록 올리기'}
      subtitle="사진·영상마다 날짜와 장소를 확인해 주세요."
    >
      <Modal visible={!!previewVideo} transparent={false} onRequestClose={() => setPreviewVideo(null)}>{previewVideo && <Screen title="선택 영상 미리보기" back={false}><VideoPreview uri={previewVideo} /><Button onPress={() => setPreviewVideo(null)}>미리보기 닫기</Button></Screen>}</Modal>
      <Button secondary disabled={a.busy || !draftReady} onPress={pick}>
        휴대폰에서 파일 선택
      </Button>
      <P>
        {files.length} / {p.coverGroupId ? 1 : 120}개 선택
      </P>
      {!p.coverGroupId && <Button secondary disabled={a.busy || !draftReady || files.length >= 120} onPress={() => router.push({ pathname: '/camera', params: { id: p.id, startDate: p.startDate, endDate: p.endDate, visitId: p.visitId, recordDate: p.recordDate } })}>촬영해서 후보에 추가</Button>}
      {pickErrors.map((error, i) => <P key={i}>{error}</P>)}
      {!p.coverGroupId && Object.entries(limits).map(([key, remaining]) => <Card key={key}><P>{remaining.recordDate} · {visits.find((v) => v.id === remaining.visitId)?.name ?? '장소 미지정'}</P><P>추가 가능: 사진 {remaining.photos}/5개 · 영상 {remaining.videos}/2개</P><P>현재 후보: 사진 {files.filter((f) => bucketKey(f) === key && f.kind === 'photo').length} · 영상 {files.filter((f) => bucketKey(f) === key && f.kind === 'video').length}개 · 서버가 접수할 때 다시 확인합니다.</P></Card>)}
      {!p.coverGroupId && (
        <P>
          작성자별 장소당 사진 5개·영상 2개까지 올릴 수 있어요. 장소가 없으면 같은 일정·기록일
          기준으로 적용됩니다.
        </P>
      )}
      {!p.coverGroupId && files.length > 0 && (
        <Card>
          <Button secondary onPress={() => setSelected(files.map((f) => f.clientFileId))}>
            후보 전체 선택
          </Button>
          <P>{selected.length}개 선택 · 파일을 길게 눌러도 선택할 수 있어요.</P>
          {selected.length > 0 && (
            <>
              <Field
                label="선택 파일에 적용할 기록일"
                value={bulkDate}
                onChangeText={setBulkDate}
                placeholder={defaultDate}
              />
              <Button
                secondary
                onPress={() =>
                  setFiles(
                    files.map((f) =>
                      selected.includes(f.clientFileId)
                        ? { ...f, recordDate: bulkDate || defaultDate, visitId: null }
                        : f,
                    ),
                  )
                }
              >
                선택 파일의 기록일 적용·방문 해제
              </Button>
              {visits.map((v) => (
                <Button
                  secondary
                  key={v.id}
                  onPress={() =>
                    setFiles(
                      files.map((f) =>
                        selected.includes(f.clientFileId)
                          ? { ...f, recordDate: v.visitDate, visitId: v.id }
                          : f,
                      ),
                    )
                  }
                >
                  {v.visitDate} · {v.name}에 일괄 지정
                </Button>
              ))}
              <Button
                secondary
                onPress={() => {
                  setFiles(files.filter((f) => !selected.includes(f.clientFileId)));
                  setSelected([]);
                }}
              >
                선택 후보 제거
              </Button>
              <Button secondary onPress={() => setSelected([])}>
                선택 끝내기
              </Button>
            </>
          )}
        </Card>
      )}
      {files.map((f, i) => (
        <Card key={f.clientFileId} onLongPress={() => toggle(f.clientFileId)}>
          {f.kind === 'photo' && (
            <Image
              source={{ uri: f.uri }}
              style={{ height: 150, borderRadius: 8 }}
              resizeMode="contain"
            />
          )}
          <H>{f.name}</H>
          {f.kind === 'video' && <Button secondary onPress={() => setPreviewVideo(f.uri)}>영상 미리보기</Button>}
          {!p.coverGroupId && (
            <Button secondary onPress={() => toggle(f.clientFileId)}>
              {selected.includes(f.clientFileId) ? '✓ 선택됨' : '이 파일 선택'}
            </Button>
          )}
          <P>
            {(f.declaredBytes / 1000000).toFixed(1)}MB · {f.kind === 'photo' ? '사진' : '영상'}{f.durationMs ? ` · ${(f.durationMs / 1000).toFixed(1)}초` : ''}
          </P>
          {!p.coverGroupId && limits[bucketKey(f)] && files.slice(0, i + 1).filter((x) => bucketKey(x) === bucketKey(f) && x.kind === f.kind).length > limits[bucketKey(f)][f.kind === 'photo' ? 'photos' : 'videos'] && <P>현재 남은 개수를 초과하는 후보입니다. 다른 방문·날짜를 선택하거나 후보에서 제거해 주세요.</P>}
          {!p.coverGroupId && (
            <>
              <Field
                label="기록일"
                value={f.recordDate}
                onChangeText={(v) =>
                  setFiles(
                    files.map((x, j) => (j === i ? { ...x, recordDate: v, visitId: null } : x)),
                  )
                }
              />
              <P>방문 연결</P>
              <Button
                secondary
                onPress={() =>
                  setFiles(files.map((x, j) => (j === i ? { ...x, visitId: null } : x)))
                }
              >
                {!f.visitId ? '✓ ' : ''}장소 미지정
              </Button>
              {visits
                .filter((v) => v.visitDate === f.recordDate)
                .map((v) => (
                  <Button
                    key={v.id}
                    secondary={f.visitId !== v.id}
                    onPress={() =>
                      setFiles(files.map((x, j) => (j === i ? { ...x, visitId: v.id } : x)))
                    }
                  >
                    {v.name}
                  </Button>
                ))}
              <Field
                label="설명 · 선택"
                multiline
                value={f.description}
                onChangeText={(v) =>
                  setFiles(files.map((x, j) => (j === i ? { ...x, description: v } : x)))
                }
              />
            </>
          )}
          <Button secondary onPress={() => setFiles(files.filter((_, j) => j !== i))}>
            후보에서 제거
          </Button>
        </Card>
      ))}
      {errors.map((e, i) => (
        <Card key={i}>
          <P>
            {files.find((f) => f.clientFileId === e.clientFileId)?.name ?? '선택 파일'} · {new ApiError(e.code).message}
          </P>
        </Card>
      ))}
      <Button
        disabled={!files.length || a.busy}
        onPress={() =>
          a.run(async () => {
            if (!p.coverGroupId) for (const f of files) { validDate(f.recordDate); if (f.recordDate < p.startDate! || f.recordDate > p.endDate!) throw new Error('기록일은 일정 기간 안이어야 합니다.'); inputText(f.description, '설명', 1000, false, true); }
            if (p.coverGroupId) {
              const f = files[0],
                t = await api(`/groups/${p.coverGroupId}/cover-uploads`, {
                  file: {
                    name: f.name,
                    mime: f.mime,
                    declaredBytes: f.declaredBytes,
                    fingerprint: f.fingerprint,
                  },
                });
              await enqueueTask(t, f);
            } else {
              const r = await api(`/schedules/${p.id}/submissions`, {
                files: files.map(submissionFile),
              });
              setErrors(r.fileErrors);
              for (const t of r.tasks) {
                const f = files.find((f) => f.clientFileId === t.clientFileId)!;
                await enqueueTask(t, f);
              }
              if (r.fileErrors.length) {
                const failed = files.filter((f) => r.fileErrors.some((e: any) => e.clientFileId === f.clientFileId));
                setFiles(failed); await persist(failed);
                return;
              }
            }
            setFiles([]); await persist([]);
            router.replace('/uploads');
          })
        }
      >
        확인하고 전송 시작
      </Button>
      <P>제공되는 파일에서는 촬영 위치 정보를 제거합니다. 기기 원본은 변경하지 않습니다.</P>
      {a.errorView}
    </Screen>
  );
}
