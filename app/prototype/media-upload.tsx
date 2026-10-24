import { useLocalSearchParams } from 'expo-router';

import type { ClipSeconds } from '@/prototype/mock/tripData';
import { MediaUploadScreen } from '@/prototype/screens/MediaUploadScreen';
import { usePrototypeNav } from '@/prototype/state/PrototypeProvider';

const VALID_CLIP_SECONDS: ClipSeconds[] = [5, 10, 15];

export default function PrototypeMediaUploadRoute() {
  const { placeName, clipSeconds } = useLocalSearchParams<{
    placeName?: string;
    clipSeconds?: string;
  }>();

  const parsed = Number.parseInt(clipSeconds ?? '', 10);
  const validClip = VALID_CLIP_SECONDS.find((seconds) => seconds === parsed);

  return (
    <MediaUploadScreen
      nav={usePrototypeNav()}
      placeName={placeName || undefined}
      clipSeconds={validClip}
    />
  );
}
