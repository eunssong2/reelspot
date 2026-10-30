import { IS_DEMO_BUILD } from '@/demo/config';
import { DemoHome } from '@/demo/DemoHome';
import { GroupsScreen } from '@/prototype/screens/GroupsScreen';
import { LoginScreen } from '@/prototype/screens/LoginScreen';
import { SplashScreen } from '@/prototype/screens/SplashScreen';
import { useGroups } from '@/prototype/state/GroupsProvider';
import { usePrototypeNav } from '@/prototype/state/PrototypeProvider';

/**
 * 프로토타입 입구. 세션 복원 중이면 스플래시, 가입까지 마친 세션이 있으면 내 모임(UI03), 없으면 로그인(UI01).
 * (기존 모임 목록 MyTripsScreen 은 내 모임 화면으로 대체했다. 일정 요약(UI08) 이후 흐름은 그대로다.)
 */
export default function PrototypeEntryRoute() {
  const nav = usePrototypeNav();
  const { session, restoring } = useGroups();
  // 데모(테스트 APK)는 모임 목록 대신, 흰 화면에 일정 버튼만 있는 간단한 선택 화면으로 시작한다.
  if (IS_DEMO_BUILD) return <DemoHome />;
  if (restoring) return <SplashScreen />;
  return session?.onboarded ? <GroupsScreen nav={nav} /> : <LoginScreen nav={nav} />;
}
