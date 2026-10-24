import { IS_DEMO_BUILD } from '@/demo/config';
import { DemoHome } from '@/demo/DemoHome';
import { MyTripsScreen } from '@/prototype/screens/MyTripsScreen';
import { usePrototypeNav } from '@/prototype/state/PrototypeProvider';

export default function PrototypeTripsRoute() {
  const nav = usePrototypeNav();
  // 데모(테스트 APK)는 모임 목록 대신, 흰 화면에 일정 버튼만 있는 간단한 선택 화면으로 시작한다.
  if (IS_DEMO_BUILD) return <DemoHome />;
  return <MyTripsScreen nav={nav} />;
}
