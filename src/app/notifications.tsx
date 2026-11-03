import { useFocusLoad } from '../lib/effects';
import React, { useState } from 'react';
import { router } from 'expo-router';
import { api } from '../lib/api';
import { formatMoment } from '../lib/preferences';
import { Screen, Button, Card, H, P, useAction } from '../components/ui';
export default function Notifications() {
  const [notices, setNotices] = useState<any[]>([]), [reports, setReports] = useState<any[]>([]), [next, setNext] = useState<string | null>(null), [reportsNext, setReportsNext] = useState<string | null>(null);
  const a = useAction();
  async function loadNotices(cursor?: string) { const r = await api(`/me/notifications${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`); setNotices((old) => cursor ? [...old,...r.notifications] : r.notifications); setNext(r.nextCursor); }
  async function loadReports(cursor?: string) { const r = await api(`/me/reports${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`); setReports((old) => cursor ? [...old,...r.reports] : r.reports); setReportsNext(r.nextCursor); }
  useFocusLoad(() => { a.run(async () => { await Promise.all([loadNotices(), loadReports()]); }); }, []);
  return <Screen title="알림과 처리 결과">
    {notices.map((n) => <Card key={n.id}><H>{n.readAt ? '' : '• '}{n.message}</H><P>{formatMoment(n.createdAt)}</P>
      {n.kind.startsWith('recovery_') && n.referenceId && <Button secondary onPress={() => router.push({ pathname: '/recovery', params: { requestId: n.referenceId } })}>복구 요청 확인·응답</Button>}
      {!n.readAt && <Button secondary disabled={a.busy} onPress={() => a.run(async () => { await api(`/me/notifications/${n.id}/reading`, {}); await loadNotices(); })}>읽음 표시</Button>}
    </Card>)}
    {next && <Button secondary disabled={a.busy} onPress={() => a.run(() => loadNotices(next))}>알림 더 보기</Button>}
    <H>내 신고·문의</H>
    {reports.map((r) => <Card key={r.id}><H>{({ received: '접수됨', reviewing: '검토 중', decided: '결정됨', closed: '처리 완료' } as Record<string,string>)[r.state] ?? r.state}</H><P>{r.reason}</P><P>접수 {formatMoment(r.createdAt)} · 검토 기한 {formatMoment(r.reviewDueAt)}</P><P>문의 번호 {r.id}</P>{r.referenceId && <P>관련 요청 {r.referenceId}</P>}{r.decisionReason && <P>처리 결과: {r.decisionReason}</P>}
      <Button secondary onPress={() => router.push({ pathname: '/inquiry', params: { referenceId: r.id, category: 'report' } })}>이 건에 대해 추가 문의·이의</Button>
    </Card>)}
    {reportsNext && <Button secondary disabled={a.busy} onPress={() => a.run(() => loadReports(reportsNext))}>신고·문의 더 보기</Button>}
    {a.hasRun && !a.busy && !a.error && !reports.length && !notices.length && <P>새 알림이나 접수한 요청이 없습니다.</P>}
    {a.errorView}
  </Screen>;
}
