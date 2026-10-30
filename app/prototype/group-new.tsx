import { GroupCreateScreen } from '@/prototype/screens/GroupCreateScreen';
import { usePrototypeNav } from '@/prototype/state/PrototypeProvider';

export default function PrototypeGroupCreateRoute() {
  return <GroupCreateScreen nav={usePrototypeNav()} />;
}
