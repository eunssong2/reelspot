import { useLocalSearchParams } from 'expo-router';

import { InviteJoinScreen } from '@/prototype/screens/InviteJoinScreen';
import { usePrototypeNav } from '@/prototype/state/PrototypeProvider';

export default function PrototypeInviteJoinRoute() {
  const { code } = useLocalSearchParams<{ code?: string }>();
  return <InviteJoinScreen nav={usePrototypeNav()} initialCode={code || undefined} />;
}
