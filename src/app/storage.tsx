import React, { useState } from 'react';
import { LegacyDraftLink } from '../components/legacy-draft-link';
import { useFocusLoad } from '../lib/effects';
import { api, currentSession } from '../lib/api';
import { formatBytes } from '../lib/preferences';
import * as FS from 'expo-file-system/legacy';
import { getCurrentVideoCacheSize, clearVideoCacheAsync } from 'expo-video';
import { Screen, Card, H, P, Button, Info, confirm, useAction } from '../components/ui';
export default function Storage() {
  const [groups, setGroups] = useState<any[]>([]),
    [localBytes, setLocalBytes] = useState(0),
    [cacheBytes, setCacheBytes] = useState(0);
  const a = useAction();
  useFocusLoad(() => {
    a.run(async () => {
      const result = [];
      let cursor: string | null = null;
      do {
        const page: any = await api(
          `/groups${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`,
        );
        result.push(
          ...(await Promise.all(
            page.items.map(async (group: any) => ({
              ...group,
              usage: await api(`/groups/${group.id}/storage`),
            })),
          )),
        );
        cursor = page.nextCursor;
      } while (cursor);
      setGroups(result);
      setCacheBytes(getCurrentVideoCacheSize());
      const folder = `${FS.documentDirectory}uploads/${currentSession()?.userId}/`,
        info = await FS.getInfoAsync(folder);
      if (info.exists) {
        const files = await FS.readDirectoryAsync(folder);
        const sizes = await Promise.all(files.map((name) => FS.getInfoAsync(folder + name)));
        setLocalBytes(sizes.reduce((n, i) => n + (i.exists && !i.isDirectory ? i.size : 0), 0));
      }
    });
  }, []);
  return (
    <Screen
      title="저장 공간과 캐시"
      subtitle="완료 원본과 진행 중 업로드 예약을 합쳐 모임당 5GB입니다."
    >
      <Card>
        <H>이 기기</H>
        <P>재생 캐시 {formatBytes(cacheBytes)} · 설정 한도 500MB</P>
        <P>선택 후보·전송용 파일 {formatBytes(localBytes)}</P>
        <P>캐시 정리는 선택 후보와 미완료 전송 원본을 삭제하지 않습니다.</P>
        <LegacyDraftLink />
      </Card>
      {groups.map((g) => (
        <Card key={g.id}>
          <H>{g.name}</H>
          <P>완료 원본 {formatBytes(g.usage.completedOriginalBytes)}</P>
          <P>
            전송 예약 {formatBytes(g.usage.reservedBytes)} · 남은 공간{' '}
            {formatBytes(g.usage.availableBytes)}
          </P>
        </Card>
      ))}
      <Button
        secondary
        onPress={() =>
          confirm(
            '재생 캐시를 정리할까요?',
            '미완료 업로드 파일과 기기 앨범 원본은 유지됩니다.',
            () =>
              a.run(async () => {
                await clearVideoCacheAsync();
                await FS.deleteAsync(`${FS.cacheDirectory}atp-playback`, { idempotent: true });
                setCacheBytes(getCurrentVideoCacheSize());
              }),
          )
        }
      >
        재생 캐시 정리
      </Button>
      <Info>미완료 업로드 파일은 전송 완료까지 별도로 보관해요.</Info>
      <P>
        삭제·만료 파일의 용량은 서버 원본 정리가 끝난 뒤 반환됩니다. 보관 연장과 유료 확대는
        제공하지 않습니다.
      </P>
      {a.errorView}
    </Screen>
  );
}
