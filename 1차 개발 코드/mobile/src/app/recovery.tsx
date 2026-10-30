import { useInitialize } from '../lib/effects';
import React, { useState } from 'react';
import { useLocalSearchParams, router } from 'expo-router';
import { api } from '../lib/api';
import { reauth } from '../lib/social';
import { Screen, Field, Button, Card, H, P, useAction } from '../components/ui';
export default function Recovery() {
  const { groupId, requestId } = useLocalSearchParams<{ groupId?: string; requestId?: string }>(),
    [members, setMembers] = useState<any[]>([]),
    [candidate, setCandidate] = useState(''),
    [reason, setReason] = useState(''),
    [request, setRequest] = useState<any>(null);
  const a = useAction();
  useInitialize(() => {
    a.run(async () => {
      if (groupId)
        setMembers(
          (await api(`/groups/${groupId}/members`)).members.filter((m: any) => !m.isOwner),
        );
      if (requestId) setRequest(await api(`/recovery-requests/${requestId}`));
    });
  }, []);
  return (
    <Screen
      title="방장 부재 복구 문의"
      subtitle="운영자가 확인 자료·후임 동의·기존 방장 통지와 7일 대기를 거쳐 수동으로 검토합니다."
    >
      {request ? (
        <Card>
          <H>{request.state}</H>
          <P>{request.decisionSummary ?? '확인 중입니다.'}</P>
          <P>
            통지 {request.noticeAt ?? '대기 전'} · 응답 기한 {request.responseDueAt ?? '대기 전'}
          </P>
          {request.canConsent && <Button
            secondary
            onPress={() =>
              a.run(async () => {
                await api(`/recovery-requests/${requestId}/candidate-consent`, {
                  agreed: !request.candidateConsentAt,
                  reauthProof: await reauth(),
                });
                setRequest(await api(`/recovery-requests/${requestId}`));
              })
            }
          >
            {request.candidateConsentAt ? '후임 후보 동의 철회' : '후임 후보 동의'}
          </Button>}
          {request.canRespond && <><Field label="기존 방장 응답 사유" value={reason} onChangeText={setReason} />
          {['agree', 'object', 'contacted'].map((response) => (
            <Button
              secondary
              key={response}
              onPress={() =>
                a.run(async () => {
                  await api(`/recovery-requests/${requestId}/owner-response`, { response, reason });
                  setRequest(await api(`/recovery-requests/${requestId}`));
                })
              }
            >
              {
                (
                  { agree: '이전에 동의', object: '이의 제기', contacted: '운영자와 연락함' } as any
                )[response]
              }
            </Button>
          ))}</>}
        </Card>
      ) : (
        <>
          <Field
            label="부재 사유·확인 자료 설명"
            multiline
            value={reason}
            onChangeText={setReason}
          />
          <H>후임 후보</H>
          {members.map((m) => (
            <Button key={m.id} secondary={candidate !== m.id} onPress={() => setCandidate(m.id)}>
              {m.displayName}
            </Button>
          ))}
          <Button
            disabled={!candidate || !reason.trim() || a.busy}
            onPress={() =>
              a.run(async () => {
                const r = await api(`/groups/${groupId}/recovery-requests`, {
                  candidateMembershipId: candidate,
                  reason,
                  evidenceRefs: [],
                  reauthProof: await reauth(),
                });
                router.replace({ pathname: '/recovery', params: { requestId: r.requestId } });
              })
            }
          >
            복구 검토 요청
          </Button>
        </>
      )}
      {a.errorView}
    </Screen>
  );
}
