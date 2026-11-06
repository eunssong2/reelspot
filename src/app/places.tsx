import { useInitialize } from '../lib/effects';
import React, { useRef, useState } from 'react';
import { useLocalSearchParams, router } from 'expo-router';
import { Linking, View, Text, ScrollView } from 'react-native';
import * as Location from 'expo-location';
import { useAppToast } from '../components/toast-provider';
import { dateHeading } from '../lib/day-labels';
import { PlaceMap } from '../components/place-map';
import { api, awaitOperation } from '../lib/api';
import { inputText, validDate } from '../lib/validation';
import {
  Screen,
  Button,
  Field,
  Card,
  H,
  P,
  useAction,
  Chip,
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
    }>(),
    [query, setQuery] = useState(''),
    [results, setResults] = useState<any[]>([]),
    [fitKey, setFitKey] = useState(0),
    [manual, setManual] = useState(false),
    [name, setName] = useState(''),
    [address, setAddress] = useState(''),
    [date] = useState(p.visitDate || p.startDate),
    [scheduleTitle, setScheduleTitle] = useState(''),
    [dateAllowed, setDateAllowed] = useState(false),
    [collapsed, setCollapsed] = useState(false),
    [lat, setLat] = useState(''),
    [lng, setLng] = useState(''),
    [category, setCategory] = useState('all'),
    [chosen, setChosen] = useState<any>(null),
    [highlighted, setHighlighted] = useState<string>(),
    [excluded, setExcluded] = useState(0),
    [searched, setSearched] = useState(false),
    [page, setPage] = useState(1),
    [isEnd, setIsEnd] = useState(true),
    [providerMessage, setProviderMessage] = useState(''),
    [planned, setPlanned] = useState<any[]>([]);
  const [center, setCenter] = useState({ lat: 37.5665, lng: 126.978 }),
    [bounds, setBounds] = useState(''),
    [sort, setSort] = useState('relevance');
  const toast = useAppToast();
  const resultsScroll = useRef<ScrollView>(null);
  const resultPositions = useRef<Record<string, number>>({});
  const sequence = useRef(0),
    a = useAction();
  useInitialize(() => {
    void a.run(async () => {
      const detail = await api(`/schedules/${p.id}`);
      setScheduleTitle(detail.schedule.title);
      setDateAllowed(detail.schedule.status === 'active' && (detail.days ?? detail.plan).some((d: any) => d.date === date && d.status !== 'cancelled'));
      setPlanned(detail.plan.flatMap((d: any) => d.visits.map((v: any) => ({ ...v, visitDate: d.date }))));
    });
  }, []);
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
      const r = await api(`/places?${parameters}&page=${nextPage}`).catch(() => { throw new Error('검색에 실패했어요. 잠시 후 다시 시도해 주세요.'); });
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
  // Same place twice on one date is not allowed (screen 15); match by name and address.
  const alreadyOn = (place: any) =>
    !!place &&
    planned.some(
      (v) =>
        v.visitDate === date &&
        v.name?.trim() === place.name?.trim() &&
        (v.address ?? '').trim() === (place.address ?? '').trim(),
    );
  async function addPlace() {
    await a.run(async () => {
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
  async function locate() {
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
      title={manual ? '장소 직접 등록' : '장소 추가'}
      subtitle={`${scheduleTitle} · ${dateHeading(date)}`}
      headerRight={
        <TextButton
          onPress={() => {
            setManual(!manual);
            setChosen(null);
          }}
        >
          {manual ? '검색' : '직접'}
        </TextButton>
      }
      footer={
        manual ? (
          <Button disabled={a.busy || !dateAllowed || !name.trim()} onPress={addPlace}>
            장소 등록
          </Button>
        ) : undefined
      }
    >
      {manual ? (
        <>
          <Field
            label="장소 이름"
            required
            limit={100}
            value={name}
            onChangeText={setName}
            placeholder="예: 우리만의 피크닉 자리"
          />
          <Field
            label="주소"
            hint="선택"
            value={address}
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
            onChangeText={setQuery}
            returnKeyType="search"
            onSubmitEditing={() => search()}
          />
          <ScrollView
            horizontal
            style={{ flexGrow: 0 }}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8, paddingBottom: 12 }}
          >
            {Object.entries({
              all: '전체',
              tourism: '관광지',
              restaurant: '맛집',
              cafe: '카페',
              lodging: '숙소',
            }).map(([c, label]) => (
              <Chip
                key={c}
                selected={category === c}
                onPress={() => {
                  setCategory(c);
                  if (c !== 'all') {
                    setSort('distance');
                    setQuery('');
                    void search(true, c, '');
                  } else if (query.trim()) void search(false, 'all');
                  else { sequence.current++; setResults([]); setSearched(false); setIsEnd(true); setChosen(null); }
                }}
              >
                {label}
              </Chip>
            ))}
          </ScrollView>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <TextButton
              onPress={() => search()}
              disabled={a.busy || (!query.trim() && category === 'all')}
            >
              검색
            </TextButton>
            <TextButton color={colors.sub} onPress={locate}>
              ⌖ 현재 위치
            </TextButton>
          </View>
        </>
      )}
      <PlaceMap
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
          if (manual) {
            setLat(v.lat.toFixed(6));
            setLng(v.lng.toFixed(6));
          }
        }}
      />
      {manual ? (
        <>
          <P>지도에서 핀을 지정할 수 있어요. 위치는 선택 사항입니다.</P>
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
          <TextButton onPress={() => setCollapsed(!collapsed)}>{collapsed ? '검색 결과 펼치기' : '검색 결과 접기'}</TextButton>
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
          {!searched && <P>장소를 검색하거나 카테고리를 눌러 보세요</P>}
          <TextButton onPress={() => { setManual(true); setChosen(null); }}>검색에 없나요? 직접 등록</TextButton>
          </ScrollView>
          {!isEnd && <Button secondary disabled={a.busy} onPress={() => search(false, category, query, page + 1)}>장소 더 보기</Button>}
          {!!providerMessage && <P>{providerMessage}</P>}
          {searched && !a.busy && !a.error && !providerMessage && !results.length && (
            <P>서울특별시 안의 검색 결과가 없어요 (서울 밖 {excluded}곳 제외)</P>
          )}
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
        <Button disabled={a.busy || !dateAllowed || alreadyOn(chosen)} onPress={addPlace}>
          {a.busy ? '추가하는 중…' : alreadyOn(chosen) ? '✓ 이 날의 장소에 추가됨' : '이 날의 장소로 추가'}
        </Button>
        {a.errorView}
      </Sheet>
      {a.errorView}
    </Screen>
  );
}
