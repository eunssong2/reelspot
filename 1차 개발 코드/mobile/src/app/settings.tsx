import { installationId } from '../lib/device';
import React, { useState } from 'react';
import { useFocusLoad } from '../lib/effects';
import { Linking } from 'react-native';
import { MenuRow } from '../components/profile-ui';
import { router } from 'expo-router';

import { clearVideoCacheAsync } from 'expo-video';
import { clearLocalAccount } from '../lib/uploads';
import { api, documentUrl, setSession } from '../lib/api';
import { useAccount } from '../lib/state';
import { Transfer } from '../../modules/atp-transfer';
import { Screen, Button, H, useAction, confirm } from '../components/ui';
export default function Settings() {
  const { session } = useAccount();
  const a = useAction();
  const [docs, setDocs] = useState<any[]>([]);
  useFocusLoad(() => {
    void a.run(async () => setDocs((await api('/consent-documents')).documents));
  }, []);
  return (
    <Screen title="설정">
      <MenuRow label="프로필 및 계정" onPress={() => router.push('/account')} />
      <H>친구 초대</H>
      <MenuRow label="초대코드 입력" onPress={() => router.push('/invite')} />
      <H>서비스 설정</H>
      <MenuRow
        label="위치 서비스"
        value="기기 설정에서 변경"
        onPress={() => a.run(() => Linking.openSettings())}
      />
      <H>서비스 약관</H>
      {docs.map((d) => (
        <MenuRow
          key={d.id}
          label={d.kind === 'notice' ? '개인정보 처리방침' : '서비스 이용약관'}
          onPress={() => a.run(() => Linking.openURL(documentUrl(d.url)))}
        />
      ))}
      <MenuRow label="동의 내역" onPress={() => router.push('/consents')} />
      <H>내 기록과 알림</H>
      <MenuRow label="내가 올린 기록" onPress={() => router.push('/mine')} />
      <MenuRow label="알림 · 신고·문의 결과" onPress={() => router.push('/notifications')} />
      <MenuRow label="처리 중인 요청" onPress={() => router.push('/operations')} />
      <MenuRow label="파일 전송 상태" onPress={() => router.push('/uploads')} />
      <MenuRow label="개인 차단 관리" onPress={() => router.push('/blocks')} />
      <MenuRow label="저장 공간과 캐시" onPress={() => router.push('/storage')} />
      <H>고객센터</H>
      <MenuRow label="문의하기" onPress={() => router.push('/inquiry')} />
      <Button
        secondary
        onPress={() =>
          confirm(
            '로그아웃할까요?',
            '미완료 업로드를 취소하고 이 기기의 로그인 정보를 삭제합니다.',
            () =>
              a.run(async () => {
                await api('/auth/logout', {
                  deviceId: await installationId(),
                  pendingAction: 'cancel',
                });
                if (session) {
                  await Transfer?.clearAccount(session.userId);
                  await clearVideoCacheAsync();
                  await clearLocalAccount(session.userId);
                }
                await setSession(null);
                router.replace('/login');
              }),
          )
        }
      >
        로그아웃
      </Button>
      <MenuRow label="서비스 탈퇴" onPress={() => router.push('/delete-account')} />
      {a.errorView}
    </Screen>
  );
}
