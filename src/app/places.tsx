import { useInitialize } from '../lib/effects';
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useLocalSearchParams, router } from 'expo-router';
import { Linking, View, Text, ScrollView, Pressable } from 'react-native';
import * as Location from 'expo-location';
import { useAppToast } from '../components/toast-provider';
import { dateHeading } from '../lib/day-labels';
import { PlaceMap } from '../components/place-map';
import { api, awaitOperation, ApiError } from '../lib/api';
import { TimeEditModal } from '../components/time-edit-modal';
import { visitChanges, type VisitValues } from '../lib/place-edit';
import { inputText, validDate } from '../lib/validation';
import {
  Screen,
  Button,
  Field,
  Card,
  H,
  P,
  useAction,
  Sheet,
  TextButton,
  colors,
} from '../components/ui';
export function placeCategory(category = '') {
  if (/카페|커피/.test(category)) return { label: '카페', icon: '☕' };
  if (/숙박|호텔|모텔|펜션|숙소/.test(category)) return { label: '숙소', icon: '🛏️' };
  if (/음식|맛집|식당/.test(category)) return { label: '맛집', icon: '🍽️' };
  if (/미술|박물|전시/.test(category)) return { label: '관광지', icon: '🖼️' };
  if (/관광|명소|문화/.test(category)) return { label: '관광지', icon: '🏯' };
  return { label: '장소', icon: '📍' };
}
export default function Places() {
  const p = useLocalSearchParams<{
      id: string;
      groupId: string;
      startDate: string;
      endDate: string;
      visitDate?: string;
      /** Present when an existing place is edited (UI50). */
      visitId?: string;
    }>(),
    editing = !!p.visitId,
    [query, setQuery] = useState(''),
    [results, setResults] = useState<any[]>([]),
    [fitKey, setFitKey] = useState(0),
    [manual, setManual] = useState(editing),
    [name, setName] = useState(''),
    [address, setAddress] = useState(''),
    [date] = useState(p.visitDate || p.startDate),
    [scheduleTitle, setScheduleTitle] = useState(''),
    [dateAllowed, setDateAllowed] = useState(false),
    [collapsed, setCollapsed] = useState(false),
    [lat, setLat] = useState(''),
    [lng, setLng] = useState(''),
    [category] = useState('all'),
    [chosen, setChosen] = useState<any>(null),
    [highlighted, setHighlighted] = useState<string>(),
    [excluded, setExcluded] = useState(0),
    [searched, setSearched] = useState(false),
    [page, setPage] = useState(1),
    [isEnd, setIsEnd] = useState(true),
    [providerMessage, setProviderMessage] = useState(''),
    [planned, setPlanned] = useState<any[]>([]);
  // Edit mode: `original` is the server's latest value and version (what a save is compared
  // with); `baseline` is what the form was filled from, so the fields the user changed can be
  // told apart from fields another member changed meanwhile. Replacing needs the server's OK.
  const [original, setOriginal] = useState<(VisitValues & { version: number }) | null>(null),
    [saving, setSaving] = useState(false),
    [replaceable, setReplaceable] = useState(false),
    [plannedTime, setPlannedTime] = useState<string | null>(null),
    [timeOpen, setTimeOpen] = useState(false);
  const [center, setCenter] = useState({ lat: 37.5665, lng: 126.978 }),
    [bounds, setBounds] = useState(''),
    [sort, setSort] = useState('relevance');
  const toast = useAppToast();
  const resultsScroll = useRef<ScrollView>(null);
  const resultPositions = useRef<Record<string, number>>({});
  const sequence = useRef(0),
    a = useAction(),
    // Saves have no inline "다시 시도": it would rerun the first attempt with the inputs captured
    // then and outside the edit lock. Retrying is the save button, which reads the current form.
    // Same input means the same request key, so a retry after a lost answer cannot duplicate.
    save = useAction({ inlineRetry: false });
  useInitialize(() => {
    void a.run(async () => {
      const detail = await api(`/schedules/${p.id}`);
      setScheduleTitle(detail.schedule.title);
      setDateAllowed(detail.schedule.status === 'active' && (detail.days ?? detail.plan).some((d: any) => d.date === date && d.status !== 'cancelled'));
      setPlanned(detail.plan.flatMap((d: any) => d.visits.map((v: any) => ({ ...v, visitDate: d.date }))));
      if (editing) await loadVisit();
    });
  }, []);
  // While an edit is being saved (and re-read after a conflict) every way of changing the form
  // is locked, so nothing typed during the request can be lost. The ref serves callbacks that
  // may run before the next render.
  const savingRef = useRef(false);
  const locked = editing && saving;
  function lockEdits(on: boolean) {
    savingRef.current = on;
    setSaving(on);
  }
  // What the form was filled from, to tell the user's changes apart from other members'.
  const baseline = useRef<VisitValues | null>(null);
  // The form as it is right now. Read after an await instead of state captured before it.
  const inputs = useRef({ name, address, lat, lng, plannedTime });
  useLayoutEffect(() => {
    inputs.current = { name, address, lat, lng, plannedTime };
  });
  /** Form values; never throws, unlike the checks run when saving. */
  const valuesOf = (f: typeof inputs.current): VisitValues => ({
    name: f.name.normalize('NFC').trim(),
    address: f.address.normalize('NFC').trim(),
    lat: f.lat === '' ? null : Number(f.lat),
    lng: f.lng === '' ? null : Number(f.lng),
    plannedTime: f.plannedTime,
  });
  /**
   * Reads the visit. The first load fills the form. A reload after a conflict keeps what the
   * user changed and takes the latest server value for every other field, so a retry cannot
   * send back a stale value the user never touched.
   */
  async function loadVisit(merge = false) {
    const r = await api(`/visits/${p.visitId}`);
    const v = r.visit;
    const latest: VisitValues = { name: v.name, address: v.address ?? '', lat: v.lat, lng: v.lng, plannedTime: v.plannedTime ?? null };
    // Compared with the form as it is when the answer arrives, not when the save was pressed.
    const mine = merge && baseline.current ? visitChanges(baseline.current, valuesOf(inputs.current)) : {};
    setOriginal({ ...latest, version: v.version });
    baseline.current = latest;
    setReplaceable(r.replaceable);
    setDateAllowed(r.editable);
    if (!r.replaceable) leaveSearch();
    if (!('name' in mine)) setName(latest.name);
    if (!('address' in mine)) setAddress(latest.address);
    if (!('location' in mine)) {
      setLat(latest.lat == null ? '' : String(latest.lat));
      setLng(latest.lng == null ? '' : String(latest.lng));
      if (latest.lat != null && latest.lng != null) setCenter({ lat: latest.lat, lng: latest.lng });
    }
    if (!('plannedTime' in mine)) setPlannedTime(latest.plannedTime);
  }
  function clearSearch() {
    sequence.current++;
    setQuery('');
    setResults([]);
    setSearched(false);
    setIsEnd(true);
    setChosen(null);
    setHighlighted(undefined);
    setProviderMessage('');
  }
  function leaveSearch() {
    clearSearch();
    setManual(true);
  }
  /** Search ⇄ form. A new registration starts clean; an edited place keeps its untouched pin. */
  function toggleManual() {
    clearSearch();
    if (!editing) {
      setLat('');
      setLng('');
    }
    setManual(!manual);
  }
  const lastSearch = useRef('');
  async function search(inArea = false, selectedCategory = category, searchText = query, nextPage = 1, searchSort = sort) {
    if (nextPage === 1 && selectedCategory === 'all' && !searchText.trim()) return;
    const seq = ++sequence.current;
    await a.run(async () => {
      const parameters = nextPage > 1 ? lastSearch.current : new URLSearchParams({
        groupId: p.groupId, query: inputText(searchText, '검색어', 100, selectedCategory === 'all'),
        category: selectedCategory, sort: selectedCategory === 'all' ? searchSort : 'distance',
        center: `${center.lng},${center.lat}`, ...(inArea && bounds ? { bounds } : {}),
      }).toString();
      const r = await api(`/places?${parameters}&page=${nextPage}`).catch(() => { if (sequence.current !== seq) return null; throw new Error('검색에 실패했어요. 잠시 후 다시 시도해 주세요.'); });
      if (!r) return;
      if (sequence.current === seq) {
        lastSearch.current = parameters;
        setPage(r.page); setIsEnd(r.isEnd);
        setResults((previous) => nextPage === 1 ? r.places : [...new Map([...previous, ...r.places].map((x) => [x.id, x])).values()]);
        // A keyword search may return places outside the current view; area searches keep it.
        if (!inArea) setFitKey(seq);
        setChosen(null);
        setSearched(true);
        setProviderMessage(r.searchContext?.message ?? '');
        setExcluded((old) => nextPage === 1 ? r.excludedOutsideSeoul ?? 0 : old + (r.excludedOutsideSeoul ?? 0));
        setHighlighted(undefined);
        setCollapsed(false);
      }
    });
  }
  useEffect(() => {
    if (!query.trim()) { sequence.current++; setResults([]); setSearched(false); setIsEnd(true); return; }
    const timer = setTimeout(() => { void search(false, 'all', query); }, 350);
    return () => { clearTimeout(timer); sequence.current++; };
  }, [query]);
  // Same place twice on one date is not allowed (screen 15); match by name and address.
  const alreadyOn = (place: any) =>
    !!place &&
    planned.some(
      (v) =>
        v.id !== p.visitId &&
        v.visitDate === date &&
        v.name?.trim() === place.name?.trim() &&
        (v.address ?? '').trim() === (place.address ?? '').trim(),
    );
  async function addPlace() {
    await save.run(async () => {
      validDate(date);
      if (!dateAllowed) throw new Error('선택한 날짜에는 장소를 추가할 수 없어요. 날짜별 장소에서 다시 선택해 주세요.');
      if (alreadyOn(manual ? { name, address } : chosen))
        throw new Error('같은 날짜에 이미 담은 장소예요. 다른 장소를 골라 주세요.');
      if (date < p.startDate || date > p.endDate)
        throw new Error('일정 기간 안의 방문 날짜를 선택해 주세요.');
      if (manual) {
        inputText(name, '장소 이름', 100);
        inputText(address, '주소', 200, false);
        if (
          (lat === '') !== (lng === '') ||
          (lat !== '' &&
            (!Number.isFinite(Number(lat)) ||
              !Number.isFinite(Number(lng)) ||
              Math.abs(Number(lat)) > 90 ||
              Math.abs(Number(lng)) > 180))
        )
          throw new Error('위도·경도를 함께 입력하고 범위를 확인해 주세요.');
      }
      const body: any = { visitDate: date };
      if (manual)
        body.manual = {
          name,
          address,
          ...(lat !== '' && lng !== '' ? { lat: Number(lat), lng: Number(lng) } : {}),
        };
      else body.providerPlaceId = chosen.id;
      await awaitOperation(await api(`/schedules/${p.id}/visits`, body));
      toast('장소를 추가했어요');
      router.back();
    });
  }
  const pinValid = () =>
    (lat === '') === (lng === '') &&
    (lat === '' ||
      (Number.isFinite(Number(lat)) && Number.isFinite(Number(lng)) && Math.abs(Number(lat)) <= 90 && Math.abs(Number(lng)) <= 180));
  /** Saves an edit or a replacement. Success is announced only after the server confirms it. */
  async function updateVisit(replacement?: any) {
    if (savingRef.current) return;
    lockEdits(true);
    try {
      await saveVisit(replacement);
    } finally {
      // A failed save leaves the form editable again.
      lockEdits(false);
    }
  }
  async function saveVisit(replacement?: any) {
    await save.run(async () => {
      if (!original) throw new Error('장소 정보를 다시 불러온 뒤 수정해 주세요.');
      if (!dateAllowed) throw new Error('취소되었거나 보관 기한이 지난 날짜의 장소는 수정할 수 없어요.');
      let body: Record<string, unknown>;
      if (replacement) {
        if (alreadyOn(replacement)) throw new Error('같은 날짜에 이미 담은 장소예요. 다른 장소를 골라 주세요.');
        body = { providerPlaceId: replacement.id, ...(plannedTime !== original.plannedTime ? { plannedTime } : {}) };
      } else {
        if (!pinValid()) throw new Error('지도에서 위치를 다시 지정해 주세요.');
        body = visitChanges(original, {
          name: inputText(name, '장소 이름', 100),
          address: inputText(address, '주소', 200, false),
          lat: lat === '' ? null : Number(lat),
          lng: lng === '' ? null : Number(lng),
          plannedTime,
        });
        if (!Object.keys(body).length) {
          router.back();
          return;
        }
      }
      try {
        await awaitOperation(await api(`/visits/${p.visitId}`, { expectedVersion: original.version, ...body }, 'PATCH'));
      } catch (e) {
        if (e instanceof ApiError && ['VERSION_CONFLICT', 'VISIT_HAS_RECORDS'].includes(e.code)) {
          const reloaded = await loadVisit(true).then(() => true, () => false);
          if (e.code === 'VISIT_HAS_RECORDS')
            throw new Error('사진·동영상 기록이나 올리는 중인 파일이 있어 다른 장소로 바꿀 수 없어요. 이름·주소·위치와 시간은 고칠 수 있어요.');
          // Only claim the latest values are shown when they were actually read.
          throw new Error(
            reloaded
              ? '다른 참여자가 이 장소를 먼저 바꿨어요. 내가 고친 내용은 그대로 두고 나머지는 최신 내용으로 바꿨어요. 확인한 뒤 다시 저장해 주세요.'
              : '다른 참여자가 이 장소를 먼저 바꿨지만 최신 내용을 불러오지 못했어요. 입력은 그대로 두었어요. 연결을 확인한 뒤 다시 저장해 주세요.',
          );
        }
        throw e;
      }
      toast(replacement ? '장소를 바꿨어요' : '장소를 수정했어요');
      router.back();
    });
  }
  async function locate() {
    if (savingRef.current) return;
    await a.run(async () => {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted)
        throw new Error('위치 권한이 꺼져 있어요. 지도 위치 기준으로 검색할 수 있어요.');
      const position = await Promise.race([
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
        new Promise<never>((_, reject) =>
          setTimeout(
            () =>
              reject(
                new Error('현재 위치를 가져오지 못했어요.'),
              ),
            15000,
          ),
        ),
      ]);
      setCenter({ lat: position.coords.latitude, lng: position.coords.longitude });
    });
  }
  return (
    <Screen
      title={editing ? '장소 수정' : manual ? '장소 직접 등록' : '장소 추가'}
      subtitle={`${scheduleTitle} · ${dateHeading(date)}`}
      headerRight={
        // A place with records keeps its place: only its details can be edited.
        editing && !replaceable ? undefined : (
          <TextButton disabled={locked} onPress={toggleManual}>{manual ? '검색' : editing ? '다른 장소로' : '직접'}</TextButton>
        )
      }
      footer={
        manual ? (
          <Button
            disabled={a.busy || save.busy || !dateAllowed || !name.trim() || (editing && !original)}
            onPress={() => (editing ? updateVisit() : addPlace())}
          >
            {editing ? (save.busy ? '저장하는 중…' : '수정 완료') : save.busy ? '등록하는 중…' : '장소 등록'}
          </Button>
        ) : undefined
      }
    >
      {editing && !!original && (
        <>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: colors.ink }}>방문 시간</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="방문 시간 수정"
              disabled={locked || a.busy || !dateAllowed}
              onPress={() => setTimeOpen(true)}
              style={{ minHeight: 48, justifyContent: 'center', paddingHorizontal: 12, borderRadius: 16, backgroundColor: colors.surface }}
            >
              <Text style={{ fontSize: 15, fontWeight: '800', color: plannedTime ? colors.ink : colors.muted }}>
                {plannedTime ?? '시간 미정'} ✎
              </Text>
            </Pressable>
          </View>
          {!replaceable && <P>사진·동영상 기록이 연결된 장소예요. 이름·주소·위치와 시간만 고칠 수 있어요.</P>}
          {!dateAllowed && <P>취소되었거나 보관 기한이 지난 날짜의 장소는 수정할 수 없어요.</P>}
          <TimeEditModal
            visible={timeOpen}
            placeName={name}
            value={plannedTime ?? undefined}
            onClose={() => setTimeOpen(false)}
            onSave={(time) => {
              if (savingRef.current) return;
              setPlannedTime(time ?? null);
              setTimeOpen(false);
            }}
          />
        </>
      )}
      {editing && !original ? null : manual ? (
        <>
          <Field
            label="장소 이름"
            required
            limit={100}
            value={name}
            editable={!locked}
            onChangeText={setName}
            placeholder="예: 우리만의 피크닉 자리"
          />
          <Field
            label="주소"
            hint="선택"
            value={address}
            editable={!locked}
            onChangeText={setAddress}
            placeholder="입력하지 않아도 괜찮아요"
          />
        </>
      ) : (
        <>
          <Field
            label="장소 검색"
            placeholder="장소를 검색하세요 (예: 성수 카페)"
            value={query}
            editable={!locked}
            onChangeText={(text) => { sequence.current++; setQuery(text); }}
            returnKeyType="search"
            onSubmitEditing={() => search()}
          />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <TextButton
              onPress={() => search()}
              disabled={locked || a.busy || (!query.trim() && category === 'all')}
            >
              검색
            </TextButton>
            <TextButton color={colors.sub} disabled={locked} onPress={locate}>
              ⌖ 현재 위치
            </TextButton>
          </View>
        </>
      )}
      {(!editing || !!original) && <PlaceMap
        center={center}
        places={manual ? [] : results}
        fitKey={fitKey}
        selectedId={chosen?.id ?? highlighted}
        pin={
          manual && lat && lng && Number.isFinite(Number(lat)) && Number.isFinite(Number(lng))
            ? { lat: Number(lat), lng: Number(lng) }
            : null
        }
        onSelect={(id) => {
          const p = results.find((p) => p.id === id);
          setHighlighted(id);
          setCollapsed(false);
          resultsScroll.current?.scrollTo({ y: resultPositions.current[id] ?? 0, animated: true });
          if (p) setCenter({ lat: p.lat, lng: p.lng });
        }}
        onRegion={(v) => {
          setCenter({ lat: v.lat, lng: v.lng });
          setBounds(v.bounds);
        }}
        onPin={(v) => {
          if (manual && !savingRef.current) {
            setLat(v.lat.toFixed(6));
            setLng(v.lng.toFixed(6));
          }
        }}
      />}
      {editing && !original ? null : manual ? (
        <>
          <P>{lat && lng ? '지도를 누르면 핀을 옮길 수 있어요. 위치는 선택 사항입니다.' : '지도에서 핀을 지정할 수 있어요. 위치는 선택 사항입니다.'}</P>
          {!!lat && !!lng && (
            <TextButton color={colors.sub} disabled={locked} onPress={() => { setLat(''); setLng(''); }}>
              핀 지우기
            </TextButton>
          )}
          <P>📅 선택한 날짜 · {dateHeading(date)}</P>
          <P>등록한 장소는 이 모임 안에서만 사용해요.</P>
        </>
      ) : (
        <>
          <View style={{ alignItems: 'center' }}>
            <Button
              small
              secondary
              disabled={a.busy || (!query.trim() && category === 'all')}
              onPress={() => search(true)}
            >
              ↻ 이 지역 다시 검색
            </Button>
          </View>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginTop: 16,
            }}
          >
            <H>검색 위치 기준 {results.length}곳</H>
            <TextButton
              color={colors.sub}
              onPress={() => { const next = sort === 'relevance' ? 'distance' : 'relevance'; setSort(next); void search(false, category, query, 1, next); }}
            >
              {sort === 'relevance' ? '관련도순' : '거리순'} ↕
            </TextButton>
          </View>
          {/* Shown right under the count so an empty result is visible without scrolling. */}
          {!!providerMessage && <P>{providerMessage}</P>}
          {searched && !a.busy && !a.error && !providerMessage && !results.length && (
            <P>서울특별시 안의 검색 결과가 없어요{excluded > 0 ? ` (서울 밖 ${excluded}곳 제외)` : ''}</P>
          )}
          {results.length > 0 && <TextButton onPress={() => setCollapsed(!collapsed)}>{collapsed ? '검색 결과 펼치기' : '검색 결과 접기'}</TextButton>}
          <ScrollView ref={resultsScroll} nestedScrollEnabled style={{ height: collapsed ? 84 : 150 }}>
          {results.map((r) => (
            <View key={r.id} onLayout={(e) => { resultPositions.current[r.id] = e.nativeEvent.layout.y; }}>
            <Card
              style={{
                borderWidth: 0,
                borderBottomWidth: 1,
                borderRadius: 0,
                paddingHorizontal: 0,
                backgroundColor: highlighted === r.id ? colors.sage : colors.bg,
              }}
              onPress={() => setChosen(r)}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <Text accessibilityLabel={placeCategory(r.category).label} style={{ fontSize: 24 }}>{placeCategory(r.category).icon}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 16, fontWeight: '700', color: colors.ink }}>
                    {r.name}
                  </Text>
                  <P>{placeCategory(r.category).label}</P>
                  <P>
                    {r.distance != null ? `${r.distance < 1000 ? `${Math.round(r.distance / 10) * 10}m` : `${(r.distance / 1000).toFixed(1)}km`} · ` : ''}
                    {r.address}
                  </P>
                </View>
                {alreadyOn(r) ? (
                  <Text style={{ fontSize: 12, color: colors.muted, fontWeight: '700' }}>✓ 스팟에 추가됨</Text>
                ) : (
                  <Button tone="outline" small onPress={() => setChosen(r)}>
                    + 스팟에 추가
                  </Button>
                )}
              </View>
            </Card>
            </View>
          ))}
          {!searched && <P>한 글자부터 장소를 추천해 드려요</P>}
          </ScrollView>
          {!isEnd && <Button secondary disabled={a.busy} onPress={() => search(false, category, query, page + 1)}>장소 더 보기</Button>}
          {searched && results.length > 0 && (
            <P>카카오맵 · 서울특별시 장소 검색 결과</P>
          )}
        </>
      )}
      <Sheet
        visible={!manual && !!chosen}
        title={chosen?.name ?? '장소 상세'}
        onClose={() => setChosen(null)}
      >
        <P>{placeCategory(chosen?.category).icon} {placeCategory(chosen?.category).label}</P>
        <P>📍 {chosen?.address}</P>
        {chosen?.attributions?.map((attribution: any, i: number) => (
          <P key={i}>{attribution.provider ?? attribution.providerUri ?? ''}</P>
        ))}
        <TextButton
          onPress={() =>
            Linking.openURL(
              `https://map.kakao.com/link/map/${encodeURIComponent(chosen.id)}`,
            )
          }
        >
          지도에서 보기
        </TextButton>
        <P>📅 선택한 날짜 · {dateHeading(date)}</P>
        {alreadyOn(chosen) && <P>같은 날짜에 이미 담은 장소예요.</P>}
        {editing ? (
          <Button disabled={a.busy || save.busy || !dateAllowed || !original || alreadyOn(chosen)} onPress={() => updateVisit(chosen)}>
            {save.busy ? '바꾸는 중…' : alreadyOn(chosen) ? '✓ 이 날의 장소에 추가됨' : '이 장소로 바꾸기'}
          </Button>
        ) : (
          <Button disabled={a.busy || save.busy || !dateAllowed || alreadyOn(chosen)} onPress={addPlace}>
            {save.busy ? '추가하는 중…' : alreadyOn(chosen) ? '✓ 이 날의 장소에 추가됨' : '이 날의 장소로 추가'}
          </Button>
        )}
        {a.errorView}
        {save.errorView}
      </Sheet>
      {a.errorView}
      {/* Shown once: inside the detail sheet while it is open, here otherwise. */}
      {!(!manual && chosen) && save.errorView}
    </Screen>
  );
}
