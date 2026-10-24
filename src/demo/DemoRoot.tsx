import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { colors } from '@/prototype/styles/tokens';

/**
 * 데모(테스트 APK) 앱의 루트. 로그인·서버·실제 계정 흐름(AuthProvider 등)은 아예 올리지 않는다.
 * 기존 서비스 화면 경로는 Stack.Protected(guard=false)로 막아 두었고, 막힌 경로로 열리면 expo-router 가
 * 열 수 있는 첫 경로(/prototype)로 보낸다. /prototype 은 데모에서 곧바로 일정 요약으로 다시 보낸다
 * (app/prototype/index.tsx).
 */
export function DemoRoot() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
        <Stack.Screen name="prototype" />
        <Stack.Protected guard={false}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="trip/[id]" />
          <Stack.Screen name="trip/new" />
          <Stack.Screen name="trip/join" />
          <Stack.Screen name="mypage/edit" />
          <Stack.Screen name="mypage/members" />
        </Stack.Protected>
      </Stack>
    </SafeAreaProvider>
  );
}
