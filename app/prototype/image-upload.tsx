import { useLocalSearchParams } from 'expo-router';

import { CUT_OPTIONS, TEMPLATE_BY_ID, templatesFor, type MediaKind } from '@/prototype/mock/tripData';
import { ImageUploadScreen } from '@/prototype/screens/ImageUploadScreen';
import { usePrototypeNav } from '@/prototype/state/PrototypeProvider';

export default function PrototypeImageUploadRoute() {
  const params = useLocalSearchParams<{ cuts?: string; templateId?: string; kind?: string }>();

  // URL 파라미터는 문자열이므로 검증해서 화면이 이해하는 값으로 바꾼다.
  const parsed = Number.parseInt(params.cuts ?? '', 10);
  const cuts = CUT_OPTIONS.includes(parsed) ? parsed : 3;
  const templateId = params.templateId && TEMPLATE_BY_ID[params.templateId] ? params.templateId : templatesFor(cuts)[0].id;
  const kind: MediaKind = params.kind === 'video' ? 'video' : 'photo';

  return <ImageUploadScreen key={`${cuts}-${kind}`} nav={usePrototypeNav()} cuts={cuts} templateId={templateId} kind={kind} />;
}
