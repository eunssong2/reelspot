import { installationId } from '../lib/device';
import React, { useState } from 'react';
import { useFocusLoad } from '../lib/effects';
import { Linking, Text } from 'react-native';
import { dialog } from '../components/confirm-host';
import { MenuRow } from '../components/profile-ui';
import { router } from 'expo-router';

import { clearVideoCacheAsync } from 'expo-video';
import { clearLocalAccount } from '../lib/uploads';
import { api, documentUrl, setSession } from '../lib/api';
import { POLICY_ROWS, findPolicyDoc } from '../lib/documents';
import { inviteCodeHint } from '../lib/invite-input';
import { useAccount } from '../lib/state';
import { Transfer } from '../../modules/atp-transfer';
import { Screen, Button, ClearableInput, Sheet, colors, useAction, resetTo, confirm } from '../components/ui';
const Section = ({ children }: { children: string }) => (
  <Text style={{ fontSize: 18, fontWeight: '800', color: colors.ink, marginTop: 28, marginBottom: 2 }}>
    {children}
  </Text>
);
export default function Settings() {
  const { session } = useAccount();
  const a = useAction();
  const [docs, setDocs] = useState<any[]>([]),
    [inviting, setInviting] = useState(false),
    [code, setCode] = useState('');
  useFocusLoad(() => {
    void a.run(async () => setDocs((await api('/consent-documents')).documents));
  }, []);
  const logout = () =>
    a.run(async () => {
      await api('/auth/logout', { deviceId: await installationId(), pendingAction: 'cancel' });
      if (session) {
        await Transfer?.clearAccount(session.userId);
        await clearVideoCacheAsync();
        await clearLocalAccount(session.userId);
      }
      await setSession(null);
      resetTo('/login');
    });
  return (
    <Screen title="설정">
      <MenuRow strong label="프로필 및 계정" onPress={() => router.push('/account')} />
      <Section>친구초대</Section>
      <MenuRow
        label="초대코드 입력"
        onPress={() => {
          setCode('');
          setInviting(true);
        }}
      />
      <Section>서비스 설정</Section>
      <MenuRow
        label="위치 서비스"
        value="기기 설정에서 변경"
        valueColor="#3182F6"
        onPress={() => a.run(() => Linking.openSettings())}
      />
      <Section>서비스 약관</Section>
      {POLICY_ROWS.map((row) => (
        <MenuRow
          key={row.key}
          label={row.label}
          onPress={() => {
            const d = findPolicyDoc(docs, row.key);
            if (d) void a.run(() => Linking.openURL(documentUrl(d.url)));
            else dialog({ title: row.label, body: '아직 게시되지 않은 문서예요.', buttons: [{ label: '확인', tone: 'plain' }] });
          }}
        />
      ))}
      <MenuRow
        strong
        chevron={false}
        label="로그아웃"
        onPress={() =>
          confirm('로그아웃할까요?', '미완료 업로드를 취소하고 이 기기의 로그인 정보를 삭제합니다.', () => void logout(), { confirm: '로그아웃', cancel: '취소' })
        }
      />
      <MenuRow strong chevron={false} label="서비스 탈퇴" onPress={() => router.push('/delete-account')} />
      <Section>내 기록과 알림</Section>
      <MenuRow label="내가 올린 기록" onPress={() => router.push('/mine')} />
      <MenuRow label="알림 · 신고·문의 결과" onPress={() => router.push('/notifications')} />
      <MenuRow label="처리 중인 요청" onPress={() => router.push('/operations')} />
      <MenuRow label="파일 전송 상태" onPress={() => router.push('/uploads')} />
      <MenuRow label="개인 차단 관리" onPress={() => router.push('/blocks')} />
      <MenuRow label="저장 공간과 캐시" onPress={() => router.push('/storage')} />
      <Section>고객센터</Section>
      <MenuRow label="문의하기" onPress={() => router.push('/inquiry')} />
      <MenuRow label="동의 내역" onPress={() => router.push('/consents')} />
      {a.errorView}
      <Sheet visible={inviting} title="초대코드 입력" onClose={() => setInviting(false)}>
        <ClearableInput
          accessibilityLabel="초대 코드"
          placeholder="친구에게 받은 코드를 입력하세요"
          limit={8}
          helper="영문 대문자와 숫자 8자리"
          autoCapitalize="characters"
          autoFocus
          value={code}
          onChangeText={(v) => setCode(/^[a-z][a-z0-9+.-]*:/i.test(v.trim()) ? v : v.toUpperCase())}
        />
        <Button
          tone="outline"
          disabled={!inviteCodeHint(code).valid || !code.trim()}
          onPress={() => {
            setInviting(false);
            router.push({ pathname: '/invite', params: { code: code.trim() } });
          }}
        >
          참여하기
        </Button>
      </Sheet>
    </Screen>
  );
}
