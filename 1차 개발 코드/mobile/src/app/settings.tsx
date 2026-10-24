import React, { useState } from 'react';
import { router } from 'expo-router';

import { inputText } from '../lib/validation';
import { clearVideoCacheAsync } from 'expo-video';
import { clearLocalAccount } from '../lib/uploads';
import * as FS from 'expo-file-system/legacy';
import { api, awaitOperation, setSession } from '../lib/api';
import { useAccount } from '../lib/state';
import { Transfer } from '../../modules/atp-transfer';
import { Screen, Field, Button, Card, useAction, confirm } from '../components/ui';
export default function Settings() {
  const { profile, session, refresh } = useAccount(),
    [name, setName] = useState(profile?.displayName ?? '');
  const a = useAction();
  return (
    <Screen title="나의 설정" subtitle={profile?.displayName}>
      <Card>
        <Field label="표시명" value={name} onChangeText={setName} />
        <Button
          onPress={() =>
            a.run(async () => {
              inputText(name, '표시명', 20);
              await awaitOperation(
                await api(
                  '/me/profile',
                  { displayName: name, expectedVersion: profile.version },
                  'PATCH',
                ),
              );
              await refresh();
            })
          }
        >
          표시명 저장
        </Button>
      </Card>
      <Button secondary onPress={() => router.push('/mine')}>
        내가 올린 기록
      </Button>
      <Button secondary onPress={() => router.push('/identities')}>
        로그인 수단 관리
      </Button>
      <Button secondary onPress={() => router.push('/consents')}>
        약관 · 개인정보 · 동의 내역
      </Button>
      <Button secondary onPress={() => router.push('/operations')}>처리 중·검토 중 요청</Button>
      <Button secondary onPress={() => router.push('/notifications')}>
        알림 · 신고·문의 결과
      </Button>
      <Button secondary onPress={() => router.push('/blocks')}>
        개인 차단 관리
      </Button>
      <Button secondary onPress={() => router.push('/storage')}>
        모임 저장 공간
      </Button>
      <Button secondary onPress={() => router.push('/uploads')}>
        미완료 업로드
      </Button>
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
              }),
          )
        }
      >
        재생 캐시 정리
      </Button>
      <Button secondary onPress={() => router.push('/inquiry')}>
        문의하기
      </Button>
      <Button
        secondary
        onPress={() =>
          confirm(
            '로그아웃할까요?',
            '미완료 업로드를 취소하고 이 기기의 로그인 정보를 삭제합니다.',
            () =>
              a.run(async () => {
                await api('/auth/logout', { deviceId: 'android-install', pendingAction: 'cancel' });
                if (session) { await Transfer?.clearAccount(session.userId); await clearVideoCacheAsync(); await clearLocalAccount(session.userId); }
                await setSession(null);
                router.replace('/login');
              }),
          )
        }
      >
        로그아웃
      </Button>
      <Button secondary onPress={() => router.push('/delete-account')}>
        계정 삭제
      </Button>
      {a.errorCode === 'VERSION_CONFLICT' && <Button secondary onPress={() => a.run(async () => { await refresh(); })}>최신 프로필 확인 · 입력 유지</Button>}
      {a.errorView}
    </Screen>
  );
}
