import React, { useState } from 'react';
import { useFocusLoad } from '../lib/effects';
import { api, currentSession } from '../lib/api';
import * as FS from 'expo-file-system/legacy';
import { getCurrentVideoCacheSize } from 'expo-video';
import { Screen, Card, H, P, useAction } from '../components/ui';
export default function Storage() {
  const [groups, setGroups] = useState<any[]>([]), [localBytes, setLocalBytes] = useState(0), [cacheBytes, setCacheBytes] = useState(0);
  const a = useAction();
  useFocusLoad(() => { a.run(async () => {
    const result = []; let cursor: string | null = null;
    do { const page: any = await api(`/groups${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`); result.push(...await Promise.all(page.items.map(async (group: any) => ({ ...group, usage: await api(`/groups/${group.id}/storage`) })))); cursor = page.nextCursor; } while (cursor);
    setGroups(result); setCacheBytes(getCurrentVideoCacheSize());
    const folder = `${FS.documentDirectory}uploads/${currentSession()?.userId}/`, info = await FS.getInfoAsync(folder);
    if (info.exists) { const files = await FS.readDirectoryAsync(folder); const sizes = await Promise.all(files.map((name) => FS.getInfoAsync(folder+name))); setLocalBytes(sizes.reduce((n,i) => n + (i.exists && !i.isDirectory ? i.size : 0), 0)); }
  }); }, []);
  return <Screen title="저장 공간" subtitle="완료 원본과 진행 중 업로드 예약을 합쳐 모임당 5GB입니다.">
    <Card><H>이 기기</H><P>재생 캐시 {(cacheBytes/1000000).toFixed(1)}MB · 설정 한도 500MB</P><P>선택 후보·전송용 파일 {(localBytes/1000000).toFixed(1)}MB</P><P>캐시 정리는 선택 후보와 미완료 전송 원본을 삭제하지 않습니다.</P></Card>
    {groups.map((g) => <Card key={g.id}><H>{g.name}</H><P>완료 원본 {(g.usage.completedOriginalBytes/1000000000).toFixed(2)}GB</P><P>전송 예약 {(g.usage.reservedBytes/1000000000).toFixed(2)}GB · 남은 공간 {(g.usage.availableBytes/1000000000).toFixed(2)}GB</P></Card>)}
    <P>삭제·만료 파일의 용량은 서버 원본 정리가 끝난 뒤 반환됩니다. 보관 연장과 유료 확대는 제공하지 않습니다.</P>{a.errorView}
  </Screen>;
}
