import { useState } from 'react';
import { currentSession } from '../lib/api';
import { useFocusLoad } from '../lib/effects';
import { listUploadDrafts, removeUploadDraft, type SavedUploadDraft } from '../lib/upload-draft';
import { Screen, Card, P, H, Button, confirm, useAction } from '../components/ui';

export default function UploadDrafts() {
  const [entries, setEntries] = useState<SavedUploadDraft[]>([]);
  const [loaded, setLoaded] = useState(false);
  const action = useAction();
  const userId = currentSession()?.userId;
  async function refresh() {
    if (!userId) throw new Error('로그인 후 다시 열어 주세요.');
    const result = await listUploadDrafts(userId);
    if (currentSession()?.userId === userId) { setEntries(result); setLoaded(true); }
  }
  useFocusLoad(() => { void action.run(refresh); }, [userId]);
  return <Screen title="이전 저장 후보 정리">
    <P>이전 버전에서 저장한 후보예요. 삭제·이동된 장소의 후보도 정리할 수 있어요. 새 후보는 기록 화면을 떠나면 비워집니다.</P>
    <P>정리하면 이 기기의 후보 사본만 지워요. 기기 앨범 원본과 접수된 전송 파일은 유지해요.</P>
    <P>앱에서 촬영한 파일은 앨범에 저장되지 않았으므로 후보를 지우면 다시 가져올 수 없어요.</P>
    {!loaded && <P>후보를 확인하고 있어요.</P>}
    {loaded && !entries.length && <P>보관 중인 후보가 없어요.</P>}
    {entries.map((entry) => <Card key={entry.key}>
      <H>{entry.label}</H>
      {entry.files.map((f, i) => <P key={`${f.clientFileId}:${i}`}>{f.name} · {f.recordDate}</P>)}
      {entry.unreadable && <P>목록 정보를 읽을 수 없어 파일은 자동 삭제하지 않아요. 목록만 제거할 수 있어요.</P>}
      <Button disabled={action.busy} onPress={() => confirm('이 후보를 정리할까요?', '이 기기에 보관된 선택이 사라집니다. 기기 앨범 원본과 접수된 전송 파일은 유지됩니다.', () => action.run(async () => {
        await removeUploadDraft(userId!, entry);
        await refresh();
      }))}>후보 정리</Button>
    </Card>)}
    <Button secondary disabled={action.busy} onPress={() => action.run(refresh)}>다시 확인</Button>
    {action.errorView}
  </Screen>;
}
