import React from 'react';
import { ActivityIndicator } from 'react-native';
import { Screen, P } from '../components/ui';
export default function OAuthCallback() {
  return (
    <Screen title="로그인 확인 중">
      <ActivityIndicator />
      <P>인증 결과를 확인하고 원래 화면으로 돌아갑니다.</P>
    </Screen>
  );
}
