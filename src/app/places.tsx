import { useInitialize } from '../lib/effects';
import React, { useRef, useState } from 'react';
import { useLocalSearchParams, router } from 'expo-router';
import { Linking, View, Text, ScrollView } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { PlaceMap } from '../components/place-map';
import { api, awaitOperation } from '../lib/api';
import { inputText, validDate, validTime } from '../lib/validation';
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
    [date, setDate] = useState(p.visitDate || p.startDate),
    [time, setTime] = useState(''),
    [lat, setLat] = useState(''),
    [lng, setLng] = useState(''),
    [category, setCategory] = useState('all'),
    [chosen, setChosen] = useState<any>(null),
    [provider, setProvider] = useState('kakao'),
    [searched, setSearched] = useState(false),
    [providerMessage, setProviderMessage] = useState(''),
    [planned, setPlanned] = useState<any[]>([]);
  const [center, setCenter] = useState({ lat: 37.5665, lng: 126.978 }),
    [bounds, setBounds] = useState(''),
    [sort, setSort] = useState('relevance');
  const sequence = useRef(0),
    a = useAction();
  useInitialize(() => {
    (async () => {
      const detail = await api(`/schedules/${p.id}`),
        first = detail.plan.flatMap((d: any) => d.visits).find((v: any) => v.lat != null);
      setPlanned(detail.plan.flatMap((d: any) => d.visits.map((v: any) => ({ ...v, visitDate: d.date }))));
      if (first) setCenter({ lat: first.lat, lng: first.lng });
      else {
        const saved = await AsyncStorage.getItem('atp.last-map');
        if (saved) setCenter(JSON.parse(saved));
      }
    })().catch(() => {});
  }, []);
  async function search(inArea = false, selectedCategory = category, searchText = query) {
    const seq = ++sequence.current;
    await a.run(async () => {
      const r = await api(
        `/places?groupId=${p.groupId}&query=${encodeURIComponent(inputText(searchText, '검색어', 100, selectedCategory === 'all'))}&category=${encodeURIComponent(selectedCategory)}&sort=${sort}&center=${center.lng},${center.lat}${inArea && bounds ? `&bounds=${bounds}` : ''}`,
      );
      if (sequence.current === seq) {
        setProvider(r.provider);
        setResults(r.places);
        // A keyword search may return places outside the current view; area searches keep it.
        if (!inArea) setFitKey(seq);
        setChosen(null);
        setSearched(true);
        setProviderMessage(r.searchContext?.message ?? '');
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
      if (alreadyOn(manual ? { name, address } : chosen))
        throw new Error('같은 날짜에 이미 담은 장소예요. 다른 장소를 골라 주세요.');
      validTime(time);
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
      const body: any = { visitDate: date, plannedTime: time || null };
      if (manual)
        body.manual = {
          name,
          address,
          ...(lat !== '' && lng !== '' ? { lat: Number(lat), lng: Number(lng) } : {}),
        };
      else body.providerPlaceId = chosen.id;
      await awaitOperation(await api(`/schedules/${p.id}/visits`, body));
      router.back();
    });
  }
  async function locate() {
    await a.run(async () => {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted)
        throw new Error('위치 권한 없이도 검색과 직접 등록을 이용할 수 있습니다.');
      const position = await Promise.race([
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
        new Promise<never>((_, reject) =>
          setTimeout(
            () =>
              reject(
                new Error('현재 위치를 확인하지 못했습니다. 검색 또는 직접 등록을 이용해 주세요.'),
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
      subtitle={`${date || p.startDate} 방문`}
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
          <Button disabled={a.busy || !name.trim()} onPress={addPlace}>
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
                    setQuery('');
                    void search(true, c, '');
                  }
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
        selectedId={chosen?.id}
        pin={
          manual && lat && lng && Number.isFinite(Number(lat)) && Number.isFinite(Number(lng))
            ? { lat: Number(lat), lng: Number(lng) }
            : null
        }
        onSelect={(id) => {
          const p = results.find((p) => p.id === id);
          setChosen(p);
          if (p) setCenter({ lat: p.lat, lng: p.lng });
        }}
        onRegion={(v) => {
          setCenter({ lat: v.lat, lng: v.lng });
          setBounds(v.bounds);
          AsyncStorage.setItem('atp.last-map', JSON.stringify({ lat: v.lat, lng: v.lng }));
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
          <Field label="방문 날짜" value={date} onChangeText={setDate} />
          <Field
            label="예정 시각"
            helper="5분 단위 · 비우면 시간 미정"
            value={time}
            onChangeText={setTime}
            placeholder="시간 미정"
          />
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
            <H>장소 {results.length}곳</H>
            <TextButton
              color={colors.sub}
              onPress={() => setSort(sort === 'relevance' ? 'distance' : 'relevance')}
            >
              {sort === 'relevance' ? '관련도순' : '거리순'} ↕
            </TextButton>
          </View>
          {results.map((r) => (
            <Card
              key={r.id}
              style={{
                borderWidth: 0,
                borderBottomWidth: 1,
                borderRadius: 0,
                paddingHorizontal: 0,
              }}
              onPress={() => setChosen(r)}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 16, fontWeight: '700', color: colors.ink }}>
                    {r.name}
                  </Text>
                  <P>
                    {r.distance != null ? `${(r.distance / 1000).toFixed(1)}km · ` : ''}
                    {r.address}
                  </P>
                </View>
                {alreadyOn(r) ? (
                  <Text style={{ fontSize: 12, color: colors.muted, fontWeight: '700' }}>담은 장소</Text>
                ) : (
                  <Button tone="outline" small onPress={() => setChosen(r)}>
                    ＋ 추가
                  </Button>
                )}
              </View>
            </Card>
          ))}
          {!!providerMessage && <P>{providerMessage}</P>}
          {searched && !a.busy && !a.error && !providerMessage && !results.length && (
            <P>검색 결과가 없습니다. 검색어를 바꾸거나 직접 등록해 주세요.</P>
          )}
          {searched && results.length > 0 && (
            <P>{provider === 'kakao' ? '카카오맵' : 'Google Maps'} 장소 검색 결과</P>
          )}
        </>
      )}
      <Sheet
        visible={!manual && !!chosen}
        title={chosen?.name ?? '장소 상세'}
        onClose={() => setChosen(null)}
      >
        <P>{chosen?.address}</P>
        {chosen?.attributions?.map((attribution: any, i: number) => (
          <P key={i}>{attribution.provider ?? attribution.providerUri ?? ''}</P>
        ))}
        <TextButton
          onPress={() =>
            Linking.openURL(
              provider === 'kakao'
                ? `https://map.kakao.com/link/map/${encodeURIComponent(chosen.id)}`
                : `https://www.google.com/maps/search/?api=1&query=${chosen.lat},${chosen.lng}&query_place_id=${encodeURIComponent(chosen.id)}`,
            )
          }
        >
          지도에서 보기
        </TextButton>
        <Field label="방문 날짜" value={date} onChangeText={setDate} />
        <Field
          label="예정 시각"
          value={time}
          onChangeText={setTime}
          placeholder="시간 미정"
          helper="5분 단위 · 비우면 시간 미정"
        />
        {alreadyOn(chosen) && <P>같은 날짜에 이미 담은 장소예요.</P>}
        <Button disabled={a.busy || alreadyOn(chosen)} onPress={addPlace}>
          이 날짜에 장소 추가
        </Button>
        {a.errorView}
      </Sheet>
      {a.errorView}
    </Screen>
  );
}
