import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, BackHandler, View } from 'react-native';

import { ConfirmDialog } from '../components/ConfirmDialog';
import { useToast } from '../components/Toast';
import type { Group } from '../mock/groupData';
import type { Nav } from '../navigation/routes';
import { useGroups } from '../state/GroupsProvider';
import { usePrototype } from '../state/PrototypeProvider';
import { DateStep, PlaceStep } from './DatePlaceSteps';
import { EditStep } from './EditStep';
import { MediaStep } from './MediaStep';
import { ComposeStep, GenerateStep, PreviewStep, ResultStep } from './OutputSteps';
import { LengthStep, TemplateStep, TrimStep } from './TemplateSteps';
import { selectedPlaces, type Cursor, type StepCtx } from './ctx';
import { buildTimeline, buildVlogDays, hasContent } from './model';
import { useVlog } from './VlogProvider';

interface Props {
  nav: Nav;
  group: Group;
}

/**
 * 브이로그 만들기(기획서 v4). 한 라우트 안에서 단계를 오가며 선택·편집 내용을 모임별 초안에 계속 저장한다.
 * 날짜 선택 → 날짜별 장소 → 장소별 사진·동영상 → 템플릿·순서·자막 → 전체 구성 → 미리보기 → 생성 → 저장.
 * 이전 단계로 돌아가거나 닫아도 작성 중인 내용을 잃지 않고, 원본 기록·일정 순서는 바꾸지 않는다.
 */
export function VlogFlowScreen({ nav, group }: Props) {
  const { schedulesOf } = useGroups();
  const { itineraries } = usePrototype();
  const vlog = useVlog();
  const toast = useToast();
  const [stack, setStack] = useState<Cursor[]>([{ step: 'dates' }]);
  // 작성 중인 초안이 있으면 처음 한 번 "이어서 / 새로" 를 묻는다.
  const [resume, setResume] = useState<'unknown' | 'ask' | 'done'>('unknown');

  const draft = vlog.draftOf(group.id);
  const days = useMemo(() => buildVlogDays(group, schedulesOf(group.id), itineraries), [group, schedulesOf, itineraries]);
  const timeline = useMemo(() => buildTimeline(draft, { days }), [draft, days]);

  useEffect(() => {
    if (!vlog.hydrated || resume !== 'unknown') return;
    setResume(hasContent(draft) ? 'ask' : 'done');
  }, [vlog.hydrated, resume, draft]);

  const cursor = stack[stack.length - 1];

  const back = useCallback(() => {
    if (stack.length > 1) setStack((s) => s.slice(0, -1));
    else nav.back();
  }, [stack.length, nav]);

  // 안드로이드 뒤로가기: 제작 화면을 닫지 않고 이전 단계로 돌아간다.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (stack.length > 1) {
        setStack((s) => s.slice(0, -1));
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [stack.length]);

  const goAddRecords = useCallback(() => {
    // 기록을 올릴 수 있는 장소 화면으로 보낸다(그 모임의 첫 일정 날짜).
    for (const sc of schedulesOf(group.id)) {
      const it = itineraries.find((x) => x.id === sc.itineraryId);
      if (it && it.days[0]) return nav.push({ name: 'itineraryDay', tripId: group.tripId, itineraryId: it.id, dayId: it.days[0].id, groupId: group.id });
    }
    nav.back();
  }, [schedulesOf, itineraries, group, nav]);

  const ctx: StepCtx = {
    group,
    days,
    draft,
    timeline,
    update: (fn) => vlog.update(group.id, fn),
    go: (c) => setStack((s) => [...s, c]),
    replace: (c) => setStack((s) => [...s.slice(0, -1), c]),
    back,
    close: nav.back,
    goAddRecords,
    toast: toast.show,
    toastMessage: toast.message,
  };

  if (!vlog.hydrated || resume === 'unknown') {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }

  /** 이어서 만들기: 마지막 작업에 가까운 단계로 들어간다. */
  const resumeAt = (): Cursor => {
    const places = selectedPlaces(draft, days);
    if (places.length === 0) return { step: draft.dayKeys.length > 0 ? 'places' : 'dates' };
    const undone = places.find((x) => !draft.settings[x.place.key]?.done);
    return undone ? { step: 'media', placeKey: undone.place.key } : { step: 'compose' };
  };

  let body;
  switch (cursor.step) {
    case 'dates':
      body = <DateStep ctx={ctx} />;
      break;
    case 'places':
      body = <PlaceStep ctx={ctx} />;
      break;
    case 'media':
      body = <MediaStep ctx={ctx} placeKey={cursor.placeKey} />;
      break;
    case 'template':
      body = <TemplateStep key={cursor.placeKey} ctx={ctx} placeKey={cursor.placeKey} />;
      break;
    case 'length':
      body = <LengthStep ctx={ctx} placeKey={cursor.placeKey} />;
      break;
    case 'trim':
      body = <TrimStep ctx={ctx} placeKey={cursor.placeKey} clipId={cursor.clipId} />;
      break;
    case 'edit':
      body = <EditStep key={cursor.placeKey} ctx={ctx} placeKey={cursor.placeKey} />;
      break;
    case 'compose':
      body = <ComposeStep ctx={ctx} />;
      break;
    case 'preview':
      body = <PreviewStep ctx={ctx} />;
      break;
    case 'generate':
      body = <GenerateStep ctx={ctx} />;
      break;
    case 'result':
      body = <ResultStep ctx={ctx} />;
      break;
  }

  return (
    <>
      {body}
      <ConfirmDialog
        visible={resume === 'ask'}
        title="작성 중인 브이로그가 있어요"
        body="이어서 만들거나 새로 시작할 수 있어요."
        onRequestClose={() => {
          setResume('done');
          nav.back();
        }}
        buttons={[
          {
            label: '이어서 만들기',
            onPress: () => {
              setResume('done');
              setStack([resumeAt()]);
            },
          },
          {
            label: '새로 만들기',
            tone: 'plain',
            onPress: () => {
              vlog.reset(group.id);
              setResume('done');
            },
          },
        ]}
      />
    </>
  );
}
