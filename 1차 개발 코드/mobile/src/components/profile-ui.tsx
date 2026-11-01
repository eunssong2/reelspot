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
        backgroundColor: colors.accent,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <View
        style={{
          width: size * 0.32,
          height: size * 0.32,
          borderRadius: size,
          backgroundColor: 'white',
          position: 'absolute',
          top: size * 0.18,
        }}
      />
      <View
        style={{
          width: size * 0.64,
          height: size * 0.36,
          borderTopLeftRadius: size,
          borderTopRightRadius: size,
          backgroundColor: 'white',
          position: 'absolute',
          bottom: size * 0.08,
        }}
      />
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
      <Text style={{ fontSize: 14, color: colors.ink, flex: 1 }}>{label}</Text>
      <Text style={{ fontSize: value ? 13 : 24, color: colors.muted }}>{value || '›'}</Text>
    </Pressable>
  );
}
