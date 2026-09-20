import { StyleSheet, Text, View } from 'react-native';

import { colors, font } from '@/theme/theme';

export default function TripsScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>내 여행</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  text: { color: colors.text, fontSize: font.heading },
});
