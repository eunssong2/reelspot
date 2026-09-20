import { Stack } from 'expo-router';

import { colors } from '@/prototype/styles/tokens';
import { PhoneFrame } from '@/prototype/components/ScreenFrame';
import { PrototypeProvider } from '@/prototype/state/PrototypeProvider';

/**
 * UI 프로토타입 흐름(/prototype).
 * 내 모임 → 여행 일정 → 여행 장소 검색 → 사진·동영상 설정 → 이미지 업로드
 * 팀 화면·테마와 분리된 mock 화면이며, 자체 하늘색 디자인(src/prototype/styles)을 쓴다.
 */
export default function PrototypeLayout() {
  return (
    <PrototypeProvider>
      <PhoneFrame>
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }} />
      </PhoneFrame>
    </PrototypeProvider>
  );
}
