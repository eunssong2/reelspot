import { useInitialize } from '../lib/effects';
import React, { useRef, useState } from 'react';
import { useLocalSearchParams, router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Text, TextInput, View } from 'react-native';
import { api, API } from '../lib/api';
import { inviteCodeHint, parseInviteInput } from '../lib/invite-input';
import { dDay } from '../lib/day-labels';
import { todayInSeoul } from '../lib/preferences';
import { useAccount } from '../lib/state';
import { Screen, Button, colors, s, useAction } from '../components/ui';
// A typed code keeps the label "코드 형식이 맞아요"; links and tokens stay opaque.
const isInviteCode = (value: string) => /^([A-Z0-9]{8}|[0-9A-F]{12})$/.test(value);
export default function Invite() {
  const params = useLocalSearchParams<{ token?: string; code?: string }>(),
    [token, setToken] = useState(params.token ?? params.code ?? ''),
    [opaqueToken, setOpaqueToken] = useState(!!params.token),
    [preview, setPreview] = useState<any>(null),
    generation = useRef(0);
  const { session, profile } = useAccount(),
    a = useAction({ inlineRetry: false });
  async function check(input = token, preserveToken = opaqueToken) {
    const request = ++generation.current;
    setToken(input);
    setOpaqueToken(preserveToken);
    setPreview(null);
    await a.run(async () => {
      await AsyncStorage.removeItem('atp.pending-invite');
      const value = parseInviteInput(input, API, preserveToken);
      const result = await api(`/invite-preview?tokenOrCode=${encodeURIComponent(value)}`);
      if (request !== generation.current) return;
      setToken(value);
      setOpaqueToken(preserveToken || !isInviteCode(value));
      setPreview(result);
      await AsyncStorage.setItem(
        'atp.pending-invite',
        JSON.stringify({ token: value, preview: result }),
      );
    });
  }
  useInitialize(() => {
    void a.run(async () => {
      let saved: any = null;
      try {
        saved = JSON.parse((await AsyncStorage.getItem('atp.pending-invite')) ?? 'null');
      } catch {
        await AsyncStorage.removeItem('atp.pending-invite');
      }
      const incoming = params.token ?? params.code;
      if (saved?.token && saved?.preview && (!incoming || incoming === saved.token)) {
        setToken(saved.token);
        setOpaqueToken(!isInviteCode(saved.token));
        setPreview(saved.preview);
      } else if (incoming) await check(incoming, !!params.token);
    });
  }, [params.token, params.code]);
  async function join() {
    if (!session || profile?.status === 'onboarding') {
      router.push(session ? '/onboarding' : '/login');
      return;
    }
    await a.run(async () => {
      const result = await api('/invitations/join', { tokenOrCode: token });
      await AsyncStorage.removeItem('atp.pending-invite');
      router.replace(`/group/${result.groupId}`);
    });
  }
  const hint = inviteCodeHint(opaqueToken ? '' : token),
    blocked = ['INVITE_REVOKED', 'INVITE_EXPIRED', 'INVITE_EXHAUSTED', 'INVITE_INVALID', 'GROUP_CLOSED', 'GROUP_FULL', 'REENTRY_BLOCKED'].includes(a.errorCode),
    x = preview?.scheduleSummary;
  const chip = (label: string, on: boolean) => (
    <Text
      style={{
        fontSize: 12,
        fontWeight: '700',
        color: on ? colors.accent : colors.sub,
        backgroundColor: on ? colors.sage : colors.surface,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 14,
        overflow: 'hidden',
      }}
    >
      {label}
    </Text>
  );
  return (
    <Screen
      compact
      title="초대 확인"
      footer={
        preview ? (
          <>
            <Button disabled={a.busy} onPress={join}>
              {!session
                ? '로그인하고 참여 계속하기'
                : profile?.status === 'onboarding'
                  ? '가입하고 참여 계속하기'
                  : preview.alreadyMember
                    ? '모임으로 가기 →'
                    : '모임 참여하기 →'}
            </Button>
            <Text style={{ fontSize: 12, color: colors.muted, textAlign: 'center' }}>
              {preview.alreadyMember
                ? '이미 참여 중인 모임이에요.'
                : '참여하면 모임 달력과 기록을 바로 볼 수 있어요.'}
            </Text>
          </>
        ) : blocked ? (
          <Button secondary onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}>
            닫기
          </Button>
        ) : undefined
      }
    >
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
        {chip('✉️ 초대장 확인', true)}
        {!!preview && chip('코드 확인 완료', false)}
      </View>
      <Text style={{ fontSize: 26, fontWeight: '800', color: colors.ink, letterSpacing: -0.5 }}>
        {preview ? '모임에 초대받았어요!' : '초대 코드를 입력해 주세요'}
      </Text>
      <Text style={{ fontSize: 14, color: colors.muted, marginTop: 8, marginBottom: 20 }}>
        초대 코드를 확인하고 모임에 참여해 보세요.
      </Text>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
        <Text style={[s.label, { color: colors.sub }]}>초대 코드</Text>
        {(hint.valid && hint.count > 0) || opaqueToken ? (
          <Text style={{ fontSize: 12, fontWeight: '700', color: colors.accent }}>
            ✓ {opaqueToken || hint.kind === 'link' ? '초대 링크를 확인했어요' : '코드 형식이 맞아요'}
          </Text>
        ) : null}
      </View>
      <View style={[s.input, { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 0 }]}>
        <Text style={{ fontSize: 18 }}>🔑</Text>
        <TextInput
          accessibilityLabel="초대 코드 또는 링크"
          placeholder="받은 코드 8자리"
          placeholderTextColor={colors.muted}
          value={opaqueToken && token.length > 16 ? '초대 링크' : token}
          editable={!a.busy}
          autoCapitalize="characters"
          autoCorrect={false}
          onChangeText={(v) => {
            generation.current++;
            setToken(/^[a-z][a-z0-9+.-]*:/i.test(v.trim()) ? v : v.toUpperCase());
            setOpaqueToken(false);
            setPreview(null);
            void AsyncStorage.removeItem('atp.pending-invite');
          }}
          style={{ flex: 1, minHeight: 60, fontSize: 22, fontWeight: '800', letterSpacing: 4, color: colors.ink }}
        />
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6, paddingHorizontal: 4 }}>
        <Text style={{ fontSize: 12, color: colors.muted }}>영문 대문자와 숫자 8자리 · 받은 링크도 붙여 넣을 수 있어요</Text>
        {hint.kind === 'code' && !opaqueToken && (
          <Text style={{ fontSize: 12, color: colors.muted }}>{Math.min(hint.count, 99)} / 8</Text>
        )}
      </View>
      {!preview && (
        <Button secondary disabled={a.busy || !token.trim()} onPress={() => check()} style={{ marginTop: 14 }}>
          확인
        </Button>
      )}
      {!!a.error && (
        <Text
          accessibilityRole="alert"
          style={{
            color: '#E5484D',
            fontWeight: '700',
            backgroundColor: '#FDE8EA',
            padding: 16,
            borderRadius: 14,
            overflow: 'hidden',
            marginVertical: 10,
          }}
        >
          {a.errorCode === 'INVITE_REVOKED' ? '취소된 초대예요. 새 초대를 받아 주세요.' : a.error}
        </Text>
      )}
      {preview && (
        <View
          style={{
            backgroundColor: colors.surface,
            borderRadius: 22,
            borderTopWidth: 6,
            borderTopColor: colors.accent,
            padding: 18,
            marginTop: 16,
          }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ fontSize: 12, fontWeight: '800', color: colors.accent }}>초대된 모임</Text>
            <Text style={{ fontSize: 12, fontWeight: '700', color: colors.sub }}>🔒 비공개 모임</Text>
          </View>
          <Text style={{ fontSize: 22, fontWeight: '800', color: colors.ink, marginTop: 8 }}>
            {preview.groupName}
          </Text>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              backgroundColor: 'white',
              borderRadius: 16,
              padding: 12,
              marginTop: 14,
            }}
          >
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                backgroundColor: colors.surface,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ fontSize: 18 }}>📅</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 11, color: colors.muted }}>일정</Text>
              <Text numberOfLines={1} style={{ fontSize: 14, fontWeight: '700', color: colors.ink }}>
                {x
                  ? `${x.title} · ${x.startDate.replaceAll('-', '.')}${x.endDate !== x.startDate ? `–${x.endDate.slice(5).replace('-', '.')}` : ''}`
                  : '아직 예정된 일정이 없어요'}
              </Text>
            </View>
            {x && (
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: '800',
                  color: colors.accent,
                  backgroundColor: colors.sage,
                  paddingHorizontal: 10,
                  paddingVertical: 5,
                  borderRadius: 12,
                  overflow: 'hidden',
                }}
              >
                {dDay(x.startDate, x.endDate, todayInSeoul())}
              </Text>
            )}
          </View>
          <View style={{ flexDirection: 'row', gap: 10, backgroundColor: colors.sage, borderRadius: 16, padding: 14, marginTop: 12 }}>
            <Text style={{ fontSize: 15 }}>🛡</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14, fontWeight: '800', color: colors.ink }}>
                {preview.alreadyMember ? '이미 참여 중인 모임이에요' : '참여 후에 장소와 기록을 볼 수 있어요'}
              </Text>
              <Text style={{ fontSize: 12, color: colors.sub, marginTop: 4, lineHeight: 18 }}>
                사진·참여자 목록·장소 계획은 참여한 사람에게만 보여요.
              </Text>
            </View>
          </View>
        </View>
      )}
      <View style={{ backgroundColor: colors.surface, borderRadius: 18, padding: 16, gap: 12, marginTop: 14 }}>
        <Text style={{ color: colors.sub, fontSize: 13 }}>✅　확인한 내용은 로그인 뒤에도 유지돼요.</Text>
        <Text style={{ color: colors.sub, fontSize: 13 }}>⏱　초대는 발급 후 7일 동안, 확인 50회까지 쓸 수 있어요.</Text>
      </View>
    </Screen>
  );
}
