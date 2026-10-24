import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { IS_DEMO_BUILD } from '@/demo/config';
import { DemoRoot } from '@/demo/DemoRoot';
import { AuthProvider, useAuth } from '@/features/auth/AuthProvider';
import { colors } from '@/theme/theme';

function RootNavigator() {
  const { session, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === '(auth)';
    // UI 프로토타입(/prototype)은 서버 데이터 없이 mock 으로만 도는 화면이라 로그인 없이 연다.
    // 데모 세션은 메모리에만 있어서, 이걸 막으면 주소 직접 입력·새로고침 때마다 로그인으로 튕긴다.
    const inPrototype = segments[0] === 'prototype';
    if (!session && !inAuthGroup && !inPrototype) {
      router.replace('/(auth)/login');
    } else if (session && inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [session, loading, segments, router]);

  if (loading) {
    return (
      <View style={styles.splash}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.bg },
      }}
    />
  );
}

export default function RootLayout() {
  // 데모(테스트 APK): 로그인·서버 없이 내 담당 화면만 연다. 일반 빌드는 아래 기존 흐름 그대로다.
  if (IS_DEMO_BUILD) return <DemoRoot />;

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <AuthProvider>
        <RootNavigator />
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  splash: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
});
