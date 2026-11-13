import React from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { avatarSource } from '../lib/api';
import { colors } from './ui';
/** Profile photo when the user set one, otherwise an initial circle or the default figure. */
export function Avatar({
  name,
  size = 48,
  userId,
  avatarVersion,
  initial = false,
}: {
  name: string;
  size?: number;
  userId?: string | null;
  avatarVersion?: number | null;
  initial?: boolean;
}) {
  if (userId && avatarVersion != null)
    return (
      <Image
        accessibilityLabel={`${name} 프로필 사진`}
        source={avatarSource(userId, avatarVersion)}
        style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.surface }}
      />
    );
  if (initial)
    return (
      <View
        accessibilityLabel={`${name} 기본 프로필`}
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: colors.sage,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ color: colors.accent, fontWeight: '800', fontSize: size * 0.38 }}>
          {[...(name || '?')][0]}
        </Text>
      </View>
    );
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
  strong = false,
  valueColor,
  chevron = true,
}: {
  label: string;
  value?: string;
  onPress: () => void;
  /** Section-level row (e.g. 프로필 및 계정, 로그아웃) in bold. */
  strong?: boolean;
  valueColor?: string;
  chevron?: boolean;
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
      <Text
        style={{
          fontSize: strong ? 18 : 15,
          fontWeight: strong ? '800' : '400',
          color: colors.ink,
          flex: 1,
        }}
      >
        {label}
      </Text>
      {(!!value || chevron) && (
        <Text style={{ fontSize: value ? 14 : 24, color: valueColor ?? colors.muted }}>
          {value || '›'}
        </Text>
      )}
    </Pressable>
  );
}
/** Avatar with a camera badge; tapping it changes the photo. */
export function EditableAvatar({
  name,
  size,
  userId,
  avatarVersion,
  onPress,
  disabled,
}: {
  name: string;
  size: number;
  userId?: string | null;
  avatarVersion?: number | null;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="프로필 사진 변경"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({ opacity: pressed || disabled ? 0.7 : 1 })}
    >
      <Avatar initial name={name} size={size} userId={userId} avatarVersion={avatarVersion} />
      <View
        style={{
          position: 'absolute',
          right: -2,
          bottom: -2,
          width: size * 0.32,
          height: size * 0.32,
          borderRadius: size,
          backgroundColor: 'white',
          borderWidth: 1,
          borderColor: colors.line,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ fontSize: size * 0.15 }}>📷</Text>
      </View>
    </Pressable>
  );
}
