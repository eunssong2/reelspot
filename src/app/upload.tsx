import { useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useLocalSearchParams } from 'expo-router';
import { useInitialize } from '../lib/effects';
import { api, currentSession } from '../lib/api';
import { uploadDraftKey } from '../lib/upload-scope';
import { writeUploadDraft } from '../lib/upload-draft';
import type { Candidate } from '../lib/uploads';
import { Screen, Button, P, useAction } from '../components/ui';
/** Legacy saved candidates are recovered explicitly in their original scope, never retargeted. */
export default function LegacyUpload() {
  const { id, coverGroupId } = useLocalSearchParams<{ id?: string; coverGroupId?: string }>();
  const userId = currentSession()?.userId;
  const a = useAction();
  const [files, setFiles] = useState<Candidate[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  useInitialize(() => { if (id && userId) void a.run(async () => {
    const saved = JSON.parse((await AsyncStorage.getItem(`atp.upload-draft:${userId}:${id}`)) ?? '[]');
    if (!Array.isArray(saved)) throw new Error('이전 후보를 읽지 못했어요. 원본은 보존됩니다.');
    const detail = await api(`/schedules/${id}`);
    setNames(Object.fromEntries(detail.plan.flatMap((d: any) => d.visits.map((v: any) => [v.id, v.name]))));
    setFiles(saved);
  }); }, [id, userId]);
  const buckets = [...new Map(files.map((f) => [`${f.recordDate}:${f.visitId}`, { recordDate: f.recordDate, visitId: f.visitId }])).values()];
  return <Screen title="이전 업로드 후보">
    <P>촬영과 파일 선택은 장소의 업로드 시트에서 할 수 있어요. 이전 후보는 원래 날짜·장소로만 옮깁니다.</P>
    {coverGroupId && <Button onPress={() => router.replace({ pathname: '/group/invites', params: { id: coverGroupId } })}>모임 사진 관리로 이동</Button>}
    {buckets.map((bucket) => <Button key={`${bucket.recordDate}:${bucket.visitId}`} disabled={a.busy} onPress={() => a.run(async () => {
      const scope = { userId: userId!, scheduleId: id!, ...bucket };
      const current = JSON.parse((await AsyncStorage.getItem(uploadDraftKey(scope))) ?? '[]') as Candidate[];
      const selected = files.filter((f) => f.recordDate === bucket.recordDate && f.visitId === bucket.visitId);
      const merged = [...new Map([...current, ...selected].map((f) => [f.clientFileId, f])).values()];
      if (merged.length > 10) throw new Error('이전 후보와 현재 후보가 10개를 넘어요. 원래 장소의 업로드 시트에서 현재 후보를 먼저 정리해 주세요.');
      await writeUploadDraft(scope, merged);
      const remaining = files.filter((f) => !selected.some((x) => x.clientFileId === f.clientFileId));
      await AsyncStorage.setItem(`atp.upload-draft:${userId}:${id}`, JSON.stringify(remaining));
      setFiles(remaining);
      // File bytes stay intact; the successfully persisted scoped copy owns the candidates now.
      router.replace({ pathname: '/schedule/[id]', params: { id: id!, date: bucket.recordDate, recordVisit: bucket.visitId ?? '', openUpload: '1' } });
    })}>{bucket.recordDate} · {bucket.visitId ? names[bucket.visitId] ?? '사용할 수 없는 장소' : '장소 미지정'} · 업로드 시트로 이동</Button>)}
    {!files.length && <P>보관된 이전 후보가 없어요.</P>}
    {a.errorView}
  </Screen>;
}
