import { MyTripsScreen } from '@/prototype/screens/MyTripsScreen';
import { usePrototypeNav } from '@/prototype/state/PrototypeProvider';

export default function PrototypeTripsRoute() {
  return <MyTripsScreen nav={usePrototypeNav()} />;
}
