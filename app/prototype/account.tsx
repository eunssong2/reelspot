import { AccountScreen } from '@/prototype/screens/AccountScreen';
import { usePrototypeNav } from '@/prototype/state/PrototypeProvider';

export default function PrototypeAccountRoute() {
  return <AccountScreen nav={usePrototypeNav()} />;
}
