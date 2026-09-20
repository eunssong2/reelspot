import { StyleSheet, Text, View } from 'react-native';

import type { ItineraryPlace } from '../mock/tripData';

/** 장소 썸네일(이모지 + 배경색). 일정 카드와 장소 시트에서 쓴다. */
export function PlaceThumb({ place, size = 48 }: { place: ItineraryPlace; size?: number }) {
  return (
    <View style={[styles.box, { width: size, height: size, backgroundColor: place.tint }]}>
      <Text style={{ fontSize: size * 0.5 }}>{place.emoji}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
});
