import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ActivityIndicator, BackHandler, View } from 'react-native';
import { RecoveryNotice, StepNoticeContext } from './parts';

import { ConfirmDialog } from './ui/ConfirmDialog';
import { useToast } from './ui/Toast';
import type { Group } from './types';
import type { VlogDay } from './model';
import { DateStep, PlaceStep } from './DatePlaceSteps';
import { EditStep } from './EditStep';
import { MediaStep } from './MediaStep';
import { ComposeStep, GenerateStep, PreviewStep, ResultStep } from './OutputSteps';
import { LengthStep, TemplateStep, TrimStep } from './TemplateSteps';
import { selectedPlaces, type Cursor, type StepCtx } from './ctx';
import { buildTimeline, hasContent, placesWithMedia, resolveMedia } from './model';
import { useVlog } from './VlogProvider';

interface Props {
  nav: { back: () => void };
  days: VlogDay[];
  revalidate: () => Promise<void>;
  group: Group;
  notice?: ReactNode;
}

/**
 * 브이로그 만들기(기획서 v4). 한 라우트 안에서 단계를 오가며 선택·편집 내용을 모임별 초안에 계속 저장한다.
 * 날짜 선택 → 날짜별 장소 → 장소별 사진·동영상 → 템플릿·순서·자막 → 전체 구성 → 미리보기 → 생성 → 저장.
 * 이전 단계로 돌아가거나 닫아도 작성 중인 내용을 잃지 않고, 원본 기록·일정 순서는 바꾸지 않는다.
 */
export function VlogFlowScreen({ nav, group, days, revalidate, notice }: Props) {
  const vlog = useVlog();
  const toast = useToast();
  const [stack, setStack] = useState<Cursor[]>([{ step: 'dates' }]);
  // 작성 중인 초안이 있으면 처음 한 번 "이어서 / 새로" 를 묻는다.
  const [resume, setResume] = useState<'ask' | 'done'>(() => hasContent(vlog.draftOf(group.id)) ? 'ask' : 'done');

  const draft = vlog.draftOf(group.id);
  const timeline = useMemo(() => buildTimeline(draft, { days }), [draft, days]);


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

  const goAddRecords = nav.back;

  const ctx: StepCtx = {
    group,
    days,
    revalidate,
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

  if (!vlog.hydrated) {
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

  const missingDay = draft.dayKeys.some((key) => !days.some((d) => d.key === key));
  const missingPlace = days.some((day) => draft.dayKeys.includes(day.key) && (draft.placeKeys[day.key] ?? []).some((key) => !placesWithMedia(day).some((p) => p.key === key)));
  const missingMedia = selectedPlaces(draft, days).filter(({ place }) => resolveMedia(draft, place).missing > 0);
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
      <StepNoticeContext.Provider value={<>
      {notice}
      {missingDay && cursor.step !== 'dates' && <RecoveryNotice message="선택한 날짜에 접근할 수 없어요. 다른 편집은 보존됩니다." label="날짜 다시 선택" onPress={() => setStack([{ step: 'dates' }])} />}
      {!missingDay && missingPlace && cursor.step !== 'places' && <RecoveryNotice message="사용할 수 없는 장소가 선택되어 있어요." label="장소 다시 선택" onPress={() => setStack([{ step: 'places' }])} />}
      {!missingDay && !missingPlace && missingMedia.map(({ place }) =>
        cursor.step === 'media' && cursor.placeKey === place.key ? null : <RecoveryNotice key={place.key}
          message={`${place.place.name}에 삭제·만료된 선택 기록이 있어요. 다른 편집은 보존됩니다.`}
          label={`${place.place.name} 기록 다시 선택`} onPress={() => setStack((s) => [...s, { step: 'media', placeKey: place.key }])} />)}
      </>}>
      {body}
      </StepNoticeContext.Provider>
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
