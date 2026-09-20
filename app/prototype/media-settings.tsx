import { useLocalSearchParams } from 'expo-router';

import { MediaSettingsScreen } from '@/prototype/screens/MediaSettingsScreen';
import { usePrototypeNav } from '@/prototype/state/PrototypeProvider';

export default function PrototypeMediaSettingsRoute() {
  const { placeName } = useLocalSearchParams<{ placeName?: string }>();
  return <MediaSettingsScreen nav={usePrototypeNav()} placeName={placeName || undefined} />;
}
