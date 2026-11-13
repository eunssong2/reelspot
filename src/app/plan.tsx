import { useInitialize, useFocusLoad } from '../lib/effects';
import React, { useRef, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { View, Text, Pressable } from 'react-native';
import { TimeEditModal } from '../components/time-edit-modal';
import { dateHeading } from '../lib/day-labels';
import { api, awaitOperation, ApiError } from '../lib/api';
import { capTitle, inputText, validTime } from '../lib/validation';
import { useUnsavedChanges } from '../lib/unsaved';
import {
  Screen,
  Field,
  Button,
  Card,
  H,
  P,
  useAction,
  confirm,
  TextButton,
  colors,
} from '../components/ui';
export default function Plan() {
  const { id, date, visit } = useLocalSearchParams<{ id: string; date: string; visit?: string }>();
  const [title, setTitle] = useState(''),
    [visits, setVisits] = useState<any[]>([]),
    [version, setVersion] = useState(1);
  const [baseline, setBaseline] = useState(''),
    [latest, setLatest] = useState<any>(null);
  const [editing, setEditing] = useState('');
  const editTime = (v: any) => setEditing(v.id);
  const a = useAction();
  const shape = (title: string, visits: any[]) =>
    JSON.stringify({
      title,
      visits: visits.map((v) => ({ id: v.id, plannedTime: v.plannedTime })),
    });
  const [schedule, setSchedule] = useState<any>(null);
  async function load() {
    const r = await api(`/schedules/${id}`);
    setSchedule(r.schedule);
    return r.plan.find((d: any) => d.date === date);
  }
  function show(d: any) {
    setTitle(d.title);
    setVisits(d.visits);
    setVersion(d.version);
    setBaseline(shape(d.title, d.visits));
    setLatest(null);
  }
  useInitialize(() => {
    a.run(async () => {
      const d = await load();
      if (!d) throw new Error('이 날짜의 계획이 없습니다. 일정 기간을 확인해 주세요.');
      show(d);
      const target = d.visits.find((v: any) => v.id === visit);
      if (target) editTime(target);
    });
  }, [id, date]);
  async function save() {
    return a.run(async () => {
      inputText(title, '날짜 제목', title === JSON.parse(baseline).title ? 100 : 30, false);
      visits.forEach((v) => validTime(v.plannedTime ?? ''));
      try {
        await awaitOperation(
          await api(
            `/schedules/${id}/plans/${date}`,
            {
              title,
              visits: visits.map((v, i) => ({
                id: v.id,
                order: i,
                plannedTime: v.plannedTime ?? null,
              })),
              expectedVersion: version,
            },
            'PUT',
          ),
        );
        setBaseline(shape(title, visits));
        setLatest(null);
      } catch (e) {
        if (e instanceof ApiError && e.code === 'VERSION_CONFLICT') setLatest(await load());
        throw e;
      }
    });
  }
  const dirty = !!baseline && baseline !== shape(title, visits);
  const leave = useUnsavedChanges(dirty, save);
  // The place editor changes saved values, so the current order, times and title are saved
  // first. A failed or conflicting save keeps this screen and everything typed here.
  const editedPlace = useRef(false);
  async function editPlace(v: any) {
    if (a.busy || !schedule) return;
    if (dirty && !(await save())) return;
    editedPlace.current = true;
    router.push({
      pathname: '/places',
      params: { id, groupId: schedule.groupId, startDate: schedule.startDate, endDate: schedule.endDate, visitDate: date, visitId: v.id },
    });
  }
  useFocusLoad(() => {
    if (!editedPlace.current) return;
    editedPlace.current = false;
    // Back from the place editor: show the saved name, address, time and versions.
    void a.run(async () => {
      const d = await load();
      if (!d) throw new Error('이 날짜의 계획이 없습니다. 일정 기간을 확인해 주세요.');
      show(d);
    });
  }, [id, date]);
  function move(i: number, delta: number) {
    const next = [...visits];
    if (i + delta < 0 || i + delta >= next.length) return;
    [next[i], next[i + delta]] = [next[i + delta], next[i]];
    setVisits(next);
  }
  return (
    <Screen
      title="장소 순서 편집"
      subtitle={dateHeading(date)}
      footer={
        <Button
          disabled={a.busy || !baseline}
          onPress={async () => {
            if (await save()) leave(() => router.back());
          }}
        >
          변경 저장
        </Button>
      }
    >
      <Field
        label="날짜 제목"
        limit={30}
        placeholder="예: 빵 먹고 전시 보고 저녁까지"
        helper={`비워 두면 "${Number(date.slice(5, 7))}월 ${Number(date.slice(8, 10))}일의 장소"로 보여요`}
        value={title}
        onChangeText={(next) => setTitle(capTitle(title, next))}
      />
      <Text
        style={{
          textAlign: 'center',
          color: colors.accent,
          fontWeight: '800',
          backgroundColor: colors.sage,
          borderRadius: 16,
          overflow: 'hidden',
          padding: 16,
        }}
      >
        위·아래 버튼으로 방문 순서를 바꾸세요.
      </Text>
      <TimeEditModal visible={!!editing} placeName={visits.find((v) => v.id === editing)?.name ?? ''}
        value={visits.find((v) => v.id === editing)?.plannedTime ?? undefined}
        onClose={() => setEditing('')} onSave={(time) => {
          setVisits(visits.map((v) => v.id === editing ? { ...v, plannedTime: time ?? null } : v));
          setEditing('');
        }} />
      {visits.map((v, i) => (
        <View
          key={v.id}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 }}
        >
          <View
            style={{
              backgroundColor: colors.accent,
              width: 28,
              height: 28,
              borderRadius: 14,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: 'white', fontSize: 13, fontWeight: '800' }}>{i + 1}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text numberOfLines={1} style={{ flexShrink: 1, fontSize: 16, fontWeight: '800', color: colors.ink }}>{v.name}</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${v.name} 장소 수정`}
                disabled={a.busy}
                onPress={() => void editPlace(v)}
                hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
                style={({ pressed }) => ({ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, backgroundColor: colors.sage, opacity: pressed ? 0.7 : 1 })}
              >
                <Text style={{ fontSize: 12, fontWeight: '800', color: colors.accent }}>장소 수정</Text>
              </Pressable>
            </View>
            {!!v.address && (
              <Text numberOfLines={1} style={{ fontSize: 13, color: colors.muted, marginTop: 3 }}>
                {v.address}
              </Text>
            )}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 }}>
              <Text style={{ fontSize: 13, color: colors.muted }}>방문 시간</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${v.name} 방문 시간 수정`}
                onPress={() => editTime(v)}
                style={{
                  backgroundColor: colors.surface,
                  borderRadius: 16,
                  paddingHorizontal: 12,
                  minHeight: 48,
                  justifyContent: 'center',
                }}
              >
                <Text style={{ fontSize: 15, fontWeight: '800', color: v.plannedTime ? colors.ink : colors.muted }}>
                  {v.plannedTime ?? '시간 미정'} ✎
                </Text>
              </Pressable>
              <TextButton
                color={colors.muted}
                onPress={() =>
                  confirm(
                    '이 장소를 뺄까요?',
                    '기록이나 진행 중 업로드가 있는 장소는 뺄 수 없어요.',
                    () =>
                      a.run(async () => {
                        await api(`/visits/${v.id}`, { expectedVersion: v.version }, 'DELETE');
                        const d = await load();
                        setVisits(
                          visits
                            .filter((x) => x.id !== v.id)
                            .map((x) => ({
                              ...x,
                              version: d.visits.find((n: any) => n.id === x.id)?.version ?? x.version,
                            })),
                        );
                        setVersion(d.version);
                        setBaseline(shape(d.title, d.visits));
                      }),
                  )
                }
              >
                빼기
              </TextButton>
            </View>
          </View>
          <View style={{ gap: 8 }}>
            {(
              [
                [-1, '▲', '위로'],
                [1, '▼', '아래로'],
              ] as const
            ).map(([delta, glyph, label]) => {
              const off = delta < 0 ? i === 0 : i === visits.length - 1;
              return (
                <Pressable
                  key={glyph}
                  accessibilityRole="button"
                  accessibilityLabel={`${v.name} ${label}`}
                  disabled={off}
                  onPress={() => move(i, delta)}
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 12,
                    backgroundColor: off ? '#F9FAFB' : colors.surface,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text style={{ fontSize: 16, color: off ? '#D1D6DB' : colors.ink }}>{glyph}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ))}
      {latest && (
        <Card>
          <H>최신 계획 · 버전 {latest.version}</H>
          <P>{latest.title || date}</P>
          {latest.visits.map((v: any) => (
            <P key={v.id}>
              {v.name} · {v.plannedTime ?? '시간 미정'}
            </P>
          ))}
          <Button
            secondary
            onPress={() =>
              confirm(
                '최신 방문 목록에 내 변경을 다시 적용할까요?',
                '삭제된 방문은 제외하고 새 방문은 마지막에 추가합니다. 내 제목·순서·시각을 확인한 뒤 저장해 주세요.',
                () => {
                  const existing = visits.filter((v) =>
                    latest.visits.some((n: any) => n.id === v.id),
                  );
                  setVisits([
                    ...existing,
                    ...latest.visits.filter((n: any) => !existing.some((v) => v.id === n.id)),
                  ]);
                  setVersion(latest.version);
                  setLatest(null);
                },
              )
            }
          >
            내 입력을 유지하고 다시 적용 준비
          </Button>
          <Button
            secondary
            onPress={() =>
              confirm(
                '최신 계획으로 바꿀까요?',
                '현재 입력을 버리고 최신 내용을 불러옵니다.',
                () => {
                  setTitle(latest.title);
                  setVisits(latest.visits);
                  setVersion(latest.version);
                  setBaseline(shape(latest.title, latest.visits));
                  setLatest(null);
                },
              )
            }
          >
            최신 계획 불러오기
          </Button>
        </Card>
      )}
      {a.errorView}
    </Screen>
  );
}
