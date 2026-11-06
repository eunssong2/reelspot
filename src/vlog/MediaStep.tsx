import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { MediaViewerModal, type ViewerTarget } from './ui/MediaViewerModal';
import { SafeImage } from './ui/SafeImage';
import { colors, GUTTER, radius } from './tokens';
import { shortDotDateLabel } from './date';
import { locate, selectedPlaces, type StepCtx } from './ctx';
import {
  MAX_ITEMS,
  aspectOf,
  MAX_ITEMS_PER_PLACE,
  defaultSetting,
  resolveMedia,
  splitTemplatesFor,
  type VlogMedia,
} from './model';
import { cropMedia } from './edits';
import { CropModal } from './CropModal';
import { FooterButtons, Heading, StateCard, StepFrame } from './parts';

/** 3단계: 장소마다 사진·동영상을 고른다. 선택한 순서가 재생 순서이며 숫자로 보여 준다. */
export function MediaStep({ ctx, placeKey }: { ctx: StepCtx; placeKey?: string }) {
  const { days, draft, update } = ctx;
  const { width } = useWindowDimensions();
  const [newestFirst, setNewestFirst] = useState(false);
  const [viewer, setViewer] = useState<ViewerTarget | null>(null);
  // 크게 보기에서 "자르기"를 눌러 연 사진·동영상
  const [cropFor, setCropFor] = useState<VlogMedia | null>(null);
  const found = locate(days, placeKey);
  const places = selectedPlaces(draft, days);
  const placeMedia = found?.place.media ?? [];

  // 정렬만 바꿔 보여 줄 뿐 선택 순서(재생 순서)는 바꾸지 않는다.
  const ordered: VlogMedia[] = [...placeMedia].sort((a, b) => (newestFirst ? -1 : 1) * a.time.localeCompare(b.time));

  if (!found) {
    return (
      <StepFrame title="사진·동영상 선택" step={3} stepLabel="미디어" onBack={ctx.back} onClose={ctx.close}>
        <StateCard title="장소를 찾을 수 없어요" body="선택한 장소가 일정에서 빠졌어요. 장소를 다시 골라 주세요." />
      </StepFrame>
    );
  }

  const { day, place } = found;
  const selectedIds = draft.mediaIds[place.key] ?? [];
  const { media: selected, missing } = resolveMedia(draft, place);
  const total = timelineCount(ctx);


  /** 선택이 바뀌면 "이 장소 완료"를 풀고, 개수가 달라지면 템플릿을 다시 고르게 한다(소재·순서는 유지). */
  const setSelection = (ids: string[]) =>
    update((d) => {
      const prev = d.settings[place.key] ?? defaultSetting();
      const sameCount = (d.mediaIds[place.key] ?? []).length === ids.length;
      return {
        ...d,
        mediaIds: { ...d.mediaIds, [place.key]: ids },
        settings: {
          ...d.settings,
          [place.key]: {
            ...prev,
            done: false,
            ...(sameCount ? {} : { mode: 'sequence' as const, templateId: undefined, lengthSec: undefined, photoSec: undefined }),
          },
        },
      };
    });

  const toggle = (id: string) => {
    if (selectedIds.includes(id)) return setSelection(selectedIds.filter((x) => x !== id));
    if (selectedIds.length >= MAX_ITEMS_PER_PLACE) return ctx.toast(`한 장소에서는 ${MAX_ITEMS_PER_PLACE}개까지 고를 수 있어요`);
    if (total >= MAX_ITEMS) return ctx.toast(`브이로그에는 기록을 ${MAX_ITEMS}개까지 담을 수 있어요`);
    setSelection([...selectedIds, id]);
  };

  const allOn = place.media.length > 0 && place.media.every((m) => selectedIds.includes(m.item.id));
  const toggleAll = () => {
    if (allOn) return setSelection([]);
    const room = Math.min(MAX_ITEMS_PER_PLACE, MAX_ITEMS - (total - selected.length));
    const next = [...selectedIds.filter((id) => place.media.some((m) => m.item.id === id))];
    for (const m of ordered) if (!next.includes(m.item.id) && next.length < room) next.push(m.item.id);
    if (next.length < place.media.length) ctx.toast(`${next.length}개까지만 담았어요 (한도 ${room}개)`);
    setSelection(next);
  };

  const n = selected.length;
  const photos = selected.filter((m) => m.item.kind === 'photo').length;
  const tile = Math.floor((Math.min(width, 430) - GUTTER * 2 - 16) / 3);

  const next = () => {
    if (n === 0) return ctx.toast('이 장소에서 기록을 한 개 이상 골라 주세요');
    const hasSplit = splitTemplatesFor(n).length > 0;
    ctx.go({ step: hasSplit ? 'template' : 'edit', placeKey: place.key });
  };

  return (
    <StepFrame
      title="사진·동영상 선택"
      step={3}
      stepLabel="미디어"
      context={`${shortDotDateLabel(day.date)} · ${place.place.name}`}
      onBack={ctx.back}
      onClose={ctx.close}
      toast={ctx.toastMessage}
      footer={
        <View style={styles.footerGap}>
          <Text style={styles.summary}>
            {n > 0 ? `사진 ${photos} · 동영상 ${n - photos} 선택` : '사진이나 동영상을 골라 주세요'}
          </Text>
          <FooterButtons label={n > 0 ? `${n}개로 템플릿 선택` : '기록을 선택해 주세요'} disabled={n === 0} onPress={next} />
        </View>
      }
    >
      {/* 장소 바꾸기: 날짜·장소를 바꿔도 각 장소의 선택은 유지된다. */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {places.map((p) => {
          const count = resolveMedia(draft, p.place).media.length;
          const on = p.place.key === place.key;
          return (
            <Pressable
              key={p.place.key}
              onPress={() => ctx.replace({ step: 'media', placeKey: p.place.key })}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              style={[styles.chip, on && styles.chipOn]}
            >
              <Text style={[styles.chipText, on && styles.chipTextOn]}>
                {p.place.place.name} {count}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={styles.listHead}>
        <Text style={styles.listTitle}>전체 {place.media.length}개</Text>
        <View style={styles.listTools}>
          <Pressable onPress={() => setNewestFirst((v) => !v)} accessibilityRole="button" style={styles.toolButton}>
            <Text style={styles.tool}>{newestFirst ? '최신순' : '오래된순'}</Text>
          </Pressable>
          <Text style={styles.tool}> · </Text>
          <Pressable onPress={toggleAll} accessibilityRole="button" style={styles.toolButton}>
            <Text style={styles.tool}>{allOn ? '전체 해제' : '전체 선택'}</Text>
          </Pressable>
        </View>
      </View>

      {missing > 0 ? (
        <Pressable onPress={() => setSelection(selected.map((m) => m.item.id))} accessibilityRole="button" style={styles.warn}>
          <Text style={styles.warnText}>삭제된 기록 {missing}개가 빠졌어요. 이 장소에서 다른 기록으로 바꿔 주세요 · 확인</Text>
        </Pressable>
      ) : null}

      <View style={styles.grid}>
        {ordered.map((m) => {
          const idx = selectedIds.indexOf(m.item.id);
          const on = idx >= 0;
          const openViewer = () =>
            setViewer({ item: m.item, author: m.authorName ?? '참여자', time: m.time });
          return (
            <View key={m.item.id} style={{ width: tile, height: tile }}>
            <Pressable
              onPress={() => toggle(m.item.id)}
              // 길게 눌러도 원본을 크게 볼 수 있다(눈에 보이는 "크게 보기" 버튼이 따로 있다).
              onLongPress={openViewer}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on }}
              accessibilityLabel={`${m.item.kind === 'video' ? '동영상' : '사진'} ${on ? `${idx + 1}번째로 선택됨` : '선택 안 됨'}`}
              style={[{ width: tile, height: tile }, styles.tile, on && styles.tileOn]}
            >
              <SafeImage source={m.item.imageUrl} style={StyleSheet.absoluteFill} compact />
              {m.item.kind === 'video' ? <Text style={styles.videoBadge}>▶ {m.item.durationLabel ?? ''}</Text> : null}
              {on ? (
                <View style={styles.order}>
                  <Text style={styles.orderText}>{idx + 1}</Text>
                </View>
              ) : null}
            </Pressable>
            {/* 선택과 겹치지 않도록 타일 바깥에 형제로 둔다(버튼 안에 버튼을 넣지 않는다). */}
            <Pressable
              onPress={openViewer}
              accessibilityRole="button"
              accessibilityLabel={`${m.item.kind === 'video' ? '동영상' : '사진'} 크게 보기`}
              hitSlop={4}
              style={styles.zoom}
            >
              <Text style={styles.zoomText}>⤢</Text>
            </Pressable>
            </View>
          );
        })}
      </View>
      <Text style={styles.hint}>⤢ 버튼을 누르면 원본을 크게 보고 자를 수 있어요. 길게 눌러도 열려요.</Text>

      <Heading title="선택한 순서" />
      {n === 0 ? (
        <Text style={styles.hint}>아직 고른 기록이 없어요.</Text>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip}>
          {selected.map((m, i) => (
            <Pressable
              key={m.item.id}
              onPress={() => toggle(m.item.id)}
              accessibilityRole="button"
              accessibilityLabel={`${i + 1}번째 기록 빼기`}
              style={styles.stripItem}
            >
              <SafeImage source={m.item.imageUrl} style={StyleSheet.absoluteFill} compact />
            </Pressable>
          ))}
        </ScrollView>
      )}

      <MediaViewerModal
        target={viewer}
        onClose={() => setViewer(null)}
        action={{
          label: '✂ 자르기',
          onPress: () => {
            const m = place.media.find((x) => x.item.id === viewer?.item.id);
            setViewer(null);
            if (m) setCropFor(m);
          },
        }}
      />
      <CropModal
        visible={cropFor !== null}
        clip={cropFor ? { itemId: cropFor.item.id, kind: cropFor.item.kind, image: cropFor.item.imageUrl } : null}
        aspect={aspectOf(draft.aspect).id}
        crop={cropFor ? draft.settings[place.key]?.frames?.[cropFor.item.id]?.crop : undefined}
        onClose={() => setCropFor(null)}
        onApply={(crop) => {
          const id = cropFor?.item.id;
          setCropFor(null);
          if (!id) return;
          update((d) => cropMedia(d, place.key, id, crop));
          ctx.toast(crop ? '자른 영역을 적용했어요' : '자르지 않은 원본 전체로 돌아갔어요');
        }}
      />
    </StepFrame>
  );
}

/** 프로젝트 전체에서 지금 담긴 기록 수(한도 확인용) */
function timelineCount(ctx: StepCtx): number {
  return selectedPlaces(ctx.draft, ctx.days).reduce((sum, { place }) => sum + resolveMedia(ctx.draft, place).media.length, 0);
}

const styles = StyleSheet.create({
  footerGap: { gap: 10 },
  summary: { fontSize: 12, color: colors.textSub },
  chips: { gap: 8, paddingRight: GUTTER },
  chip: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 14, borderRadius: radius.pill, backgroundColor: colors.surface },
  chipOn: { backgroundColor: colors.primarySoft },
  chipText: { fontSize: 13, fontWeight: '700', color: colors.textSub },
  chipTextOn: { color: colors.primary },
  listHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  listTitle: { fontSize: 15, fontWeight: '800', color: colors.text },
  listTools: { flexDirection: 'row', alignItems: 'center' },
  toolButton: { minWidth: 48, minHeight: 48, justifyContent: 'center', alignItems: 'center' },
  tool: { fontSize: 12, fontWeight: '600', color: colors.textSub },
  warn: { backgroundColor: '#FDE7E9', borderRadius: 12, padding: 12 },
  warnText: { fontSize: 13, fontWeight: '700', color: colors.danger },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tile: { borderRadius: 10, overflow: 'hidden', backgroundColor: colors.surface, borderWidth: 2, borderColor: 'transparent' },
  tileOn: { borderColor: colors.primary },
  videoBadge: { position: 'absolute', left: 5, bottom: 5, fontSize: 10, fontWeight: '700', color: colors.onPrimary, backgroundColor: 'rgba(25,31,40,0.6)', paddingHorizontal: 5, paddingVertical: 1, borderRadius: 6, overflow: 'hidden' },
  zoom: { position: 'absolute', right: 5, bottom: 5, width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(25,31,40,0.6)', alignItems: 'center', justifyContent: 'center' },
  zoomText: { fontSize: 16, color: colors.onPrimary, fontWeight: '800', marginTop: -1 },
  order: { position: 'absolute', right: 5, top: 5, width: 22, height: 22, borderRadius: 11, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  orderText: { fontSize: 12, fontWeight: '800', color: colors.onPrimary },
  hint: { fontSize: 12, color: colors.textMuted },
  strip: { gap: 8 },
  stripItem: { width: 52, height: 52, borderRadius: 8, overflow: 'hidden', backgroundColor: colors.surface },
});
