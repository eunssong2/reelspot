import * as Clipboard from 'expo-clipboard';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';

import { AppHeader } from '../components/AppHeader';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { ActionButton, Pill } from '../components/FormParts';
import { ScreenFrame } from '../components/ScreenFrame';
import { Toast, useToast } from '../components/Toast';
import {
  INVITE_MAX_USES,
  inviteExpiresAt,
  inviteLink,
  inviteState,
  MAX_MEMBERS,
  type Group,
  type Invite,
  type InviteState,
} from '../mock/groupData';
import type { Nav } from '../navigation/routes';
import { commonErrorText, newRequestKey, representativeSchedule, useGroups } from '../state/GroupsProvider';
import { colors, GUTTER, radius } from '../styles/tokens';
import { periodLabel, stamp } from '../utils/calendar';
import { pickPhoto } from '../utils/profilePhoto';

const STATE_LABEL: Record<InviteState, string> = { active: '사용 가능', exhausted: '소진', expired: '만료', revoked: '취소' };

/**
 * UI23 초대 발급과 관리(공유하기). 디자인: docs/stitch/UI23_초대_발급과_관리.html
 * 방장을 포함한 모든 현재 참여자가 같은 모임의 초대를 발급·공유·복사·취소한다.
 * 공유 메시지에는 모임명·일정 요약·링크·코드만 담는다.
 */
export function InviteManageScreen({ nav, group }: { nav: Nav; group: Group }) {
  const { invitesOf, loadInvites, createInvite, revokeInvite, schedulesOf, setGroupCover } = useGroups();
  const toast = useToast();
  const [now, setNow] = useState(Date.now());
  const [issuing, setIssuing] = useState(false);
  const [revoking, setRevoking] = useState<Invite | null>(null);
  const [revokeBusy, setRevokeBusy] = useState(false);
  const [status, setStatus] = useState<'loading' | 'ok' | 'error'>('loading');
  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  /** 새 초대 발급 요청 키: 응답이 끊겨 다시 보내도 초대가 하나만 생긴다. 성공하면 새 키로 바꾼다. */
  const issueKey = useRef(newRequestKey());

  const statusRef = useRef(status);
  statusRef.current = status;

  const refresh = useCallback(async () => {
    const result = await loadInvites(group.id);
    if (result.ok) return setStatus('ok');
    // 이미 목록을 보여 주는 중이면 목록은 그대로 두고 안내만 한다.
    if (statusRef.current === 'ok') setActionError(`초대 목록을 새로 불러오지 못했어요. ${commonErrorText(result.error)}`);
    else {
      setLoadError(commonErrorText(result.error));
      setStatus('error');
    }
  }, [group.id, loadInvites]);

  // 들어올 때·돌아올 때 다시 조회한다.
  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  // 보는 동안 만료 시각이 지나면 상태가 바뀌도록 1분마다 다시 그린다.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  const invites = invitesOf(group.id);
  const current = invites.find((i) => inviteState(i, now) === 'active');
  const others = invites.filter((i) => i !== current);
  const full = group.members.length >= MAX_MEMBERS;
  const rep = representativeSchedule(schedulesOf(group.id));

  const link = (invite: Invite) => inviteLink(invite.code);

  const message = (invite: Invite) =>
    [
      `[At that place] '${group.name}'에 초대해요.`,
      rep ? `일정: ${rep.schedule.title} (${periodLabel(rep.schedule.startDate, rep.schedule.endDate)})` : null,
      `링크를 누르거나 앱에서 코드 ${invite.code} 를 입력하세요.`,
      link(invite),
      `${stamp(inviteExpiresAt(invite))}까지 참여할 수 있어요.`,
    ]
      .filter(Boolean)
      .join('\n');

  // 모임 사진 바꾸기(방장). 앨범에서 고르면 4:3 으로 잘라 내 모임 목록의 카드에도 같이 바뀐다.
  const changeCover = async () => {
    const result = await pickPhoto([4, 3]);
    if (!result) return;
    if ('error' in result) {
      toast.show(result.error);
      return;
    }
    setGroupCover(group.id, result.uri);
    toast.show('모임 사진을 바꿨어요');
  };

  const copy = async (text: string, done: string) => {
    await Clipboard.setStringAsync(text);
    toast.show(done);
  };

  const share = async (invite: Invite) => {
    try {
      // 공유 시트를 닫거나 취소해도 초대는 그대로다(공유 취소 ≠ 초대 취소).
      await Share.share({ message: message(invite) });
      refresh(); // 공유 시트에서 돌아오면 확인 횟수 등 최신 상태로
    } catch {
      toast.show('공유할 수 없어요. 링크 복사를 이용해 주세요');
    }
  };

  const issue = async () => {
    setIssuing(true);
    setActionError(null);
    try {
      const result = await createInvite(group.id, issueKey.current);
      if (result.ok) {
        issueKey.current = newRequestKey();
        toast.show('새 초대를 만들었어요');
      } else {
        setActionError(
          result.error === 'GROUP_CLOSED'
            ? '종료된 모임이라 초대할 수 없어요.'
            : `초대를 만들지 못했어요. ${commonErrorText(result.error)}`,
        );
      }
    } finally {
      setIssuing(false);
    }
  };

  const revoke = async () => {
    if (!revoking) return;
    setRevokeBusy(true);
    setActionError(null);
    const result = await revokeInvite(revoking.id, revoking.version);
    setRevokeBusy(false);
    setRevoking(null);
    if (result.ok) return toast.show('초대를 취소했어요');
    if (result.error === 'VERSION_CONFLICT') {
      await refresh();
      toast.show('초대 상태가 바뀌어 다시 불러왔어요');
      return;
    }
    setActionError(`초대를 취소하지 못했어요. ${commonErrorText(result.error)}`);
  };

  return (
    <ScreenFrame>
      <AppHeader title="모임에 초대하기" onBack={nav.back} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {group.myRole === 'owner' ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="모임 사진 변경"
            onPress={changeCover}
            style={({ pressed }) => [styles.coverRow, pressed && styles.coverPressed]}
          >
            <View style={styles.coverThumb}>
              {group.cover ? (
                <Image source={group.cover} style={styles.coverImg} resizeMode="cover" />
              ) : (
                <Text style={styles.coverFallback}>{group.name.slice(0, 1)}</Text>
              )}
            </View>
            <View style={styles.coverText}>
              <Text style={styles.coverTitle}>모임 사진</Text>
              <Text style={styles.coverHint}>내 모임 목록에 보이는 대표 사진이에요</Text>
            </View>
            <Text style={styles.coverAction}>변경</Text>
          </Pressable>
        ) : null}

        <View style={styles.context}>
          <View style={styles.groupPill}>
            <Text style={styles.groupPillText}>👥 {group.name}</Text>
          </View>
          <Text style={styles.contextText}>
            현재 {group.members.length}/{MAX_MEMBERS}명 · 초대는 7일 · 확인 {INVITE_MAX_USES}회까지
          </Text>
          {full ? <Text style={styles.fullText}>지금은 정원이 다 찼어요. 자리가 나야 새로 참여할 수 있어요.</Text> : null}
        </View>

        {actionError ? (
          <View style={styles.actionError} accessibilityRole="alert">
            <Text style={styles.actionErrorText}>{actionError}</Text>
          </View>
        ) : null}

        {status === 'loading' ? (
          <View style={styles.loading}>
            <ActivityIndicator color={colors.primary} accessibilityLabel="초대를 불러오는 중" />
          </View>
        ) : status === 'error' ? (
          <View style={styles.emptyCard} accessibilityRole="alert">
            <Text style={styles.emptyTitle}>초대를 불러오지 못했어요</Text>
            <Text style={styles.emptyBody}>{loadError}</Text>
            <ActionButton
              label="다시 시도"
              tone="secondary"
              onPress={() => {
                setStatus('loading');
                refresh();
              }}
              style={styles.retry}
            />
          </View>
        ) : current ? (
          <View style={styles.currentCard}>
            <View style={styles.currentHead}>
              <View style={styles.row}>
                <Text style={styles.currentLabel}>초대 코드</Text>
                <Pill label="사용 가능" tone="coral" />
              </View>
            </View>

            <Pressable
              onPress={() => copy(current.code, '코드를 복사했어요')}
              accessibilityRole="button"
              accessibilityLabel={`초대 코드 ${current.code.split('').join(' ')}, 눌러서 복사`}
              style={({ pressed }) => [styles.codeBox, pressed && styles.codeBoxPressed]}
            >
              <Text style={styles.code}>{current.code}</Text>
              <Text style={styles.codeHint}>👆 탭하여 코드 복사하기</Text>
            </Pressable>

            <View style={styles.metrics}>
              <View style={styles.metricRow}>
                <Text style={styles.metricText}>발급 {stamp(current.issuedAt)}</Text>
                <Text style={styles.metricText}>만료 {stamp(inviteExpiresAt(current))}</Text>
              </View>
              <View style={styles.progress}>
                <View style={[styles.progressFill, { width: `${(current.useCount / INVITE_MAX_USES) * 100}%` }]} />
              </View>
              <View style={styles.metricRow}>
                <Text style={styles.metricLabel}>👁 확인 횟수</Text>
                <Text style={styles.metricValue}>
                  <Text style={styles.metricStrong}>{current.useCount}</Text> / {INVITE_MAX_USES}회
                  {INVITE_MAX_USES - current.useCount <= 10 ? ` · ${INVITE_MAX_USES - current.useCount}회 남음` : ''}
                </Text>
              </View>
            </View>

            <View style={styles.buttons}>
              <ActionButton
                label="링크 복사"
                icon="🔗"
                tone="secondary"
                onPress={() => copy(link(current), '링크를 복사했어요')}
                style={styles.flex}
              />
              <ActionButton label="공유하기" icon="↗" onPress={() => share(current)} style={styles.flex} />
            </View>

            <Pressable onPress={() => setRevoking(current)} accessibilityRole="button" style={styles.revoke} hitSlop={6}>
              <Text style={styles.revokeText}>이 초대 취소하기 ›</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>지금 사용할 수 있는 초대가 없어요</Text>
            <Text style={styles.emptyBody}>새 초대를 발급해 링크를 보내 보세요.</Text>
          </View>
        )}

        <View style={styles.notice}>
          <Text style={styles.noticeIcon}>ℹ️</Text>
          <Text style={styles.noticeText}>받은 사람이 다른 사람에게 전달하면 그 사람도 참여할 수 있어요.</Text>
        </View>

        {status === 'ok' && others.length ? (
          <View style={styles.history}>
            <View style={styles.row}>
              <Text style={styles.historyTitle}>이전 초대</Text>
              <Pill label={String(others.length)} />
            </View>
            {others.map((inv) => (
              <InviteRow key={inv.id} invite={inv} now={now} onShare={() => share(inv)} onRevoke={() => setRevoking(inv)} />
            ))}
          </View>
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
        <ActionButton label="새 초대 발급하기" icon="＋" tone="dark" onPress={issue} loading={issuing} />
        <Text style={styles.footerHint}>새 코드를 만들어도 기존 초대는 그대로 쓸 수 있어요</Text>
      </View>

      <ConfirmDialog
        visible={revoking !== null}
        warning
        title="이 초대를 취소할까요?"
        subtitle={revoking?.code}
        body="이 링크와 코드로는 더 이상 참여할 수 없어요. 이미 참여한 사람은 그대로예요."
        onRequestClose={() => setRevoking(null)}
        buttons={[
          { label: '초대 취소', tone: 'danger', onPress: revoke, loading: revokeBusy },
          { label: '돌아가기', tone: 'plain', onPress: () => setRevoking(null) },
        ]}
      />

      <Toast message={toast.message} bottom={130} />
    </ScreenFrame>
  );
}

function InviteRow({
  invite,
  now,
  onShare,
  onRevoke,
}: {
  invite: Invite;
  now: number;
  onShare: () => void;
  onRevoke: () => void;
}) {
  const st = inviteState(invite, now);
  const active = st === 'active';
  const left = INVITE_MAX_USES - invite.useCount;
  return (
    <View style={[styles.inviteRow, !active && styles.inviteRowOff]}>
      <View style={styles.inviteHead}>
        <View style={styles.row}>
          <Text style={[styles.inviteCode, st === 'revoked' && styles.strike]}>{invite.code}</Text>
          <Pill
            label={st === 'exhausted' ? `소진 ${invite.useCount}/${INVITE_MAX_USES}` : STATE_LABEL[st]}
            tone={active ? 'coral' : 'gray'}
          />
        </View>
        {active ? (
          <View style={styles.row}>
            <Pressable
              onPress={onShare}
              accessibilityRole="button"
              accessibilityLabel={`${invite.code} 공유`}
              style={styles.smallBtn}
            >
              <Text style={styles.smallBtnText}>공유</Text>
            </Pressable>
            <Pressable
              onPress={onRevoke}
              accessibilityRole="button"
              accessibilityLabel={`${invite.code} 취소`}
              style={styles.smallBtn}
            >
              <Text style={[styles.smallBtnText, styles.danger]}>취소</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
      <Text style={styles.inviteMeta}>
        {stamp(invite.issuedAt)} 발급 → {stamp(inviteExpiresAt(invite))} 만료
      </Text>
      <Text style={[styles.inviteMeta, active && left <= 10 && styles.inviteWarn]}>
        확인 {invite.useCount}/{INVITE_MAX_USES}회{active && left <= 10 ? ` · ${left}회 남음` : ''}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  content: { paddingHorizontal: GUTTER, paddingBottom: 24, gap: 14 },
  coverRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.surface, borderRadius: radius.item, padding: 12 },
  coverPressed: { opacity: 0.85 },
  coverThumb: { width: 56, height: 42, borderRadius: 10, overflow: 'hidden', backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  coverImg: { width: 56, height: 42 },
  coverFallback: { fontSize: 16, fontWeight: '800', color: colors.primary },
  coverText: { flex: 1, gap: 2 },
  coverTitle: { fontSize: 15, fontWeight: '800', color: colors.text },
  coverHint: { fontSize: 12, color: colors.textSub },
  coverAction: { fontSize: 14, fontWeight: '700', color: colors.primary },
  context: { gap: 8 },
  groupPill: {
    alignSelf: 'flex-start',
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  groupPillText: { fontSize: 12, fontWeight: '700', color: colors.textSub },
  contextText: { fontSize: 13, color: colors.textSub },
  fullText: { fontSize: 13, color: colors.textMuted },
  loading: { paddingVertical: 40, alignItems: 'center' },
  retry: { alignSelf: 'stretch', marginTop: 6 },
  actionError: { backgroundColor: '#FDE7E9', borderRadius: 12, padding: 12 },
  actionErrorText: { fontSize: 13, lineHeight: 19, fontWeight: '600', color: colors.danger },
  currentCard: { backgroundColor: colors.surface, borderRadius: radius.card, padding: 18, gap: 14 },
  currentHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  currentLabel: { fontSize: 15, fontWeight: '700', color: colors.text },
  codeBox: { backgroundColor: colors.bg, borderRadius: radius.item, paddingVertical: 18, alignItems: 'center', gap: 6 },
  codeBoxPressed: { backgroundColor: colors.primarySoft },
  code: { fontSize: 28, fontWeight: '800', letterSpacing: 6, color: colors.text, fontVariant: ['tabular-nums'], paddingLeft: 6 },
  codeHint: { fontSize: 11, fontWeight: '600', color: colors.primary },
  metrics: { gap: 8 },
  metricRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  metricText: { fontSize: 13, color: colors.textSub },
  metricLabel: { fontSize: 12, color: colors.textSub },
  metricValue: { fontSize: 13, fontWeight: '600', color: colors.text },
  metricStrong: { color: colors.primary, fontWeight: '800' },
  progress: { height: 8, borderRadius: 4, backgroundColor: colors.surfaceStrong, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 4, backgroundColor: colors.primary },
  buttons: { flexDirection: 'row', gap: 10 },
  revoke: { alignSelf: 'center', minHeight: 36, justifyContent: 'center', paddingHorizontal: 8 },
  revokeText: { fontSize: 13, fontWeight: '700', color: colors.danger },
  emptyCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    paddingVertical: 28,
    paddingHorizontal: 18,
    alignItems: 'center',
    gap: 6,
  },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  emptyBody: { fontSize: 13, color: colors.textMuted },
  notice: { flexDirection: 'row', gap: 8, backgroundColor: colors.surface, borderRadius: radius.item, padding: 14 },
  noticeIcon: { fontSize: 14, lineHeight: 20 },
  noticeText: { flex: 1, fontSize: 13, lineHeight: 20, color: colors.textSub },
  history: { gap: 10, marginTop: 8 },
  historyTitle: { fontSize: 17, fontWeight: '800', color: colors.text },
  inviteRow: { backgroundColor: colors.surface, borderRadius: radius.item, padding: 14, gap: 6 },
  inviteRowOff: { opacity: 0.75 },
  inviteHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  inviteCode: { fontSize: 16, fontWeight: '800', letterSpacing: 2, color: colors.text },
  strike: { textDecorationLine: 'line-through', color: colors.textMuted },
  smallBtn: {
    minHeight: 36,
    minWidth: 48,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: colors.bg,
  },
  smallBtnText: { fontSize: 12, fontWeight: '700', color: colors.text },
  danger: { color: colors.danger },
  inviteMeta: { fontSize: 12, color: colors.textMuted },
  inviteWarn: { color: colors.primary, fontWeight: '700' },
  footer: {
    paddingHorizontal: GUTTER,
    paddingTop: 10,
    paddingBottom: 12,
    gap: 6,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  footerHint: { fontSize: 11, color: colors.textMuted, textAlign: 'center' },
});
