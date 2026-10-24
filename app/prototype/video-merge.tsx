import { VideoMergeScreen } from '@/prototype/screens/VideoMergeScreen';
import { usePrototypeNav } from '@/prototype/state/PrototypeProvider';

export default function PrototypeVideoMergeRoute() {
  return <VideoMergeScreen nav={usePrototypeNav()} />;
}
