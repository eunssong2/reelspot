import { installationId } from '../lib/device';
import { useInitialize } from '../lib/effects';
import React, { useState } from 'react';
import { Image, Linking, Text, View } from 'react-native';
import { router } from 'expo-router';
import { signInWithProvider } from '../lib/social';
import * as WebBrowser from 'expo-web-browser';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api, documentUrl, setSession } from '../lib/api';
import { Screen, Field, Button, P, colors, useAction } from '../components/ui';
WebBrowser.maybeCompleteAuthSession();
export default function Login() {
  const [dev, setDev] = useState(false),
    [name, setName] = useState('demo'),
    [kakao, setKakao] = useState(false),
    [docs, setDocs] = useState<any[]>([]),
    [pending, setPending] = useState(false);
  const a = useAction();
  async function load() {
    const config = await api('/app-config');
    setDev(__DEV__ && config.authMode === 'development');
    setKakao(config.providers?.kakao === true);
    setPending(!!(await AsyncStorage.getItem('atp.pending-invite')));
    setDocs((await api('/consent-documents')).documents);
  }
  useInitialize(() => {
    void a.run(load);
  }, []);
  async function login(development = false) {
    await a.run(async () => {
      let r;
      if (development && __DEV__) {
        const credential = `dev:${name}`,
          attempt = await api('/auth/attempts', {
            provider: 'kakao',
            deviceId: await installationId(),
          });
        r = await api('/auth/exchange', { provider: 'kakao', credential, ...attempt });
        await SecureStore.setItemAsync('atp.dev-credential', credential);
        await setSession(r.session);
      } else r = await signInWithProvider('kakao');
      router.replace(
        r.onboardingRequired
          ? '/onboarding'
          : (await AsyncStorage.getItem('atp.pending-invite'))
            ? '/invite'
            : '/',
      );
    });
  }
  return (
    <Screen
      title=""
      compact
      back={false}
      footer={
        <>
          <Button tone="kakao" disabled={a.busy || !kakao} onPress={() => login()}>
            카카오로 시작하기
          </Button>
          {!kakao && !a.busy && <P>카카오 로그인 연결을 확인해 주세요.</P>}
          {docs.map((d) => (
            <Button
              key={d.id}
              secondary
              onPress={() => a.run(() => Linking.openURL(documentUrl(d.url)))}
            >
              {d.title || d.itemKey}
            </Button>
          ))}
        </>
      }
    >
      <View style={{ alignItems: 'center', paddingTop: 32, gap: 14 }}>
        <Image
          source={require('../../assets/logo.jpg')}
          style={{ width: 90, height: 90, borderRadius: 45 }}
          accessibilityLabel="At that place 로고"
        />
        <Text style={{ color: colors.accent, fontSize: 19, fontWeight: '800', letterSpacing: 3 }}>
          AT THAT PLACE
        </Text>
        <Text style={{ color: colors.muted, fontSize: 10, letterSpacing: 3 }}>
          SHARED MEMORY SPACE
        </Text>
        <Text
          style={{
            fontSize: 32,
            fontWeight: '800',
            textAlign: 'center',
            color: colors.ink,
            marginTop: 28,
          }}
        >
          함께한 순간을{'\n'}한곳에 모아요
        </Text>
        <P>모임의 일정별로 사진과 영상을 함께 보관해요.</P>
      </View>
      {pending && <P>초대받은 모임에 참여하려면 로그인해 주세요.</P>}
      <P>소셜 계정 식별정보로 계정을 연결합니다. 이용약관과 개인정보 처리 안내를 확인해 주세요.</P>
      {dev && (
        <>
          <Field label="테스트 사용자 식별자" value={name} onChangeText={setName} />
          <Button secondary disabled={a.busy} onPress={() => login(true)}>
            개발용 테스트 로그인
          </Button>
        </>
      )}
      {a.errorView}
    </Screen>
  );
}
