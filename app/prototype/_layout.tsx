import { Stack } from 'expo-router';

import { IS_DEMO_BUILD } from '@/demo/config';
import { ScenarioPanel } from '@/prototype/components/ScenarioPanel';
import { PhoneFrame } from '@/prototype/components/ScreenFrame';
import { GroupsProvider } from '@/prototype/state/GroupsProvider';
import { PrototypeProvider } from '@/prototype/state/PrototypeProvider';
import { colors } from '@/prototype/styles/tokens';

/**
 * UI 프로토타입 흐름(/prototype).
 * 로그인 → 가입 → 내 모임 → 모임 달력 → (일정 추가·변경 | 초대) → 일정 요약 → (여행 장소 검색 | 장소 기록) → 사진·동영상 올리기
 * 팀 화면·테마와 분리된 mock 화면이며, 자체 하늘색 디자인(src/prototype/styles)을 쓴다.
 */
export default function PrototypeLayout() {
  return (
    <PrototypeProvider>
      <GroupsProvider>
        <PhoneFrame>
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }} />
          {/* 오류·로딩 상태를 띄워 보는 프로토타입 전용 도구(테스트 APK 에는 넣지 않는다) */}
          {IS_DEMO_BUILD ? null : <ScenarioPanel />}
        </PhoneFrame>
      </GroupsProvider>
    </PrototypeProvider>
  );
}
