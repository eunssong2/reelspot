import { OnboardingScreen } from '@/prototype/screens/OnboardingScreen';
import { usePrototypeNav } from '@/prototype/state/PrototypeProvider';

export default function PrototypeOnboardingRoute() {
  return <OnboardingScreen nav={usePrototypeNav()} />;
}
