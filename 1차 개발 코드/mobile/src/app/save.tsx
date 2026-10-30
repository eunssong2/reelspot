import React, { useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import * as FS from 'expo-file-system/legacy';
import { API, api, currentSession } from '../lib/api';
import { Transfer } from '../../modules/atp-transfer';
import { Screen, Button, P, Card, H, useAction } from '../components/ui';
export default function Save() {
  const { ids } = useLocalSearchParams<{ ids: string }>(), [results, setResults] = useState<any[]>([]), [stage, setStage] = useState('');
  const a = useAction();
  async function save(only?: string[]) {
    await a.run(async () => {
      if (!Transfer) throw new Error('Android 빌드에서 저장할 수 있습니다.');
      setStage('파일 준비 중');
      const r = await api('/exports', { mediaIds: only ?? ids.split(','), purpose: 'save' }), output: any[] = only ? results.filter((i) => !only.includes(i.mediaId)) : [];
      for (const [index,item] of r.results.entries()) {
        if (item.state !== 'ready') { output.push({ ...item, state: 'failed' }); setResults([...output]); continue; }
        const local = `${FS.cacheDirectory}save-${item.mediaId}`;
        try {
          setStage(`${index+1}/${r.results.length} · 내려받는 중`);
          let d = await FS.downloadAsync(`${API}/v1/exports/${r.exportId}/files/${item.mediaId}`, local, { headers: { Authorization: `Bearer ${currentSession()?.accessToken}` } });
          if (d.status === 401) { await api(`/exports/${r.exportId}`); d = await FS.downloadAsync(`${API}/v1/exports/${r.exportId}/files/${item.mediaId}`, local, { headers: { Authorization: `Bearer ${currentSession()?.accessToken}` } }); }
          if (d.status !== 200) throw new Error([403,410].includes(d.status) ? '참여 권한·보관 기한·파일 상태가 변경되었습니다.' : '파일 내려받기에 실패했습니다. 네트워크를 확인해 주세요.');
          const mime = d.headers['content-type'] ?? d.headers['Content-Type'] ?? 'image/jpeg', ext = mime.includes('video') ? 'mp4' : mime.includes('png') ? 'png' : 'jpg';
          setStage(`${index+1}/${r.results.length} · 휴대폰 앨범에 쓰는 중`);
          await Transfer.saveToAlbum(local, mime, `at-that-place-${item.mediaId}.${ext}`);
          output.push({ ...item, state: 'saved', album: mime.includes('video') ? 'Movies/At that place' : 'Pictures/At that place' });
        } catch (e) { output.push({ ...item, state: 'failed', reason: (e as Error).message.includes('space') ? '기기의 남은 저장 공간을 확인해 주세요.' : '내려받기 또는 앨범 저장에 실패했습니다. 네트워크·저장 공간·파일 접근 상태를 확인해 주세요.' }); }
        finally { await FS.deleteAsync(local, { idempotent: true }).catch(() => {}); }
        setResults([...output]);
      }
      setStage(`저장 완료 ${output.filter((i) => i.state === 'saved').length}개 · 실패 ${output.filter((i) => i.state === 'failed').length}개`);
    });
  }
  return <Screen title="휴대폰에 저장" subtitle="사진은 Pictures/At that place, 영상은 Movies/At that place에 저장됩니다.">
    <P>{ids.split(',').length}개 선택 · 촬영 위치를 제거한 파일을 저장합니다.</P>
    <P>촬영 날짜가 유지되므로 앨범의 맨 위에 보이지 않을 수 있습니다. 저장 위치나 촬영 날짜로 찾아 주세요.</P>
    {stage && <P>{stage}</P>}
    <Button disabled={a.busy || results.length > 0} onPress={() => save()}>선택 기록 저장</Button>
    {results.map((r) => <Card key={r.mediaId}><H>{r.state === 'saved' ? '저장 완료' : '저장 실패'}</H><P>{r.reason ?? (r.converted ? '기기 호환 형식으로 변환했습니다.' : '원래 해상도 저장본')}</P>{r.album && <P>{r.album}</P>}</Card>)}
    {results.some((r) => r.state === 'failed') && <Button secondary disabled={a.busy} onPress={() => save(results.filter((r) => r.state === 'failed').map((r) => r.mediaId))}>실패한 파일만 재시도</Button>}
    {a.errorView}
  </Screen>;
}
