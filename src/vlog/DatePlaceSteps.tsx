import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ConfirmDialog } from './ui/ConfirmDialog';
import { ActionButton, CheckCircle } from './ui/FormParts';
import { colors, radius } from './tokens';
import { dayOfWeekLabel, monthDayLabel, shortDotDateLabel } from './date';
import { selectedPlaces, type StepCtx } from './ctx';
import { insertInOrder, placesWithMedia, type VlogDay } from './model';
import { AspectPicker, FooterButtons, Heading, StateCard, StepFrame } from './parts';

const dateLabel = (iso: string) => `${monthDayLabel(iso)} ${dayOfWeekLabel(iso)}요일`;
const countLabel = (photos: number, videos: number) => [photos ? `사진 ${photos}` : '', videos ? `동영상 ${videos}` : ''].filter(Boolean).join(' · ');

/** 1단계: 영상으로 남길 날짜를 하나 또는 여러 개 고른다. */
export function DateStep({ ctx }: { ctx: StepCtx }) {
  const { days, draft, update } = ctx;
  const [confirmRemove, setConfirmRemove] = useState<VlogDay | null>(null);
  const missing = draft.dayKeys.filter((key) => !days.some((d) => d.key === key));
  const hasAnyMedia = days.some((d) => d.mediaCount > 0);

  const toggle = (day: VlogDay) => {
    if (day.mediaCount === 0 && !draft.dayKeys.includes(day.key)) return;
    if (draft.dayKeys.includes(day.key)) {
      // 이미 편집을 마친 장소가 있는 날짜를 뺄 때만 확인한다.
      const edited = (draft.placeKeys[day.key] ?? []).some((k) => draft.settings[k]?.done);
      if (edited) setConfirmRemove(day);
      else remove(day);
      return;
    }
    const order = [...days].sort((a, b) => a.date.localeCompare(b.date) || a.key.localeCompare(b.key)).map((d) => d.key);
    update((d) => ({
      ...d,
      dayKeys: insertInOrder(d.dayKeys, day.key, order),
      // 전에 골라 둔 장소가 있으면 그대로 되살리고, 처음이면 기록이 있는 장소를 모두 담는다.
      placeKeys: { ...d.placeKeys, [day.key]: d.placeKeys[day.key] ?? placesWithMedia(day).map((p) => p.key) },
    }));
  };
  const remove = (day: VlogDay) => update((d) => ({ ...d, dayKeys: d.dayKeys.filter((k) => k !== day.key) }));

  const picked = days.filter((d) => draft.dayKeys.includes(d.key)).sort((a, b) => a.date.localeCompare(b.date));
  const n = picked.length;

  return (
    <StepFrame
      title="날짜 선택"
      step={1}
      stepLabel="날짜"
      onBack={ctx.back}
      onClose={ctx.close}
      toast={ctx.toastMessage}
      footer={
        <View style={styles.footerGap}>
          {n > 0 ? <Text style={styles.summary}>선택한 날짜 {n}일 · {picked.map((d) => shortDotDateLabel(d.date)).join(' / ')}</Text> : null}
          <FooterButtons
            label={n > 0 ? `${n}일의 장소 선택` : '날짜를 선택해 주세요'}
            disabled={n === 0 || missing.length > 0}
            onPress={() => ctx.go({ step: 'places' })}
          />
        </View>
      }
    >
      <Heading title="어느 날을 담을까요?" sub={ctx.group.name} />
      {missing.map((key) => <StateCard key={key} title={`사용할 수 없는 날짜 · ${key.split('/').at(-1)}`} body="이동·삭제·만료된 날짜입니다. 이 날짜만 제외하고 나머지 편집을 이어갈 수 있어요." actions={<ActionButton label="이 날짜 제외" onPress={() => update((d) => ({ ...d, dayKeys: d.dayKeys.filter((x) => x !== key) }))} />} />)}
      {!hasAnyMedia ? (
        <StateCard
          title="아직 담을 기록이 없어요"
          body="장소에 사진이나 동영상을 올리면 브이로그를 만들 수 있어요."
          actions={<ActionButton label="장소 기록 보러 가기" onPress={ctx.goAddRecords} />}
        />
      ) : (
        days.map((day) => {
          const on = draft.dayKeys.includes(day.key);
          const empty = day.mediaCount === 0;
          const placeCount = placesWithMedia(day).length;
          return (
            <Pressable
              key={day.key}
              onPress={() => toggle(day)}
              disabled={empty && !on}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on, disabled: empty && !on }}
              accessibilityLabel={`${dateLabel(day.date)} ${day.title} ${empty ? '기록 없음' : `장소 ${placeCount}곳`}`}
              style={[styles.row, on && styles.rowOn, empty && styles.rowOff]}
            >
              <View style={styles.rowBody}>
                <Text style={[styles.rowTitle, empty && styles.muted]}>{dateLabel(day.date)}</Text>
                <Text style={styles.rowSub} numberOfLines={1}>
                  {day.title} · {empty ? '기록 없음' : `장소 ${placeCount}곳`}
                  {day.cancelled && !empty ? ' · 취소된 일정' : ''}
                </Text>
              </View>
              {empty ? <Text style={styles.dash}>—</Text> : <CheckCircle checked={on} />}
            </Pressable>
          );
        })
      )}

      <ConfirmDialog
        visible={confirmRemove !== null}
        title="이 날짜를 제외할까요?"
        subtitle={confirmRemove ? dateLabel(confirmRemove.date) : undefined}
        body="편집한 내용은 남아 있어서 다시 선택하면 그대로 이어집니다."
        onRequestClose={() => setConfirmRemove(null)}
        buttons={[
          {
            label: '제외하기',
            tone: 'danger',
            onPress: () => {
              if (confirmRemove) remove(confirmRemove);
              setConfirmRemove(null);
            },
          },
          { label: '계속 담기', tone: 'plain', onPress: () => setConfirmRemove(null) },
        ]}
      />
    </StepFrame>
  );
}

/** 2단계: 날짜별로 담을 장소를 고른다(날짜마다 최소 1곳). */
export function PlaceStep({ ctx }: { ctx: StepCtx }) {
  const { days, draft, update } = ctx;
  const [confirmDrop, setConfirmDrop] = useState<VlogDay[] | null>(null);
  const picked = draft.dayKeys.map((k) => days.find((d) => d.key === k)).filter((d): d is VlogDay => Boolean(d));

  const toggle = (day: VlogDay, key: string) => {
    const order = placesWithMedia(day).map((p) => p.key);
    update((d) => {
      const cur = d.placeKeys[day.key] ?? [];
      const next = cur.includes(key) ? cur.filter((k) => k !== key) : insertInOrder(cur, key, order);
      return { ...d, placeKeys: { ...d.placeKeys, [day.key]: next } };
    });
  };
  const toggleAll = (day: VlogDay) => {
    const all = placesWithMedia(day).map((p) => p.key);
    update((d) => {
      const cur = d.placeKeys[day.key] ?? [];
      return { ...d, placeKeys: { ...d.placeKeys, [day.key]: cur.length === all.length ? [] : all } };
    });
  };

  const missingPlaces = picked.flatMap((day) => (draft.placeKeys[day.key] ?? []).filter((key) => !placesWithMedia(day).some((p) => p.key === key)).map((key) => ({ dayKey: day.key, key })));
  const placeTotal = picked.reduce((sum, d) => sum + (draft.placeKeys[d.key] ?? []).length, 0);
  const empties = picked.filter((d) => (draft.placeKeys[d.key] ?? []).length === 0);

  const dropAndGo = (drop: VlogDay[]) => {
    const keep = draft.dayKeys.filter((k) => !drop.some((d) => d.key === k));
    update((d) => ({ ...d, dayKeys: keep }));
    const first = selectedPlaces({ ...draft, dayKeys: keep }, days)[0];
    if (first) ctx.go({ step: 'media', placeKey: first.place.key });
    else ctx.toast('담을 장소를 한 곳 이상 골라 주세요');
  };

  const next = () => {
    if (missingPlaces.length) return ctx.toast('사용할 수 없는 장소를 선택에서 제외해 주세요.');
    if (placeTotal === 0) return ctx.toast('날짜마다 장소를 한 곳 이상 골라 주세요');
    if (empties.length > 0) return setConfirmDrop(empties);
    dropAndGo([]);
  };

  return (
    <StepFrame
      title="날짜별 장소 선택"
      step={2}
      stepLabel="장소"
      onBack={ctx.back}
      onClose={ctx.close}
      toast={ctx.toastMessage}
      footer={
        <View style={styles.footerGap}>
          <Text style={styles.summary}>
            {picked.length}일 · 장소 {placeTotal}곳 선택
          </Text>
          <FooterButtons label={placeTotal > 0 ? `${placeTotal}곳의 사진·동영상 선택` : '장소를 선택해 주세요'} disabled={placeTotal === 0} onPress={next} />
        </View>
      }
    >
      <Heading title={`${picked.length}일의 장소를 골라주세요`} />
      {missingPlaces.map(({ dayKey, key }) => <StateCard key={key} title="사용할 수 없는 장소" body="삭제되었거나 열람할 기록이 없는 장소입니다. 다른 장소의 편집은 보존됩니다." actions={<ActionButton label="이 장소 제외" onPress={() => update((d) => ({ ...d, placeKeys: { ...d.placeKeys, [dayKey]: (d.placeKeys[dayKey] ?? []).filter((x) => x !== key) } }))} />} />)}
      <AspectPicker value={draft.aspect} onChange={(id) => update((d) => ({ ...d, aspect: id }))} />
      <Text style={styles.summary}>영상 모양을 먼저 정해요. 이후 템플릿 배치가 화면 비율에 맞게 나와요.</Text>
      {picked.map((day) => {
        const withMedia = placesWithMedia(day);
        const sel = draft.placeKeys[day.key] ?? [];
        const emptyPlaces = day.places.length - withMedia.length;
        return (
          <View key={day.key} style={styles.group}>
            <View style={styles.groupHead}>
              <Text style={styles.groupTitle}>{dateLabel(day.date)}</Text>
              <Pressable onPress={() => toggleAll(day)} accessibilityRole="button" hitSlop={8} style={styles.allBtn}>
                <Text style={styles.allText}>전체 선택{sel.length === withMedia.length ? ' ✓' : ''}</Text>
              </Pressable>
            </View>
            {withMedia.map((p) => {
              const on = sel.includes(p.key);
              const photos = p.media.filter((m) => m.item.kind === 'photo').length;
              const videos = p.media.length - photos;
              return (
                <Pressable
                  key={p.key}
                  onPress={() => toggle(day, p.key)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}
                  style={[styles.row, on && styles.rowOn]}
                >
                  <View style={styles.rowBody}>
                    <Text style={styles.rowTitle}>
                      {p.place.visitTime ? `${p.place.visitTime}  ` : ''}
                      {p.place.name}
                    </Text>
                    <Text style={styles.rowSub}>{countLabel(photos, videos)}</Text>
                  </View>
                  <CheckCircle checked={on} />
                </Pressable>
              );
            })}
            {emptyPlaces > 0 ? <Text style={styles.note}>기록 없는 장소 {emptyPlaces}곳 · 선택 불가</Text> : null}
          </View>
        );
      })}

      <ConfirmDialog
        visible={confirmDrop !== null}
        title="담을 장소가 없는 날짜가 있어요"
        body={`${(confirmDrop ?? []).map((d) => dateLabel(d.date)).join(', ')}은(는) 선택에서 제외하고 계속할까요?`}
        onRequestClose={() => setConfirmDrop(null)}
        buttons={[
          {
            label: '제외하고 계속',
            onPress: () => {
              const drop = confirmDrop ?? [];
              setConfirmDrop(null);
              dropAndGo(drop);
            },
          },
          { label: '장소 더 고르기', tone: 'plain', onPress: () => setConfirmDrop(null) },
        ]}
      />
    </StepFrame>
  );
}

const styles = StyleSheet.create({
  footerGap: { gap: 10 },
  summary: { fontSize: 12, color: colors.textSub },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.surface, borderRadius: radius.item, borderWidth: 1.5, borderColor: 'transparent', padding: 16, minHeight: 64 },
  rowOn: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  rowOff: { opacity: 0.7 },
  rowBody: { flex: 1, gap: 3 },
  rowTitle: { fontSize: 15, fontWeight: '800', color: colors.text },
  rowSub: { fontSize: 12, color: colors.textSub },
  muted: { color: colors.textMuted },
  dash: { fontSize: 18, color: colors.textMuted, width: 24, textAlign: 'center' },
  group: { gap: 8, marginTop: 4 },
  groupHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  groupTitle: { fontSize: 13, fontWeight: '800', color: colors.primary },
  allBtn: { minHeight: 36, justifyContent: 'center' },
  allText: { fontSize: 13, fontWeight: '700', color: colors.primary },
  note: { fontSize: 12, color: colors.textMuted },
});
