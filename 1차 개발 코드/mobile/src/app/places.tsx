import { useInitialize } from '../lib/effects';
import React, { useRef, useState } from 'react';
import { useLocalSearchParams, router } from 'expo-router';
import { Linking, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { PlaceMap } from '../components/place-map';
import { api, awaitOperation } from '../lib/api';
import { inputText, validDate, validTime } from '../lib/validation';
import { Screen, Button, Field, Card, H, P, useAction, s } from '../components/ui';
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
    [providerMessage, setProviderMessage] = useState('');
  const [center, setCenter] = useState({ lat: 37.5665, lng: 126.978 }),
    [bounds, setBounds] = useState(''),
    [sort, setSort] = useState('relevance');
  const sequence = useRef(0),
    a = useAction();
  useInitialize(() => {
    (async () => {
      const detail = await api(`/schedules/${p.id}`),
        first = detail.plan.flatMap((d: any) => d.visits).find((v: any) => v.lat != null);
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
        setChosen(null);
        setSearched(true);
        setProviderMessage(r.searchContext?.message ?? '');
      }
    });
  }
  return (
    <Screen title="어디로 갈까요?" subtitle="장소를 검색하거나 직접 등록해 보세요.">
      <View style={s.row}>
        <Button secondary onPress={() => setManual(false)}>
          장소 검색
        </Button>
        <Button secondary onPress={() => setManual(true)}>
          직접 등록
        </Button>
      </View>
      <PlaceMap
        center={center}
        places={manual ? [] : results}
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
      <Button
        secondary
        onPress={() =>
          a.run(async () => {
            const permission = await Location.requestForegroundPermissionsAsync();
            if (!permission.granted)
              throw new Error('위치 권한 없이도 검색과 직접 등록을 이용할 수 있습니다.');
            const position = await Promise.race([
              Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
              new Promise<never>((_, reject) =>
                setTimeout(
                  () =>
                    reject(
                      new Error(
                        '현재 위치를 확인하지 못했습니다. 검색 또는 직접 등록을 이용해 주세요.',
                      ),
                    ),
                  15000,
                ),
              ),
            ]);
            setCenter({ lat: position.coords.latitude, lng: position.coords.longitude });
          })
        }
      >
        현재 위치
      </Button>
      {!manual && (
        <Button
          secondary
          disabled={a.busy || (!query.trim() && category === 'all')}
          onPress={() => search(true)}
        >
          이 영역에서 검색
        </Button>
      )}
      {manual ? (
        <>
          <Field label="장소 이름" value={name} onChangeText={setName} />
          <Field label="주소 · 선택" value={address} onChangeText={setAddress} />
          <Field
            label="위도 · 선택"
            value={lat}
            onChangeText={setLat}
            keyboardType="numbers-and-punctuation"
          />
          <Field
            label="경도 · 선택"
            value={lng}
            onChangeText={setLng}
            keyboardType="numbers-and-punctuation"
          />
        </>
      ) : (
        <>
          <Field label="장소명 또는 주소" value={query} onChangeText={setQuery} />
          <View style={s.row}>
            {Object.entries({
              all: '전체',
              tourism: '관광지',
              restaurant: '맛집',
              cafe: '카페',
              lodging: '숙소',
            }).map(([c, label]) => (
              <Button
                secondary={category !== c}
                key={c}
                disabled={a.busy}
                onPress={() => {
                  setCategory(c);
                  if (c !== 'all') {
                    setQuery('');
                    search(true, c, '');
                  }
                }}
              >
                {label}
              </Button>
            ))}
          </View>
          <Button
            secondary
            disabled={a.busy || (!query.trim() && category === 'all')}
            onPress={() => search()}
          >
            검색
          </Button>
          <Button
            secondary
            onPress={() => setSort(sort === 'relevance' ? 'distance' : 'relevance')}
          >
            {sort === 'relevance' ? '관련도순' : '지도 중심 거리순'}
          </Button>
          {results.map((r) => (
            <Card key={r.id} onPress={() => setChosen(r)}>
              <H>
                {chosen?.id === r.id ? '✓ ' : ''}
                {r.name}
              </H>
              <P>{r.address}</P>
              {r.distance != null && (
                <P>
                  검색 당시 지도 중심에서{' '}
                  {r.distance >= 1000 ? `${(r.distance / 1000).toFixed(1)}km` : `${r.distance}m`}
                </P>
              )}
              {r.attributions?.map((a: any, i: number) => (
                <P key={i}>{a.provider ?? a.providerUri ?? ''}</P>
              ))}
              <Button
                secondary
                onPress={() =>
                  Linking.openURL(
                    provider === 'kakao'
                      ? `https://map.kakao.com/link/map/${encodeURIComponent(r.id)}`
                      : `https://www.google.com/maps/search/?api=1&query=${r.lat},${r.lng}&query_place_id=${encodeURIComponent(r.id)}`,
                  )
                }
              >
                지도에서 보기
              </Button>
            </Card>
          ))}
          {providerMessage && <P>{providerMessage}</P>}
          {searched && !a.busy && !a.error && !providerMessage && !results.length && (
            <P>검색 결과가 없습니다. 검색어를 바꾸거나 직접 등록해 주세요.</P>
          )}
          {searched && results.length > 0 && (
            <P>{provider === 'kakao' ? '카카오맵' : 'Google Maps'} 장소 검색 결과</P>
          )}
        </>
      )}
      <Field label="방문 날짜" value={date} onChangeText={setDate} />
      <Field
        label="예정 시각 · 5분 단위, 비우면 시간 미정"
        value={time}
        onChangeText={setTime}
        placeholder="10:00"
      />
      {a.errorView}
      <Button
        disabled={a.busy || (!manual && !chosen)}
        onPress={() =>
          a.run(async () => {
            validDate(date);
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
          })
        }
      >
        이 날짜에 장소 추가
      </Button>
    </Screen>
  );
}
