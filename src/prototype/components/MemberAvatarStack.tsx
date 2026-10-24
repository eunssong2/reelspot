import { StyleSheet, Text, View } from 'react-native';

import type { TripMember } from '../mock/tripData';
import { colors } from '../styles/tokens';
import { Avatar } from './Avatar';

interface Props {
  members: TripMember[];
  size?: number;
  max?: number;
}

/** 겹쳐진 원형 프로필 사진들. 정원이 많으면 마지막 칸에 "+N" 을 보여준다. */
export function MemberAvatarStack({ members, size = 28, max = 4 }: Props) {
  const shown = members.slice(0, max);
  const rest = members.length - shown.length;

  return (
    <View style={styles.row}>
      {shown.map((member, i) => (
        <View key={member.id} style={[styles.ring, { marginLeft: i === 0 ? 0 : -size * 0.3 }]}>
          <Avatar uri={member.avatarUrl} size={size} />
        </View>
      ))}
      {rest > 0 ? (
        <View
          style={[
            styles.more,
            { width: size, height: size, borderRadius: size / 2, marginLeft: -size * 0.3 },
          ]}
        >
          <Text style={[styles.moreText, { fontSize: size * 0.38 }]}>+{rest}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  ring: { borderRadius: 999, borderWidth: 2, borderColor: colors.bg },
  more: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceStrong,
    borderWidth: 2,
    borderColor: colors.bg,
  },
  moreText: { fontWeight: '700', color: colors.textSub },
});
