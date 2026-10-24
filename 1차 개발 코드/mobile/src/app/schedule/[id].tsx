import { useFocusLoad } from '../../lib/effects';
import React, { useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { api, getGroup } from '../../lib/api';
import { usePreference } from '../../lib/preferences';
import { validDate } from '../../lib/validation';
import { useAccount } from '../../lib/state';
import { Records } from '../../components/records';
import {
  Screen,
  Button,
  Card,
  H,
  P,
  Badge,
  Field,
  confirm,
  useAction,
  s,
} from '../../components/ui';
export default function Schedule() {
  const { id } = useLocalSearchParams<{ id: string }>(),
    { session } = useAccount(),
    [detail, setDetail] = useState<any>(null),
    [files, setFiles] = useState<any[]>([]),
    [tab, setTab] = useState('plan'),
    [options, setOptions, optionsReady] = usePreference('record-view', { view: 'by_time', order: 'asc' }),
    [recordDate, setDate] = useState(''),
    [visitId, setVisit] = useState(''),
    [next, setNext] = useState<string | null>(null),
    [groups, setGroups] = useState<any[]>([]),
    [owner, setOwner] = useState(false),
    [unassigned, setUnassigned] = useState(false), [outside, setOutside] = useState(false),
    [counts, setCounts] = useState<any>(null), [dateCounts, setDateCounts] = useState<any[]>([]),
    [visitCounts, setVisitCounts] = useState<any[]>([]), [dateInput, setDateInput] = useState(''), [notice, setNotice] = useState('');
  const { view, order } = options;
  const setView = (view: string) => setOptions({ ...options, view });
  const setOrder = (order: string) => setOptions({ ...options, order });
  const a = useAction();
  async function load(cursor?: string, valid = () => true) {
    const q = new URLSearchParams({ view, order });
    if (recordDate) q.set('recordDate', recordDate);
    if (visitId) q.set('visitId', visitId);
    if (unassigned) q.set('unassigned', 'true');
    if (outside) q.set('outsideRange', 'true');
    if (cursor) q.set('cursor', cursor);
    const r = await api(`/schedules/${id}/media?${q}`);
    if (!valid()) return;
    setCounts(r.visibleCounts); setDateCounts(r.countsByDate ?? []); setVisitCounts(r.countsByVisit ?? []);
    setFiles((old) => (cursor ? [...old, ...r.items] : r.items));
    setGroups(r.groups ?? []);
    setNext(r.nextCursor);
  }
  useFocusLoad(() => {
    if (!optionsReady) return;
    let live = true;
    a.run(async () => {
      const d = await api(`/schedules/${id}`);
      if (!live) return;
      setDetail(d);
      if (recordDate && (recordDate < d.schedule.startDate || recordDate > d.schedule.endDate)) { setDate(''); setDateInput(''); setNotice('일정 기간이 변경되어 날짜 필터를 전체 보기로 바꿨습니다.'); return; }
      const g = await getGroup(d.schedule.groupId);
      setOwner(g.ownerUserId === session?.userId);
      if (live) await load(undefined, () => live);
    });
    return () => { live = false; };
  }, [id, view, order, recordDate, visitId, unassigned, outside, optionsReady]);
  return (
    <Screen
      title={detail?.schedule.title ?? '일정'}
      subtitle={detail ? `${detail.schedule.startDate} ~ ${detail.schedule.endDate}` : ''}
    >
      <Badge>
        {detail?.schedule.status === 'cancelled'
          ? '취소된 일정'
          : `보관 ${detail?.retention.lastDate ?? '확인 중'}까지`}
      </Badge>
      {notice && <P>{notice}</P>}
      {detail && <P>{detail.retention.fixed ? '고정 보관 기한' : '첫 업로드 전 예상 보관 기한'} · {detail.retention.lastDate}</P>}
      <View style={s.row}>
        <Button secondary onPress={() => setTab('plan')}>
          장소 계획
        </Button>
        <Button secondary onPress={() => setTab('records')}>
          공동 기록
        </Button>
      </View>
      {tab === 'plan' ? (
        <>
          {detail?.plan.filter((d: any) => !recordDate || d.date === recordDate).map((d: any) => (
            <Card key={d.date}>
              <Badge>{d.outsideRange ? '기간 밖 계획' : d.date}</Badge>
              <H>{d.title || d.date}</H>
              {d.visits.map((v: any) => (
                <Card
                  key={v.id}
                  onPress={() => {
                    setVisit(v.id);
                    setTab('records');
                  }}
                >
                  <H>{v.name}</H>
                  {visitCounts.find((c) => c.visitId === v.id) && <P>사진 {visitCounts.find((c) => c.visitId === v.id).photos} · 영상 {visitCounts.find((c) => c.visitId === v.id).videos}</P>}
                  <P>{v.plannedTime ?? '시간 미정'} · 기록 보기 →</P>
                </Card>
              ))}
              <P>장소 {d.visitCount}/15개{dateCounts.find((c) => c.date === d.date) ? ` · 사진 ${dateCounts.find((c) => c.date === d.date).photos} · 영상 ${dateCounts.find((c) => c.date === d.date).videos}` : ''}</P>
              <Button
                secondary
                onPress={() => router.push({ pathname: '/plan', params: { id, date: d.date } })}
              >
                순서·시간 편집
              </Button>
            </Card>
          ))}
          {detail && !detail.plan.length && <P>등록된 장소 계획이 없습니다. 장소를 추가해 계획을 시작해 보세요.</P>}
          {detail?.schedule.status === 'active' && (
            <Button
              secondary
              onPress={() =>
                router.push({
                  pathname: '/places',
                  params: {
                    id,
                    groupId: detail.schedule.groupId,
                    startDate: detail.schedule.startDate,
                    endDate: detail.schedule.endDate,
                  },
                })
              }
            >
              장소 추가
            </Button>
          )}
        </>
      ) : (
        <>
          <View style={s.row}>
            <Button secondary onPress={() => setView(view === 'by_time' ? 'by_author' : 'by_time')}>
              {view === 'by_time' ? '시간순' : '사람별 묶음'}
            </Button>
            <Button secondary onPress={() => setOrder(order === 'asc' ? 'desc' : 'asc')}>
              {order === 'asc' ? '오래된 순' : '최신순'}
            </Button>
          </View>
          <Field
            label="기록일 필터 · 비우면 전체"
            value={dateInput}
            onChangeText={setDateInput}
            placeholder="YYYY-MM-DD"
          />
          <Button secondary onPress={() => a.run(async () => { if (dateInput) validDate(dateInput); setDate(dateInput); setVisit(''); })}>날짜 필터 적용</Button>
          <View style={s.row}>
            <Button secondary={!unassigned} onPress={() => { setUnassigned(!unassigned); setVisit(''); }}>장소 미지정{unassigned ? ' ✓' : ''}</Button>
            <Button secondary={!outside} onPress={() => setOutside(!outside)}>기간 밖 기록{outside ? ' ✓' : ''}</Button>
            <Button secondary onPress={() => { setDate(''); setDateInput(''); setVisit(''); setUnassigned(false); setOutside(false); }}>전체 기록 보기</Button>
          </View>
          {visitId && (
            <Button secondary onPress={() => setVisit('')}>
              전체 장소 보기
            </Button>
          )}
          {counts && !a.busy && <P>현재 범위 · 사진 {counts.photos}개 · 영상 {counts.videos}개</P>}
          {!a.busy && !a.error && <Records items={files} groups={view === 'by_author' ? groups : undefined} />}
          {a.error && <P>기록을 불러오지 못했습니다. 입력한 필터를 확인하거나 다시 시도해 주세요.</P>}
          <Button
            secondary
            onPress={() => router.push({ pathname: '/edit-records', params: { scheduleId: id } })}
          >
            내 기록 수정·삭제
          </Button>
          {next && (
            <Button secondary onPress={() => a.run(() => load(next))}>
              기록 더 보기
            </Button>
          )}
        </>
      )}
      {detail?.schedule.status === 'active' && (
        <>
          <Button
            onPress={() =>
              router.push({
                pathname: '/upload',
                params: {
                  id,
                  startDate: detail.schedule.startDate,
                  endDate: detail.schedule.endDate,
                  visitId,
                  recordDate: detail.plan.flatMap((d: any) => d.visits).find((v: any) => v.id === visitId)?.visitDate || recordDate || '',
                },
              })
            }
          >
            사진·영상 올리기
          </Button>
          <Button
            secondary
            onPress={() =>
              router.push({
                pathname: '/camera',
                params: {
                  id,
                  startDate: detail.schedule.startDate,
                  endDate: detail.schedule.endDate,
                  visitId,
                },
              })
            }
          >
            지금 촬영하기
          </Button>
        </>
      )}
      <Button secondary onPress={() => router.push('/uploads')}>
        파일 전송 상태
      </Button>
      {owner && (
        <>
          <Button
            secondary
            onPress={() => router.push({ pathname: '/schedule/edit', params: { id } })}
          >
            일정 변경
          </Button>
          <Button
            secondary
            onPress={() =>
              confirm(
                '일정을 취소할까요?',
                '기록은 보관 기한까지 유지되고 새 업로드는 막힙니다.',
                () =>
                  a.run(async () => {
                    await api(`/schedules/${id}/cancellation`, {
                      expectedVersion: detail.schedule.version,
                    });
                    router.back();
                  }),
              )
            }
          >
            일정 취소
          </Button>
          <Button
            secondary
            onPress={() =>
              confirm(
                '빈 일정을 삭제할까요?',
                `함께 삭제할 빈 방문 계획 ${detail.plan.reduce((n: number, d: any) => n + d.visitCount, 0)}개가 있습니다. 기록이나 진행 중 업로드가 있으면 삭제할 수 없습니다.`,
                () =>
                  a.run(async () => {
                    await api(`/schedules/${id}/deletion`, {
                      expectedVersion: detail.schedule.version,
                    });
                    router.back();
                  }),
              )
            }
          >
            빈 일정 삭제
          </Button>
        </>
      )}
      {a.errorView}
    </Screen>
  );
}
