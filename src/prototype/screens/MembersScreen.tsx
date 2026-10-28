import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppHeader } from '../components/AppHeader';
import { Avatar } from '../components/Avatar';
import { ScreenFrame } from '../components/ScreenFrame';
import { Toast, useToast } from '../components/Toast';
import { membersFor, TRIPS, type Itinerary } from '../mock/tripData';
import type { Nav } from '../navigation/routes';
import { usePrototype } from '../state/PrototypeProvider';
import { colors, GUTTER, MIN_TOUCH, radius } from '../styles/tokens';

/** 한 일정(모임)에 함께할 수 있는 최대 인원 안내 문구용. */
const MAX_MEMBERS = 10;

interface Props {
  nav: Nav;
  tripId: string;
  itinerary: Itinerary;
}

/** 함께하는 친구: 친구 초대(카카오톡·링크)와 참여한 사람 목록. */
export function MembersScreen({ nav, tripId, itinerary }: Props) {
  const toast = useToast();
  const { profile } = usePrototype();
  const trip = TRIPS.find((t) => t.id === tripId) ?? TRIPS[0];
  const members = membersFor(trip);

  // 초대는 서버·카카오 연동이 필요한 기능이라 아직 연결되지 않았다. 보낸 것처럼 꾸미지 않고 안내만 한다.
  const notReady = (label: string) => toast.show(`${label}은(는) 아직 연결되지 않았어요`);

  return (
    <ScreenFrame>
      <AppHeader title="" onBack={nav.back} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>{itinerary.name}</Text>

        <Text style={styles.sectionTitle}>
          함께하는 친구 <Text style={styles.count}>{members.length}</Text>
        </Text>
        <Text style={styles.desc}>
          함께할 친구나 가족을 초대해보세요.{'\n'}일정을 함께 기록할 수 있습니다. (최대 {MAX_MEMBERS}명)
        </Text>

        <View style={styles.inviteRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="카카오톡 초대"
            onPress={() => notReady('카카오톡 초대')}
            style={({ pressed }) => [styles.inviteBtn, styles.kakao, pressed && styles.pressed]}
          >
            <Text style={styles.kakaoText}>💬 카카오톡 초대</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="초대링크 복사"
            onPress={() => notReady('초대링크 복사')}
            style={({ pressed }) => [styles.inviteBtn, styles.link, pressed && styles.pressed]}
          >
            <Text style={styles.linkText}>🔗 초대링크 복사</Text>
          </Pressable>
        </View>
      </ScrollView>

      <View style={styles.divider} />

      <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
        {members.map((m) => (
          <View key={m.id} style={styles.memberRow}>
            <Avatar uri={m.isMe && profile.avatarUri ? profile.avatarUri : m.avatarUrl} size={40} />
            <Text style={styles.memberName} numberOfLines={1}>
              {m.isMe ? profile.nickname : m.name}
            </Text>
            {/* 닉네임이 이미 "나"이면 같은 글자를 두 번 보여 주지 않는다 */}
            {m.isMe && profile.nickname !== '나' ? <Text style={styles.meTag}>나</Text> : null}
          </View>
        ))}
      </ScrollView>

      <Toast message={toast.message} bottom={24} />
    </ScreenFrame>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: GUTTER, paddingTop: 8, paddingBottom: 24, gap: 10, flexGrow: 0 },
  title: { fontSize: 26, fontWeight: '800', color: colors.text, marginBottom: 18 },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: colors.text },
  count: { color: '#3B8EEA' },
  desc: { fontSize: 14, lineHeight: 21, color: colors.textMuted, marginBottom: 12 },
  inviteRow: { flexDirection: 'row', gap: 10 },
  inviteBtn: { flex: 1, minHeight: MIN_TOUCH - 10, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  kakao: { backgroundColor: '#FEE500' },
  kakaoText: { fontSize: 14, fontWeight: '800', color: '#3C1E1E' },
  link: { backgroundColor: colors.primary },
  linkText: { fontSize: 14, fontWeight: '800', color: colors.onPrimary },
  pressed: { opacity: 0.85 },
  divider: { height: 1, backgroundColor: '#F2F4F6' },
  list: { paddingHorizontal: GUTTER, paddingVertical: 8 },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 64,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F4F6',
  },
  memberName: { flexShrink: 1, fontSize: 15, fontWeight: '700', color: colors.text },
  meTag: { fontSize: 11, fontWeight: '700', color: colors.primary, backgroundColor: colors.primarySoft, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2 },
});
