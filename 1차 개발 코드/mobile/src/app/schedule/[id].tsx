import { useFocusLoad } from '../../lib/effects';
import React, { useState, useRef } from 'react';
import { View, Image, Text, Pressable } from 'react-native';
import { SchedulePlan } from '../../components/schedule-plan';
import { scheduleDays } from '../../lib/schedule-days';
import { useLocalSearchParams, router } from 'expo-router';
import { api, getGroup, API, currentSession } from '../../lib/api';
import { usePreference } from '../../lib/preferences';
import { validDate } from '../../lib/validation';
import { useAccount } from '../../lib/state';
import { Records } from '../../components/records';
import { Screen, Button, H, P, Badge, Field, confirm, useAction, s } from '../../components/ui';
export default function Schedule() {
  const { id } = useLocalSearchParams<{ id: string }>(),
    { session } = useAccount(),
    [detail, setDetail] = useState<any>(null),
    [files, setFiles] = useState<any[]>([]),
    [tab, setTab] = useState('plan'),
    [options, setOptions, optionsReady] = usePreference('record-view', {
      view: 'by_time',
      order: 'asc',
    }),
    [recordDate, setDate] = useState(''),
    [visitId, setVisit] = useState(''),
    [next, setNext] = useState<string | null>(null),
    [groups, setGroups] = useState<any[]>([]),
    [owner, setOwner] = useState(false),
    [group, setGroup] = useState<any>(null),
    [summary, setSummary] = useState<any>(null),
    [unassigned, setUnassigned] = useState(false),
    [outside, setOutside] = useState(false),
    [counts, setCounts] = useState<any>(null),
    [dateInput, setDateInput] = useState(''),
    [notice, setNotice] = useState('');
  const { view, order } = options;
  const setView = (view: string) => setOptions({ ...options, view });
  const setOrder = (order: string) => setOptions({ ...options, order });
  const a = useAction();
  const previousVisits = useRef<Set<string> | null>(null);
  const [highlightedVisits, setHighlightedVisits] = useState<string[]>([]);
  async function load(cursor?: string, valid = () => true) {
    const q = new URLSearchParams({ view, order });
    if (recordDate) q.set('recordDate', recordDate);
    if (visitId) q.set('visitId', visitId);
    if (unassigned) q.set('unassigned', 'true');
    if (outside) q.set('outsideRange', 'true');
    if (cursor) q.set('cursor', cursor);
    const r = await api(`/schedules/${id}/media?${q}`);
    if (!valid()) return;
    setCounts(r.visibleCounts);
    setFiles((old) => (cursor ? [...old, ...r.items] : r.items));
    setGroups(r.groups ?? []);
    setNext(r.nextCursor);
  }
  useFocusLoad(() => {
    if (!optionsReady) return;
    let live = true;
    setSummary(null);
    a.run(async () => {
      const d = await api(`/schedules/${id}`);
      if (!live) return;
      const visitIds = d.plan.flatMap((day: any) => day.visits.map((v: any) => v.id)) as string[];
      setHighlightedVisits(
        previousVisits.current ? visitIds.filter((id) => !previousVisits.current!.has(id)) : [],
      );
      previousVisits.current = new Set(visitIds);
      setDetail(d);
      if (recordDate && (recordDate < d.schedule.startDate || recordDate > d.schedule.endDate)) {
        setDate('');
        setDateInput('');
        setNotice('일정 기간이 변경되어 날짜 필터를 전체 보기로 바꿨습니다.');
        return;
      }
      const g = await getGroup(d.schedule.groupId);
      if (!live) return;
      setGroup(g);
      setOwner(g.ownerUserId === session?.userId);
      const totals = await api(`/schedules/${id}/media?limit=1`);
      if (!live) return;
      setSummary(totals);
      await load(undefined, () => live);
    });
    return () => {
      live = false;
    };
  }, [id, view, order, recordDate, visitId, unassigned, outside, optionsReady]);
  return (
    <Screen
      title={detail?.schedule.title ?? '일정'}
      subtitle={detail ? `${detail.schedule.startDate} ~ ${detail.schedule.endDate}` : ''}
    >
      {group && (
        <View style={{ marginHorizontal: -20, marginBottom: 16 }}>
          {group.coverAssetId ? (
            <Image
              source={{
                uri: `${API}/v1/groups/${group.id}/cover?version=${group.version}`,
                headers: { Authorization: `Bearer ${currentSession()?.accessToken}` },
              }}
              style={{ width: '100%', aspectRatio: 16 / 9, backgroundColor: '#FDEDEB' }}
            />
          ) : (
            <View
              style={{
                aspectRatio: 16 / 9,
                backgroundColor: '#FDEDEB',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ fontSize: 20, fontWeight: '800', color: '#F1706B' }}>
                AT THAT PLACE
              </Text>
              <P>{group.name}</P>
            </View>
          )}
          {owner && (
            <Button
              secondary
              onPress={() =>
                confirm(
                  '모임 대표 사진 변경',
                  '이 모임의 모든 일정에 같은 대표 사진이 표시됩니다.',
                  () => router.push({ pathname: '/group/manage', params: { id: group.id } }),
                )
              }
            >
              모임 배경 변경
            </Button>
          )}
        </View>
      )}
      {group && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="함께하는 친구 보기"
          onPress={() => router.push({ pathname: '/group/manage', params: { id: group.id } })}
          style={{ minHeight: 56, justifyContent: 'center' }}
        >
          <H>함께하는 친구 {group.activeCount}명 ›</H>
        </Pressable>
      )}
      <Badge>
        {detail?.schedule.status === 'cancelled'
          ? '취소된 일정'
          : `보관 ${detail?.retention.lastDate ?? '확인 중'}까지`}
      </Badge>
      {notice && <P>{notice}</P>}
      {detail && (
        <P>
          {detail.retention.fixed ? '고정 보관 기한' : '첫 업로드 전 예상 보관 기한'} ·{' '}
          {detail.retention.lastDate}
        </P>
      )}
      <View style={s.row}>
        <Button secondary onPress={() => setTab('plan')}>
          장소 계획
        </Button>
        <Button
          secondary
          onPress={() => {
            setTab('records');
            setDate('');
            setDateInput('');
            setVisit('');
            setOutside(false);
            setUnassigned(false);
          }}
        >
          전체·장소별 기록
        </Button>
      </View>
      {tab === 'plan' ? (
        <>
          {detail && (
            <SchedulePlan
              highlightedVisits={highlightedVisits}
              days={scheduleDays(detail.schedule.startDate, detail.schedule.endDate, detail.plan)}
              date={recordDate}
              counts={summary?.countsByDate ?? null}
              visitCounts={summary?.countsByVisit ?? null}
              loading={a.busy}
              active={detail.schedule.status === 'active'}
              onDate={(date) => {
                setDate(date);
                setDateInput(date);
                setVisit('');
                setUnassigned(false);
                setOutside(false);
              }}
              onVisit={(v) => {
                setVisit(v.id);
                setDate(v.visitDate);
                setDateInput(v.visitDate);
                setUnassigned(false);
                setOutside(false);
                setTab('records');
              }}
              onEdit={(date) => router.push({ pathname: '/plan', params: { id, date } })}
              onAdd={(date) => {
                setDate(date);
                setDateInput(date);
                setVisit('');
                router.push({
                  pathname: '/places',
                  params: {
                    id,
                    groupId: detail.schedule.groupId,
                    startDate: detail.schedule.startDate,
                    endDate: detail.schedule.endDate,
                    visitDate: date,
                  },
                });
              }}
            />
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
          <Button
            secondary
            onPress={() =>
              a.run(async () => {
                if (dateInput) validDate(dateInput);
                setDate(dateInput);
                setVisit('');
              })
            }
          >
            날짜 필터 적용
          </Button>
          <View style={s.row}>
            <Button
              secondary={!unassigned}
              onPress={() => {
                setUnassigned(!unassigned);
                setVisit('');
              }}
            >
              장소 미지정{unassigned ? ' ✓' : ''}
            </Button>
            <Button secondary={!outside} onPress={() => setOutside(!outside)}>
              기간 밖 기록{outside ? ' ✓' : ''}
            </Button>
            <Button
              secondary
              onPress={() => {
                setDate('');
                setDateInput('');
                setVisit('');
                setUnassigned(false);
                setOutside(false);
              }}
            >
              전체 기록 보기
            </Button>
          </View>
          {visitId && (
            <Button secondary onPress={() => setVisit('')}>
              전체 장소 보기
            </Button>
          )}
          {counts && !a.busy && (
            <P>
              현재 범위 · 사진 {counts.photos}개 · 영상 {counts.videos}개
            </P>
          )}
          {!a.busy && !a.error && (
            <Records
              key={`${id}:${recordDate}:${visitId}:${unassigned}:${outside}`}
              items={files}
              groups={view === 'by_author' ? groups : undefined}
            />
          )}
          {a.error && (
            <P>기록을 불러오지 못했습니다. 입력한 필터를 확인하거나 다시 시도해 주세요.</P>
          )}
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
                  recordDate:
                    detail.plan.flatMap((d: any) => d.visits).find((v: any) => v.id === visitId)
                      ?.visitDate ||
                    recordDate ||
                    '',
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
