import { useFocusLoad } from '../../lib/effects';
import React, { useState, useRef } from 'react';
import { View, Image, Text, Pressable } from 'react-native';
import { SchedulePlan } from '../../components/schedule-plan';
import { scheduleDays } from '../../lib/schedule-days';
import { useLocalSearchParams, router } from 'expo-router';
import { api, getGroup, coverSource } from '../../lib/api';
import { usePreference } from '../../lib/preferences';
import { validDate } from '../../lib/validation';
import { useAccount } from '../../lib/state';
import { Records } from '../../components/records';
import {
  Screen,
  Button,
  H,
  P,
  Field,
  confirm,
  useAction,
  s,
  Sheet,
  Chip,
  TextButton,
  colors,
} from '../../components/ui';
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
  const [menu, setMenu] = useState(false),
    [filters, setFilters] = useState(false),
    [adding, setAdding] = useState(false);
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
  const selectedVisit = detail?.plan
    .flatMap((d: any) => d.visits)
    .find((v: any) => v.id === visitId);
  const uploadParams = detail
    ? {
        id,
        startDate: detail.schedule.startDate,
        endDate: detail.schedule.endDate,
        visitId,
        recordDate: selectedVisit?.visitDate || recordDate || '',
      }
    : { id };
  return (
    <Screen
      title={
        tab === 'records'
          ? selectedVisit?.name || '함께 남긴 순간'
          : recordDate && detail
            ? detail.schedule.title
            : 'AT THAT PLACE'
      }
      subtitle={
        tab === 'records'
          ? `${detail?.schedule.title ?? ''}${recordDate ? ' · ' + recordDate : ''}`
          : recordDate && detail
            ? `${detail.schedule.startDate} - ${detail.schedule.endDate}`
            : undefined
      }
      onBack={() => {
        // Visit and date views live in this screen's state, so step back through them first.
        if (tab === 'records' && visitId) {
          setVisit('');
          setTab('plan');
          return true;
        }
        if (tab === 'plan' && recordDate) {
          setDate('');
          setDateInput('');
          return true;
        }
        return false;
      }}
      contentStyle={tab === 'plan' && !recordDate ? { paddingTop: 0 } : undefined}
      headerRight={
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="일정 메뉴"
          style={{ padding: 10 }}
          onPress={() => setMenu(true)}
        >
          <Text style={{ fontSize: 22 }}>⋯</Text>
        </Pressable>
      }
    >
      <Sheet visible={menu} title="일정 메뉴" onClose={() => setMenu(false)}>
        <Button
          secondary
          onPress={() => {
            setMenu(false);
            router.push('/uploads');
          }}
        >
          파일 전송 상태
        </Button>
        <Button
          secondary
          onPress={() => {
            setMenu(false);
            router.push(`/group/manage?id=${group?.id}`);
          }}
        >
          함께하는 친구
        </Button>
        {owner && (
          <Button
            secondary
            onPress={() => {
              setMenu(false);
              router.push(`/schedule/edit?id=${id}`);
            }}
          >
            일정 변경·취소
          </Button>
        )}
        <Button
          secondary
          onPress={() => {
            setMenu(false);
            router.push(`/edit-records?scheduleId=${id}`);
          }}
        >
          내 기록 수정·삭제
        </Button>
        <P>
          {detail?.retention.fixed ? '고정 보관 기한' : '첫 업로드 전 예상 보관 기한'} ·{' '}
          {detail?.retention.lastDate ?? '확인 중'}까지
        </P>
      </Sheet>
      <Sheet visible={adding} title="지금 이 순간 남기기" onClose={() => setAdding(false)}>
        <Button
          tone="outline"
          onPress={() => {
            setAdding(false);
            router.push({ pathname: '/upload', params: uploadParams });
          }}
        >
          ＋ 앨범에서 사진·영상 선택
        </Button>
        <Button
          secondary
          onPress={() => {
            setAdding(false);
            router.push({ pathname: '/camera', params: uploadParams });
          }}
        >
          📷 지금 촬영하기
        </Button>
        <Button secondary onPress={() => setAdding(false)}>
          취소
        </Button>
      </Sheet>
      {tab === 'plan' && !recordDate && group && (
        <>
          <Pressable
            disabled={!owner}
            accessibilityRole="button"
            accessibilityLabel="모임 배경 변경"
            onPress={() =>
              confirm(
                '모임 대표 사진 변경',
                '이 모임의 모든 일정에 같은 대표 사진이 표시됩니다.',
                () => router.push(`/group/manage?id=${group.id}&mode=info`),
              )
            }
            style={{ marginHorizontal: -20, marginBottom: 20 }}
          >
            {group.coverAssetId ? (
              <Image
                source={coverSource(group.id, group.version)}
                style={{ width: '100%', aspectRatio: 16 / 9 }}
              />
            ) : (
              <View
                style={{
                  aspectRatio: 16 / 9,
                  backgroundColor: '#FFF0E6',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ fontSize: 58 }}>🌉</Text>
              </View>
            )}
            {owner && (
              <View
                style={{
                  position: 'absolute',
                  right: 12,
                  bottom: 12,
                  backgroundColor: '#191F2899',
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                  borderRadius: 16,
                }}
              >
                <Text style={{ color: 'white', fontSize: 11 }}>📷 배경 변경</Text>
              </View>
            )}
          </Pressable>
          <Text style={{ fontSize: 24, fontWeight: '700', color: colors.ink, marginBottom: 8 }}>
            {detail?.schedule.title}
          </Text>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 14,
            }}
          >
            <P>
              📅 {detail?.schedule.startDate} - {detail?.schedule.endDate}
            </P>
            <TextButton onPress={() => router.push(`/group/manage?id=${group.id}`)}>
              👥 {group.activeCount}명 ›
            </TextButton>
          </View>
        </>
      )}
      {!!notice && <P>{notice}</P>}
      {detail?.schedule.status === 'cancelled' && (
        <P>취소된 일정입니다. 보관 기한까지 기록을 볼 수 있어요.</P>
      )}
      {tab === 'records' && detail?.schedule.status === 'active' && (
        <Button tone="outline" onPress={() => setAdding(true)}>
          ＋ 사진·영상 올리기
        </Button>
      )}
      <View style={{ flexDirection: 'row', gap: 8, marginVertical: 12 }}>
        <Chip selected={tab === 'plan'} onPress={() => setTab('plan')}>
          전체 계획
        </Chip>
        <Chip
          selected={tab === 'records'}
          onPress={() => {
            setTab('records');
            setVisit('');
            setDate('');
            setDateInput('');
            setUnassigned(false);
            setOutside(false);
          }}
        >
          전체 기록
        </Chip>
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
              onEdit={(date, visit) =>
                router.push({
                  pathname: '/plan',
                  params: { id, date, ...(visit ? { visit } : {}) },
                })
              }
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
          {!recordDate && owner && (
            <Button
              secondary
              tone="outline"
              onPress={() => router.push(`/schedule/edit?groupId=${group.id}`)}
            >
              일정 추가
            </Button>
          )}
        </>
      ) : (
        <>
          <H>함께 남긴 순간</H>
          <View
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
          >
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Chip selected={view === 'by_time'} onPress={() => setView('by_time')}>
                ▦ 시간순
              </Chip>
              <Chip selected={view === 'by_author'} onPress={() => setView('by_author')}>
                ♙ 사람별
              </Chip>
            </View>
            <TextButton
              color={colors.sub}
              onPress={() => setOrder(order === 'asc' ? 'desc' : 'asc')}
            >
              {order === 'asc' ? '오래된 순' : '최신순'} ↕
            </TextButton>
          </View>
          <TextButton color={colors.sub} onPress={() => setFilters(true)}>
            {recordDate || unassigned || outside || visitId
              ? `필터: ${[
                  selectedVisit?.name,
                  !visitId && recordDate,
                  unassigned && '장소 미지정',
                  outside && '기간 밖',
                ]
                  .filter(Boolean)
                  .join(' · ')} · 변경`
              : '날짜·장소 필터'}
          </TextButton>
          <Sheet visible={filters} title="기록 필터" onClose={() => setFilters(false)}>
            <Field
              label="기록일"
              value={dateInput}
              onChangeText={setDateInput}
              placeholder="전체 날짜"
            />
            <View style={s.row}>
              <Chip
                selected={unassigned}
                onPress={() => {
                  setUnassigned(!unassigned);
                  setVisit('');
                }}
              >
                장소 미지정
              </Chip>
              <Chip selected={outside} onPress={() => setOutside(!outside)}>
                기간 밖 기록
              </Chip>
            </View>
            <Button
              onPress={() =>
                a.run(async () => {
                  if (dateInput) validDate(dateInput);
                  setDate(dateInput);
                  setVisit('');
                  setFilters(false);
                })
              }
            >
              필터 적용
            </Button>
            <Button
              secondary
              onPress={() => {
                setDate('');
                setDateInput('');
                setVisit('');
                setUnassigned(false);
                setOutside(false);
                setFilters(false);
              }}
            >
              전체 기록 보기
            </Button>
            {a.errorView}
          </Sheet>
          {counts && !a.busy && (
            <P>
              사진 {counts.photos}개 · 영상 {counts.videos}개
            </P>
          )}
          {!a.busy && !a.error && (
            <Records
              key={`${id}:${recordDate}:${visitId}:${unassigned}:${outside}`}
              items={files}
              groups={view === 'by_author' ? groups : undefined}
            />
          )}
          {next && (
            <Button secondary onPress={() => a.run(() => load(next))}>
              기록 더 보기
            </Button>
          )}
        </>
      )}
      {a.errorView}
    </Screen>
  );
}
