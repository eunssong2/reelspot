import { useInitialize } from '../lib/effects';
import React, { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { api, awaitOperation, ApiError } from '../lib/api';
import { inputText, validTime } from '../lib/validation';
import { useUnsavedChanges } from '../lib/unsaved';
import { Screen, Field, Button, Card, H, P, useAction, s, confirm } from '../components/ui';
export default function Plan() {
  const { id, date } = useLocalSearchParams<{ id: string; date: string }>();
  const [title, setTitle] = useState(''), [visits, setVisits] = useState<any[]>([]), [version, setVersion] = useState(1);
  const [baseline, setBaseline] = useState(''), [latest, setLatest] = useState<any>(null);
  const a = useAction();
  const shape = (title: string, visits: any[]) => JSON.stringify({ title, visits: visits.map((v) => ({ id: v.id, plannedTime: v.plannedTime })) });
  async function load() { const r = await api(`/schedules/${id}`); return r.plan.find((d: any) => d.date === date); }
  useInitialize(() => { a.run(async () => { const d = await load(); if (!d) throw new Error('이 날짜의 계획이 없습니다. 일정 기간을 확인해 주세요.'); setTitle(d.title); setVisits(d.visits); setVersion(d.version); setBaseline(shape(d.title, d.visits)); }); }, [id, date]);
  async function save() {
    return a.run(async () => {
      inputText(title, '날짜 제목', 30, false); visits.forEach((v) => validTime(v.plannedTime ?? ''));
      try {
        await awaitOperation(await api(`/schedules/${id}/plans/${date}`, { title, visits: visits.map((v, i) => ({ id: v.id, order: i, plannedTime: v.plannedTime ?? null })), expectedVersion: version }, 'PUT'));
        setBaseline(shape(title, visits)); setLatest(null);
      } catch (e) { if (e instanceof ApiError && e.code === 'VERSION_CONFLICT') setLatest(await load()); throw e; }
    });
  }
  const leave = useUnsavedChanges(!!baseline && baseline !== shape(title, visits), save);
  function move(i: number, delta: number) { const next = [...visits]; if (i + delta < 0 || i + delta >= next.length) return; [next[i], next[i + delta]] = [next[i + delta], next[i]]; setVisits(next); }
  return <Screen title="방문 계획 편집" subtitle={date}>
    <Field label="이 날짜의 제목 · 선택" value={title} onChangeText={setTitle} />
    <Button secondary onPress={() => setVisits([...visits].sort((a,b) => (a.plannedTime ?? '99:99').localeCompare(b.plannedTime ?? '99:99')))}>예정 시각순으로 정렬</Button>
    {visits.map((v,i) => <Card key={v.id}><H>{i+1}. {v.name}</H>
      <Field label="예정 시각 · 비우면 미정" value={v.plannedTime ?? ''} onChangeText={(time) => setVisits(visits.map((x) => x.id === v.id ? { ...x, plannedTime: time || null } : x))} />
      <View style={s.row}><Button secondary disabled={i === 0} onPress={() => move(i,-1)}>위로</Button><Button secondary disabled={i === visits.length-1} onPress={() => move(i,1)}>아래로</Button>
      <Button secondary onPress={() => confirm('빈 방문 삭제', '기록이나 진행 중 업로드가 있으면 삭제할 수 없습니다.', () => a.run(async () => { await api(`/visits/${v.id}`, { expectedVersion: v.version }, 'DELETE'); const d = await load(); setVisits(visits.filter((x) => x.id !== v.id).map((x) => ({ ...x, version: d.visits.find((n: any) => n.id === x.id)?.version ?? x.version }))); setVersion(d.version); setBaseline(shape(d.title, d.visits)); }))}>삭제</Button></View>
    </Card>)}
    {latest && <Card><H>최신 계획 · 버전 {latest.version}</H><P>{latest.title || date}</P>{latest.visits.map((v: any) => <P key={v.id}>{v.name} · {v.plannedTime ?? '시간 미정'}</P>)}
      <Button secondary onPress={() => confirm('최신 방문 목록에 내 변경을 다시 적용할까요?', '삭제된 방문은 제외하고 새 방문은 마지막에 추가합니다. 내 제목·순서·시각을 확인한 뒤 저장해 주세요.', () => { const existing = visits.filter((v) => latest.visits.some((n: any) => n.id === v.id)); setVisits([...existing, ...latest.visits.filter((n: any) => !existing.some((v) => v.id === n.id))]); setVersion(latest.version); setLatest(null); })}>내 입력을 유지하고 다시 적용 준비</Button>
      <Button secondary onPress={() => confirm('최신 계획으로 바꿀까요?', '현재 입력을 버리고 최신 내용을 불러옵니다.', () => { setTitle(latest.title); setVisits(latest.visits); setVersion(latest.version); setBaseline(shape(latest.title,latest.visits)); setLatest(null); })}>최신 계획 불러오기</Button>
    </Card>}
    <Button disabled={a.busy || !baseline} onPress={async () => { if (await save()) leave(() => router.back()); }}>계획 저장</Button>
    <Button secondary onPress={() => confirm('편집을 그만둘까요?', '저장하지 않은 변경을 버리고 돌아갑니다.', () => leave(() => router.back()))}>변경 버리기</Button>
    {a.errorView}
  </Screen>;
}
