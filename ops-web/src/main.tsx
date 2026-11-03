import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import './style.css';
const API = import.meta.env.VITE_API_URL ?? 'https://sphan0325.ddns.net';
function App() {
  const [evidenceUrl, setEvidenceUrl] = useState('');
  const [token, setToken] = useState(''),
    [active, setActive] = useState(false),
    [data, setData] = useState<any>({ cases: [], recoveries: [] }),
    [selected, setSelected] = useState<any>(null),
    [detail, setDetail] = useState<any>(null),
    [reason, setReason] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [status, setStatus] = useState('');
  useEffect(() => {
    let active = true,
      url = '';
    setEvidenceUrl('');
    if (selected && detail?.evidenceSnapshot?.mime) {
      fetch(`${API}/v1/ops/cases/${selected.id}/evidence`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((r) => {
          if (!r.ok) throw new Error('증거 파일을 읽지 못했습니다.');
          return r.blob();
        })
        .then((blob) => {
          url = URL.createObjectURL(blob);
          if (active) setEvidenceUrl(url);
          else URL.revokeObjectURL(url);
        })
        .catch((e) => {
          if (active) setError(e.message);
        });
    }
    return () => {
      active = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [selected, detail, token]);
  async function api(path: string, body?: any) {
    const r = await fetch(API + '/v1' + path, {
      method: body ? 'POST' : 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body
          ? { 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() }
          : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const j = await r.json();
    if (!r.ok) throw new Error(`${j.code} · ${j.requestId ?? ''}`);
    return j;
  }
  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError('');
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function refresh() {
    setData(await api('/ops/cases'));
  }
  async function action(action: string) {
    await run(async () => {
      if (!reason.trim()) throw new Error('처리 사유를 입력해 주세요.');
      await api(`/ops/cases/${selected.id}/actions`, {
        action,
        reason,
        expectedVersion: selected.version,
      });
      setSelected(null);
      setDetail(null);
      setReason('');
      setStatus('처리 결과와 감사 이력을 저장했습니다.');
      await refresh();
    });
  }
  async function recovery(r: any, decision: string) {
    await run(async () => {
      if (!reason.trim()) throw new Error('결정 근거를 입력해 주세요.');
      const evidenceChecklist = {
        requesterVerified: true,
        candidateAgreed: !!r.candidate_consent_at,
        ownerNotified: !!r.notified_at,
        waitCompleted: !!r.response_due_at && new Date(r.response_due_at) < new Date(),
        disputeResolved: true,
      };
      if (
        decision === 'approve' &&
        !window.confirm(
          '요청자 신원·후임 의사·기존 방장 통지·대기 기간·이견 해소를 근거 자료로 확인했습니까?',
        )
      )
        return;
      await api(`/ops/recovery-requests/${r.id}/decision`, {
        decision,
        reason,
        evidenceChecklist,
        expectedGroupVersion: Number(r.group_version),
      });
      setStatus('복구 결정을 저장했습니다.');
      await refresh();
    });
  }
  return (
    <div className="shell">
      <aside>
        <div className="brand">
          At that place<span>운영 콘솔</span>
        </div>
        <p>
          기록을 안전하게
          <br />
          함께 보관하기 위해
        </p>
        {active && (
          <>
            <button onClick={() => run(refresh)} disabled={busy}>
              검토함 새로고침
            </button>
            <button
              className="muted"
              onClick={() => {
                setToken('');
                setActive(false);
                setData({ cases: [], recoveries: [] });
              }}
            >
              운영 세션 닫기
            </button>
          </>
        )}
      </aside>
      <main>
        <header>
          <span className="eyebrow">운영 · 신고와 복구</span>
          <h1>{active ? '검토가 필요한 요청' : '운영자 인증'}</h1>
          <p>판정 근거와 처리 결과를 기록하고 관련자에게 안내합니다.</p>
        </header>
        {!active ? (
          <form
            className="login"
            onSubmit={(e) => {
              e.preventDefault();
              run(async () => {
                await refresh();
                setActive(true);
              });
            }}
          >
            <label>
              운영자 OIDC 액세스 토큰
              <input
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                autoComplete="off"
                required
              />
            </label>
            <p>
              등록된 운영자 계정의 MFA 인증 토큰을 사용합니다. 개발 환경에서는 설정한 개발 운영
              토큰을 사용합니다.
            </p>
            <button disabled={busy}>검토함 열기</button>
          </form>
        ) : (
          <>
            <div className="metrics">
              <article>
                <b>
                  {data.cases.filter((c: any) => !['closed', 'decided'].includes(c.status)).length}
                </b>
                <span>신고·검사·문의</span>
              </article>
              <article>
                <b>{data.recoveries.length}</b>
                <span>방장 부재 복구</span>
              </article>
              <article>
                <b>
                  {
                    data.cases.filter(
                      (c: any) =>
                        new Date(c.review_due_at) < new Date() &&
                        !['closed', 'decided'].includes(c.status),
                    ).length
                  }
                </b>
                <span>검토 기한 초과</span>
              </article>
            </div>
            <section>
              <p>파일 정리 대기 {data.maintenance?.pending ?? 0}건 · 실패 {data.maintenance?.failed ?? 0}건 · 24시간 초과 {data.maintenance?.overdue ?? 0}건</p>
              <p>카카오 연결 해제 대기 {data.providerUnlinks?.pending ?? 0}건 · 확인 필요 {data.providerUnlinks?.attention ?? 0}건</p>
              <h2>신고·콘텐츠 검토</h2>
              <div className="tablewrap">
                <table>
                  <thead>
                    <tr>
                      <th>접수</th>
                      <th>종류</th>
                      <th>대상</th>
                      <th>상태</th>
                      <th>최초 검토 기한</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.cases.map((c: any) => (
                      <tr key={c.id}>
                        <td>
                          {new Date(c.created_at).toLocaleString('ko-KR', {
                            timeZone: 'Asia/Seoul',
                          })}
                        </td>
                        <td>{c.type}</td>
                        <td>{c.target_type}</td>
                        <td>
                          <span className={'badge ' + c.status}>{c.status}</span>
                        </td>
                        <td>
                          {new Date(c.review_due_at).toLocaleString('ko-KR', {
                            timeZone: 'Asia/Seoul',
                          })}
                        </td>
                        <td>
                          <button
                            className="small"
                            onClick={() =>
                              run(async () => {
                                setSelected(c);
                                setDetail(await api(`/ops/cases/${c.id}`));
                              })
                            }
                          >
                            검토
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!data.cases.length && <p className="empty">접수된 요청이 없습니다.</p>}
              </div>
            </section>
            {selected && (
              <section className="review">
                <div className="row">
                  <h2>요청 검토</h2>
                  <button className="muted small" onClick={() => setSelected(null)}>
                    닫기
                  </button>
                </div>
                <p className="code">{selected.id}</p>
                <p>{selected.reason}</p>{selected.reference_id && <p>관련 요청: {selected.reference_id}</p>}
                {detail?.evidenceSnapshot?.proposedInput && (
                  <pre style={{ whiteSpace: 'pre-wrap' }}>
                    {JSON.stringify(detail.evidenceSnapshot.proposedInput, null, 2)}
                  </pre>
                )}
                {evidenceUrl &&
                  (detail?.evidenceSnapshot?.mime?.startsWith('video/') ? (
                    <video
                      src={evidenceUrl}
                      controls
                      style={{ maxWidth: '100%', maxHeight: 420 }}
                    />
                  ) : (
                    <img
                      src={evidenceUrl}
                      alt="접수 시점의 검토 대상"
                      style={{ maxWidth: '100%', maxHeight: 420 }}
                    />
                  ))}
                <label>
                  처리 사유
                  <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    maxLength={2000}
                  />
                </label>
                <div className="actions">
                  {(selected.target_type === 'operation' || selected.target_type === 'task'
                    ? ['release', 'restrict']
                    : selected.target_type === 'user' || selected.target_type === 'member'
                      ? ['restrict_account', 'release_account', 'no_action']
                      : ['restrict', 'release', 'delete', 'no_action']
                  ).map((a) => (
                    <button key={a} disabled={busy} onClick={() => action(a)}>
                      {
                        (
                          {
                            release: '공개·제한 해제',
                            restrict: '접근 제한',
                            delete: '서버 파일 삭제',
                            restrict_account: '계정 이용 제한',
                            release_account: '계정 제한 해제',
                            no_action: '조치 없음',
                          } as any
                        )[a]
                      }
                    </button>
                  ))}
                </div>
                <h3>처리 이력</h3>
                {detail?.history.map((h: any) => (
                  <p key={h.occurred_at}>
                    {h.action} · {h.reason}
                  </p>
                ))}
              </section>
            )}
            <section>
              <h2>방장 부재 복구</h2>
              <label>
                복구 검토 근거
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="확인 자료와 결정 이유를 기록하세요."
                />
              </label>
              {data.recoveries.map((r: any) => (
                <article className="recovery" key={r.id}>
                  <div>
                    <span className="badge">{r.state}</span>
                    <p>{r.reason}</p>
                    <small>
                      요청 {r.id}
                      <br />
                      기존 방장 통지{' '}
                      {r.notified_at ? new Date(r.notified_at).toLocaleString('ko-KR') : '미완료'}
                      <br />
                      응답 기한{' '}
                      {r.response_due_at
                        ? new Date(r.response_due_at).toLocaleString('ko-KR')
                        : '대기 전'}
                    </small>
                  </div>
                  <div className="actions">
                    {!r.notified_at && (
                      <button
                        disabled={!r.candidate_consent_at || busy}
                        onClick={() =>
                          run(async () => {
                            await api(`/ops/recovery-requests/${r.id}/notice`, {});
                            await refresh();
                          })
                        }
                      >
                        기존 방장에게 통지
                      </button>
                    )}
                    <button disabled={busy} onClick={() => recovery(r, 'approve')}>
                      이전 승인
                    </button>
                    <button className="muted" disabled={busy} onClick={() => recovery(r, 'hold')}>
                      보류
                    </button>
                    <button className="muted" disabled={busy} onClick={() => recovery(r, 'reject')}>
                      반려
                    </button>
                  </div>
                </article>
              ))}
            </section>
          </>
        )}
        {error && (
          <div role="alert" className="error">
            {error}
          </div>
        )}
        {status && <p role="status">{status}</p>}
      </main>
    </div>
  );
}
createRoot(document.getElementById('root')!).render(<App />);
