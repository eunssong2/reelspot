import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { colors } from './ui';
export function Avatar({ name, size = 48 }: { name: string; size?: number }) {
  return (
    <View
      accessibilityLabel={`${name} 기본 프로필`}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: '#FDEDEB',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ color: colors.accent, fontWeight: '800', fontSize: size * 0.38 }}>
        {Array.from(name)[0] || '나'}
      </Text>
    </View>
  );
}
export function MenuRow({
  label,
  value,
  onPress,
}: {
  label: string;
  value?: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 56,
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderColor: colors.line,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        opacity: pressed ? 0.65 : 1,
      })}
    >
      <Text style={{ fontSize: 16, color: colors.ink, flex: 1 }}>{label}</Text>
      <Text style={{ fontSize: value ? 13 : 24, color: colors.muted }}>{value || '›'}</Text>
    </Pressable>
  );
}
