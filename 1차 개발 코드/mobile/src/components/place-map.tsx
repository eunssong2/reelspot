import React, { useEffect, useRef } from 'react';
import { View } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE, type Region } from 'react-native-maps';
import { P } from './ui';
export function PlaceMap({ center, places, selectedId, pin, onSelect, onRegion, onPin }: {
  center: { lat: number; lng: number }; places: any[]; selectedId?: string;
  pin?: { lat: number; lng: number } | null;
  onSelect: (id: string) => void;
  onRegion: (value: { lat: number; lng: number; bounds: string }) => void;
  onPin?: (p: { lat: number; lng: number }) => void;
}) {
  const ref = useRef<MapView>(null);
  const key = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
  useEffect(() => { ref.current?.animateCamera({ center: { latitude: center.lat, longitude: center.lng } }, { duration: 250 }); }, [center.lat, center.lng]);
  if (!key) return <View style={{ padding: 16, backgroundColor: '#E7EBDD', borderRadius: 12 }}><P>Google 지도 연결이 준비되지 않았습니다. 이름·주소·좌표를 직접 입력해 장소를 등록할 수 있어요.</P></View>;
  const region = (r: Region) => onRegion({ lat: r.latitude, lng: r.longitude,
    bounds: [r.longitude - r.longitudeDelta / 2, r.latitude - r.latitudeDelta / 2, r.longitude + r.longitudeDelta / 2, r.latitude + r.latitudeDelta / 2].join(',') });
  return <View style={{ height: 280, borderRadius: 12, overflow: 'hidden' }}>
    <MapView ref={ref} provider={PROVIDER_GOOGLE} style={{ flex: 1 }}
      initialRegion={{ latitude: center.lat, longitude: center.lng, latitudeDelta: .04, longitudeDelta: .04 }}
      onRegionChangeComplete={region} onPress={(e) => onPin?.({ lat: e.nativeEvent.coordinate.latitude, lng: e.nativeEvent.coordinate.longitude })}
      showsUserLocation={false} showsMyLocationButton={false} toolbarEnabled={false}>
      {places.filter((p) => p.lat != null && p.lng != null).map((p) => <Marker key={p.id} identifier={p.id}
        coordinate={{ latitude: Number(p.lat), longitude: Number(p.lng) }} title={p.name} description={p.address}
        pinColor={p.id === selectedId ? '#AB4C43' : '#53604C'} onPress={() => onSelect(p.id)} />)}
      {pin && <Marker coordinate={{ latitude: pin.lat, longitude: pin.lng }} title="직접 지정한 위치" pinColor="#AB4C43" />}
    </MapView>
  </View>;
}
