import { MyPageScreen } from '@/prototype/screens/MyPageScreen';
import { usePrototypeNav } from '@/prototype/state/PrototypeProvider';

export default function PrototypeMyPageRoute() {
  return <MyPageScreen nav={usePrototypeNav()} />;
}
