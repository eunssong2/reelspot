import { SettingsScreen } from '@/prototype/screens/SettingsScreen';
import { usePrototypeNav } from '@/prototype/state/PrototypeProvider';

export default function PrototypeSettingsRoute() {
  return <SettingsScreen nav={usePrototypeNav()} />;
}
