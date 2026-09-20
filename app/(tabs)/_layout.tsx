import { Tabs } from 'expo-router';

import { colors, type } from '@/theme/theme';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        // 탭이 하나뿐인 동안은 막대를 숨긴다. 지도·영상 탭이 붙으면 되살린다.
        tabBarStyle: { display: 'none' },
        tabBarLabelStyle: type.caption,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
      }}
    >
      <Tabs.Screen name="index" options={{ title: '내 여행' }} />
    </Tabs>
  );
}
