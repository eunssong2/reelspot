import { MyCalendarScreen } from '@/prototype/screens/MyCalendarScreen';
import { usePrototypeNav } from '@/prototype/state/PrototypeProvider';

export default function PrototypeMyCalendarRoute() {
  const nav = usePrototypeNav();
  return <MyCalendarScreen nav={nav} />;
}
