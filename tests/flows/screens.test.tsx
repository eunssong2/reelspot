import React from 'react';
import { describe, test, expect, afterEach } from 'vitest';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { fixtures } from './setup';
import { AppState } from './native';
import { setParams, setFocused, router, removal } from './router';
import { UploadSheet } from '../../src/components/upload-sheet';
import Schedule from '../../src/app/schedule/[id]';
import Vlog from '../../src/app/vlog';
import LegacyUpload from '../../src/app/upload';
import Invites from '../../src/app/group/invites';
import { ApiError } from '../../src/lib/api';
import UploadDrafts from '../../src/app/upload-drafts';
import * as FS from 'expo-file-system/legacy';
import { LegacyDraftLink } from '../../src/components/legacy-draft-link';
import { listUploadDrafts, removeUploadDraft } from '../../src/lib/upload-draft';
import { uploadDraftKey } from '../../src/lib/upload-scope';
import { emptyDraft, defaultSetting, draftProblem } from '../../src/vlog/model';
let tree: ReactTestRenderer;
afterEach(async () => { if (tree) await act(async () => tree.unmount()); });
async function mount(node: React.ReactNode) { await act(async () => { tree = create(node); }); }
function textOf(node: any): string { return typeof node === 'string' ? node : (node.children ?? []).map(textOf).join(''); }
async function press(label: string) {
  const node = tree.root.findAll((n) => typeof n.type === 'string' && !!n.props.onPress && (n.props.accessibilityLabel === label || textOf(n) === label))[0];
  if (!node) throw new Error(`Missing button: ${label}`);
  expect(node.props.disabled).not.toBe(true);
  await act(async () => { await node.props.onPress(); });
}
const detail = () => ({
  schedule: { id: 'schedule', title: '여행', groupId: 'group', status: 'active', startDate: '2027-01-01', endDate: '2027-01-02' },
  retention: { expiresAt: '2099-01-01T00:00:00Z', lastDate: '2098-12-31' },
  days: [{ date: '2027-01-01', status: 'active', dayNo: 1 }, { date: '2027-01-02', status: 'active', dayNo: 2 }],
  plan: [{ date: '2027-01-01', title: '첫날', version: 1, visits: [{ id: 'A', name: 'A 장소', visitDate: '2027-01-01', plannedTime: null, version: 1 }] }],
});
function mockApi() {
  let data = detail();
  fixtures.api.mockImplementation(async (path, body, method) => {
    if (path.endsWith('/upload-limits?recordDate=2027-01-01&visitId=A') || path.includes('/upload-limits?')) return { photos: 5, videos: 2 };
    if (path === '/groups/group') return { id: 'group', name: '모임', ownerUserId: 'user' };
    if (path.endsWith('/members')) return { members: [] };
    if (path.endsWith('/days')) return { items: [{ scheduleId: 'schedule', scheduleTitle: '여행', day: data.days[0] }], nextCursor: null };
    if (path.includes('/media?')) return { items: [], nextCursor: null, groups: [], visibleCounts: { photos: 0, videos: 0 }, countsByVisit: [] };
    if (path === '/schedules/schedule') return data;
    if (method === 'PUT') { data = { ...data, plan: [{ ...data.plan[0], version: data.plan[0].version + 1, visits: data.plan[0].visits.map((v) => ({ ...v, plannedTime: body.visits.find((x: any) => x.id === v.id).plannedTime })) }] }; return data.plan[0]; }
    if (path.endsWith('/submissions')) return { tasks: body.files.map((f: any) => ({ id: f.clientFileId, clientFileId: f.clientFileId })), fileErrors: [] };
    throw new Error(`Unexpected request: ${path}`);
  });
}
const uploadProps = { visible: true, onClose() {}, scheduleId: 'schedule', recordDate: '2027-01-01', visitId: 'A' };
describe('actual upload sheet interactions (camera/storage/network mocked)', () => {
  test('legacy mixed candidates are discoverable and recover only into their original scope', async () => {
    mockApi();
    const oldA = { clientFileId: 'old-A', uri: 'file:A', name: 'A.jpg', recordDate: '2027-01-01', visitId: 'A' };
    const oldB = { clientFileId: 'old-B', uri: 'file:B', name: 'B.jpg', recordDate: '2027-01-02', visitId: 'B' };
    fixtures.storage.set('atp.upload-draft:user:schedule', JSON.stringify([oldA, oldB]));
    await mount(<UploadSheet {...uploadProps} visitId="B" recordDate="2027-01-02" />);
    await press('이전 업로드 후보 복구');
    expect(router.push).toHaveBeenCalledWith({ pathname: '/upload', params: { id: 'schedule' } });
    setParams({ id: 'schedule' });
    await act(async () => tree.update(<LegacyUpload />));
    await press('2027-01-01 · A 장소 · 업로드 시트로 이동');
    expect(JSON.parse(fixtures.storage.get(uploadDraftKey({ userId: 'user', scheduleId: 'schedule', recordDate: oldA.recordDate, visitId: oldA.visitId }))!)).toEqual([oldA]);
    expect(JSON.parse(fixtures.storage.get('atp.upload-draft:user:schedule')!)).toEqual([oldB]);
    expect(router.replace).toHaveBeenCalledWith({ pathname: '/schedule/[id]', params: { id: 'schedule', date: oldA.recordDate, recordVisit: 'A', openUpload: '1' } });
    expect(fixtures.api.mock.calls.some(([path]) => path.endsWith('/submissions'))).toBe(false);
  });
  test('closing a sheet retains A; leaving A for B discards A and submits only B', async () => {
    mockApi();
    fixtures.camera.mockResolvedValueOnce({ canceled: false, assets: [{ uri: 'file:A', fileName: 'A.jpg', mimeType: 'image/jpeg' }] })
      .mockResolvedValueOnce({ canceled: false, assets: [{ uri: 'file:B', fileName: 'B.jpg', mimeType: 'image/jpeg' }] });
    await mount(<UploadSheet {...uploadProps} />);
    await press('사진·동영상 추가'); await press('📷 사진 촬영');
    expect(router.push).not.toHaveBeenCalled();
    await act(async () => tree.update(<UploadSheet {...uploadProps} visible={false} />));
    await act(async () => tree.update(<UploadSheet {...uploadProps} />));
    expect(tree.root.findAll((n) => n.type === 'button' && n.props.children === '1개 업로드하기')).toHaveLength(1);
    await act(async () => tree.update(<UploadSheet {...uploadProps} visitId="B" recordDate="2027-01-02" />));
    await press('사진·동영상 추가'); await press('📷 사진 촬영'); await press('1개 업로드하기');
    const submissions = fixtures.api.mock.calls.filter(([path]) => path.endsWith('/submissions'));
    expect(submissions[0][1].files.map((f: any) => [f.uri, f.visitId, f.recordDate])).toEqual([['file:B', 'B', '2027-01-02']]);
    await act(async () => tree.update(<UploadSheet {...uploadProps} />));
    expect(tree.root.findAll((n) => n.type === 'button' && n.props.children === '1개 업로드하기')).toHaveLength(0);
    expect(fixtures.storage.has(uploadDraftKey({ userId: 'user', ...uploadProps }))).toBe(false);
  });
  test('camera cancellation preserves candidates and album actions select only the requested media type', async () => {
    mockApi(); fixtures.album.mockResolvedValue({ canceled: false, assets: [{ uri: 'file:photo', fileName: 'p.jpg', mimeType: 'image/jpeg' }] });
    fixtures.camera.mockResolvedValue({ canceled: true });
    await mount(<UploadSheet {...uploadProps} />);
    await press('사진·동영상 추가'); await press('🖼️ 사진 보관함에서 선택');
    expect(fixtures.album.mock.calls[0][0]).toMatchObject({ mediaTypes: ['images'], selectionLimit: 10 });
    await press('사진·동영상 추가'); await press('🎥 동영상 촬영');
    expect(fixtures.camera.mock.calls[0][0]).toMatchObject({ mediaTypes: ['videos'], videoMaxDuration: 60, cameraType: 'back' });
    await press('1개 업로드하기');
  });
  test('unconfirmed candidates remain visible with a nonempty recovery message', async () => {
    mockApi(); fixtures.camera.mockResolvedValue({ canceled: false, assets: [{ uri: 'file:A', fileName: 'A.jpg', mimeType: 'image/jpeg' }] });
    await mount(<UploadSheet {...uploadProps} />); await press('사진·동영상 추가'); await press('📷 사진 촬영');
    fixtures.api.mockResolvedValue({ tasks: [], fileErrors: [] });
    await press('1개 업로드하기');
    expect(tree.root.findByType('error').props.children).toContain('접수 결과');
    expect(tree.root.findAll((n) => n.type === 'button' && n.props.children === '1개 업로드하기')).toHaveLength(1);
  });
});
test('record view and sort survive opening a photo and returning; entering a new record screen resets them', async () => {
  mockApi(); setParams({ id: 'schedule', date: '2027-01-01' }); await mount(<Schedule />);
  await press('A 장소 기록'); await press('사람별'); await press('오래된순'); await press('사진 열기');
  await act(async () => setFocused(true));
  expect(tree.root.findByType('records').props).toMatchObject({ view: 'by_author', order: 'asc' });
  await press('뒤로'); await press('A 장소 기록');
  expect(tree.root.findByType('records').props).toMatchObject({ view: 'by_photo', order: 'desc' });
});
test('timeline wheel confirmation and unset write immediately; cancel performs no write', async () => {
  mockApi(); setParams({ id: 'schedule', date: '2027-01-01' }); await mount(<Schedule />);
  await press('A 장소 시간 수정'); await press('오전오후 오후'); await press('시 2'); await press('분 01'); await press('확인');
  let writes = fixtures.api.mock.calls.filter(([, , method]) => method === 'PUT');
  expect(writes[0][1]).toMatchObject({ title: '첫날', visits: [{ id: 'A', order: 0, plannedTime: '14:01' }], expectedVersion: 1 });
  await press('A 장소 시간 수정'); await press('시간 미정으로 두기');
  writes = fixtures.api.mock.calls.filter(([, , method]) => method === 'PUT'); expect(writes[1][1].visits[0].plannedTime).toBeNull(); expect(writes[1][1].expectedVersion).toBe(2);
  await press('A 장소 시간 수정'); await press('취소'); expect(fixtures.api.mock.calls.filter(([, , method]) => method === 'PUT')).toHaveLength(2);
});
const vlogDay = { key: 'schedule/2027-01-01', itineraryId: 'schedule', dayId: '2027-01-01', date: '2027-01-01', title: '첫날', cancelled: false, mediaCount: 1,
  places: [{ key: 'A', place: { id: 'A', name: 'A 장소' }, media: [{ item: { id: 'photo', kind: 'photo' as const, imageUrl: 'photo' }, memberId: 'user', time: '2027-01-01T00:00:00Z' }] }] };
test('background refresh keeps the current vlog step and does not ask to resume again', async () => {
  fixtures.source.mockResolvedValue({ group: { id: 'group', name: '모임' }, days: [vlogDay] }); setParams({ groupId: 'group' });
  await mount(<Vlog />);
  const checkbox = tree.root.findAll((n) => n.type === 'Pressable' && n.props.accessibilityRole === 'checkbox')[0];
  await act(async () => checkbox.props.onPress()); await press('1일의 장소 선택');
  expect(JSON.stringify(tree.toJSON())).toContain('날짜별 장소 선택');
  let resolve!: (data: any) => void;
  fixtures.source.mockImplementationOnce(() => new Promise((done) => { resolve = done; }));
  await act(async () => AppState.emit('active'));
  expect(JSON.stringify(tree.toJSON())).toContain('날짜별 장소 선택');
  await act(async () => resolve({ group: { id: 'group', name: '모임' }, days: [vlogDay] }));
  expect(JSON.stringify(tree.toJSON())).toContain('날짜별 장소 선택');
  expect(JSON.stringify(tree.toJSON())).not.toContain('작성 중인 브이로그가 있어요');
});
test('an unavailable saved day can be removed through the UI while preserving other edits', async () => {
  const valid = { ...defaultSetting(), done: true, captions: { photo: '보존할 자막' } };
  const draft = { ...emptyDraft('group'), dayKeys: ['old/2026-12-31', vlogDay.key], placeKeys: { [vlogDay.key]: ['A'] }, mediaIds: { A: ['photo'] }, settings: { A: valid } };
  fixtures.storage.set('atp.draft:user:vlog:v1:group', JSON.stringify({ group: draft }));
  fixtures.source.mockResolvedValue({ group: { id: 'group', name: '모임' }, days: [vlogDay] }); setParams({ groupId: 'group' });
  await mount(<Vlog />); await press('이어서 만들기'); await press('날짜 다시 선택'); await press('이 날짜 제외');
  const saved = JSON.parse(fixtures.storage.get('atp.draft:user:vlog:v1:group')!).group;
  expect(saved.dayKeys).toEqual([vlogDay.key]); expect(saved.settings.A.captions.photo).toBe('보존할 자막');
  expect(draftProblem(saved, [vlogDay])).toBeNull();
  await press('1일의 장소 선택');
});
test('a transient refresh error keeps the vlog step and retry restores data without remounting', async () => {
  const source = { group: { id: 'group', name: '모임' }, days: [vlogDay] };
  fixtures.source.mockResolvedValue(source); setParams({ groupId: 'group' }); await mount(<Vlog />);
  const checkbox = tree.root.findAll((n) => n.type === 'Pressable' && n.props.accessibilityRole === 'checkbox')[0];
  await act(async () => checkbox.props.onPress()); await press('1일의 장소 선택');
  fixtures.source.mockRejectedValueOnce(new Error('오프라인'));
  await act(async () => AppState.emit('active'));
  expect(JSON.stringify(tree.toJSON())).toContain('날짜별 장소 선택');
  expect(JSON.stringify(tree.toJSON())).toContain('오프라인');
  await press('다시 시도'); expect(JSON.stringify(tree.toJSON())).toContain('날짜별 장소 선택');
});
test('a missing selected place can be excluded without discarding the other completed place', async () => {
  const draft = { ...emptyDraft('group'), dayKeys: [vlogDay.key], placeKeys: { [vlogDay.key]: ['deleted-place', 'A'] }, mediaIds: { A: ['photo'] }, settings: { A: { ...defaultSetting(), done: true }, 'deleted-place': { ...defaultSetting(), done: true } } };
  fixtures.storage.set('atp.draft:user:vlog:v1:group', JSON.stringify({ group: draft }));
  fixtures.source.mockResolvedValue({ group: { id: 'group', name: '모임' }, days: [vlogDay] }); setParams({ groupId: 'group' });
  await mount(<Vlog />); await press('이어서 만들기'); await press('장소 다시 선택'); await press('이 장소 제외');
  const saved = JSON.parse(fixtures.storage.get('atp.draft:user:vlog:v1:group')!).group;
  expect(saved.placeKeys[vlogDay.key]).toEqual(['A']); expect(saved.settings.A.done).toBe(true); expect(draftProblem(saved, [vlogDay])).toBeNull();
});
test('owner restores a group cover from the invitation photo row; members have no restore control', async () => {
  let group = { id: 'group', name: '모임', ownerUserId: 'user', coverAssetId: 'cover', version: 4 };
  fixtures.api.mockImplementation(async (path, body, method) => {
    if (path.endsWith('/invites')) return { invites: [] };
    if (method === 'PATCH') { expect(body).toEqual({ restoreDefault: true, expectedVersion: 4 }); group = { ...group, coverAssetId: '', version: 5 }; }
    return group;
  });
  setParams({ id: 'group' }); await mount(<Invites />); await press('기본 이미지로 되돌리기');
  expect(fixtures.api.mock.calls.filter(([, , method]) => method === 'PATCH')).toHaveLength(1);
  expect(JSON.stringify(tree.toJSON())).toContain('모임 사진을 기본 이미지로 되돌렸어요.');
  expect(tree.root.findAll((n) => n.props.accessibilityLabel === '모임 대표 사진')).toHaveLength(0);
  await act(async () => tree.unmount()); group = { ...group, coverAssetId: 'cover', ownerUserId: 'another' };
  await mount(<Invites />);
  expect(JSON.stringify(tree.toJSON())).not.toContain('기본 이미지로 되돌리기');
});
test('partially deleted media in a completed resumed draft can be reselected and completed without discarding edits', async () => {
  const other = { ...vlogDay.places[0], key: 'B', place: { id: 'B', name: 'B 장소' }, media: [{ ...vlogDay.places[0].media[0], item: { id: 'other', kind: 'photo' as const, imageUrl: 'other' } }] };
  const day = { ...vlogDay, places: [...vlogDay.places, other] };
  const draft = { ...emptyDraft('group'), dayKeys: [day.key], placeKeys: { [day.key]: ['A', 'B'] }, mediaIds: { A: ['photo', 'deleted'], B: ['other'] }, settings: { A: { ...defaultSetting(), done: true, captions: { photo: '내 자막' } }, B: { ...defaultSetting(), done: true } } };
  fixtures.storage.set('atp.draft:user:vlog:v1:group', JSON.stringify({ group: draft }));
  fixtures.source.mockResolvedValue({ group: { id: 'group', name: '모임' }, days: [day] }); setParams({ groupId: 'group' });
  await mount(<Vlog />); await press('이어서 만들기'); await press('A 장소 기록 다시 선택');
  await press('삭제된 기록 1개가 빠졌어요. 이 장소에서 다른 기록으로 바꿔 주세요 · 확인');
  await press('1개로 템플릿 선택'); await press('이 장소 완료');
  const saved = JSON.parse(fixtures.storage.get('atp.draft:user:vlog:v1:group')!).group;
  expect(saved.mediaIds.A).toEqual(['photo']); expect(saved.settings.A.captions.photo).toBe('내 자막'); expect(saved.settings.B.done).toBe(true);
  expect(draftProblem(saved, [day])).toBeNull();
});
test('time conflict preserves wheel input and retries using the latest title, visit list and version', async () => {
  mockApi(); const original = fixtures.api.getMockImplementation()!;
  let conflict = false;
  const fresh = detail(); fresh.plan[0].version = 2; fresh.plan[0].title = '긴 제목'.repeat(20);
  fresh.plan[0].visits = [{ id: 'B', name: '새 장소', visitDate: '2027-01-01', plannedTime: '09:23' as any, version: 1 }, { ...fresh.plan[0].visits[0], plannedTime: '16:40' as any }];
  fixtures.api.mockImplementation(async (path, body, method) => {
    if (method === 'PUT' && !conflict) { conflict = true; throw new ApiError('VERSION_CONFLICT'); }
    if (conflict && path === '/schedules/schedule') return fresh;
    if (method === 'PUT') return {};
    return original(path, body, method);
  });
  setParams({ id: 'schedule', date: '2027-01-01' }); await mount(<Schedule />);
  await press('A 장소 시간 수정'); await press('오전오후 오후'); await press('시 2'); await press('분 01'); await press('확인');
  expect(JSON.stringify(tree.toJSON())).toContain('최신 계획'); expect(JSON.stringify(tree.toJSON())).toContain('새 장소 · 09:23');
  await press('확인');
  const writes = fixtures.api.mock.calls.filter(([, , method]) => method === 'PUT');
  expect(writes.map(([, body]) => body.expectedVersion)).toEqual([1, 2]);
  expect(writes[1][1]).toEqual({ expectedVersion: 2, title: fresh.plan[0].title, visits: [{ id: 'B', order: 0, plannedTime: '09:23' }, { id: 'A', order: 1, plannedTime: '14:01' }] });
});
test('failed conflict refresh retries reading before any write; a removed visit cannot be reintroduced', async () => {
  mockApi(); const original = fixtures.api.getMockImplementation()!; let conflict = false, reads = 0;
  const fresh = detail(); fresh.plan[0].version = 2; fresh.plan[0].visits = [];
  fixtures.api.mockImplementation(async (path, body, method) => {
    if (method === 'PUT') { conflict = true; throw new ApiError('VERSION_CONFLICT'); }
    if (conflict && path === '/schedules/schedule') { if (++reads === 1) throw new Error('offline'); return fresh; }
    return original(path, body, method);
  });
  setParams({ id: 'schedule', date: '2027-01-01' }); await mount(<Schedule />);
  await press('A 장소 시간 수정'); await press('확인'); await press('확인'); await press('확인');
  expect(reads).toBe(2);
  expect(fixtures.api.mock.calls.filter(([, , method]) => method === 'PUT')).toHaveLength(1);
  expect(JSON.stringify(tree.toJSON())).toContain('이 장소가 이동·삭제됐거나');
});
test('orphan candidates can be cleaned offline while queued copies, album originals and other accounts survive', async () => {
  const scope = { userId: 'user', scheduleId: 'deleted-schedule', recordDate: '2026-01-01', visitId: 'deleted-visit' };
  const files = ['orphan', 'queued'].map((id) => ({ uri: `file:private/uploads/user/${id}`, clientFileId: id, name: `${id}.jpg`, recordDate: scope.recordDate, visitId: scope.visitId }));
  files.push({ ...files[0], uri: 'file:album/original.jpg', clientFileId: 'album', name: 'album.jpg' });
  fixtures.storage.set(uploadDraftKey(scope), JSON.stringify(files));
  fixtures.storage.set('atp.queue:user', JSON.stringify({ task: { file: files[1] } }));
  fixtures.storage.set(uploadDraftKey({ ...scope, userId: 'other' }), JSON.stringify(files));
  await mount(<UploadDrafts />); await press('후보 정리');
  expect(fixtures.api).not.toHaveBeenCalled(); expect(FS.deleteAsync).toHaveBeenCalledExactlyOnceWith(files[0].uri, { idempotent: true });
  expect(fixtures.storage.has(uploadDraftKey(scope))).toBe(false);
  expect(fixtures.storage.has(uploadDraftKey({ ...scope, userId: 'other' }))).toBe(true);
  expect(fixtures.storage.has('atp.queue:user')).toBe(true);
});
test('cleanup refuses a changed snapshot instead of deleting newly selected files', async () => {
  const scope = { userId: 'user', scheduleId: 'schedule', recordDate: '2027-01-01', visitId: 'A' };
  fixtures.storage.set(uploadDraftKey(scope), JSON.stringify([{ uri: 'file:private/uploads/user/a', name: 'a', recordDate: scope.recordDate }]));
  const [saved] = await listUploadDrafts('user');
  fixtures.storage.set(uploadDraftKey(scope), JSON.stringify([{ uri: 'file:private/uploads/user/b', name: 'b', recordDate: scope.recordDate }]));
  await expect(removeUploadDraft('user', saved)).rejects.toThrow('후보가 바뀌었어요');
  expect(FS.deleteAsync).not.toHaveBeenCalled();
});
test('background and child-route focus changes retain candidates; actual unmount deletes private copies', async () => {
  mockApi(); fixtures.camera.mockResolvedValue({ canceled: false, assets: [{ uri: 'file:private/uploads/user/captured', fileName: 'p.jpg', mimeType: 'image/jpeg' }] });
  await mount(<UploadSheet {...uploadProps} />); await press('사진·동영상 추가'); await press('📷 사진 촬영');
  await act(async () => { AppState.emit('background'); AppState.emit('active'); });
  expect(tree.root.findAll((n) => n.type === 'button' && n.props.children === '1개 업로드하기')).toHaveLength(1);
  expect(fixtures.storage.has(uploadDraftKey({ userId: 'user', ...uploadProps }))).toBe(false);
  await act(async () => setFocused(false)); await act(async () => setFocused(true));
  expect(FS.deleteAsync).not.toHaveBeenCalled();
  expect(tree.root.findAll((n) => n.type === 'button' && n.props.children === '1개 업로드하기')).toHaveLength(1);
  await act(async () => tree.update(<></>));
  expect(FS.deleteAsync).toHaveBeenCalledWith('file:private/uploads/user/captured', { idempotent: true });
});
test('a late camera result after leaving the screen is discarded instead of restored on reentry', async () => {
  mockApi(); let resolve!: (value: any) => void;
  fixtures.camera.mockImplementation(() => new Promise((done) => { resolve = done; }));
  await mount(<UploadSheet {...uploadProps} />); await press('사진·동영상 추가');
  const capture = tree.root.findAll((n) => n.type === 'button' && n.props.children === '📷 사진 촬영')[0];
  let pending!: Promise<unknown>;
  await act(async () => { pending = capture.props.onPress(); });
  await act(async () => tree.update(<></>));
  await act(async () => { resolve({ canceled: false, assets: [{ uri: 'file:private/uploads/user/late', fileName: 'late.jpg', mimeType: 'image/jpeg' }] }); await pending; });
  await act(async () => setFocused(true));
  await act(async () => tree.update(<UploadSheet {...uploadProps} />));
  expect(FS.deleteAsync).toHaveBeenCalledWith('file:private/uploads/user/late', { idempotent: true });
  expect(tree.root.findAll((n) => n.type === 'button' && n.props.children === '1개 업로드하기')).toHaveLength(0);
});
test('multiple unreadable legacy lists can be removed explicitly without guessing file paths', async () => {
  fixtures.storage.set('atp.upload-draft:user:bad-a', '{broken');
  fixtures.storage.set('atp.upload-draft:user:bad-b', '{also-broken');
  const entries = await listUploadDrafts('user');
  expect(entries).toHaveLength(2);
  for (const entry of entries) await removeUploadDraft('user', entry);
  expect(await listUploadDrafts('user')).toHaveLength(0);
  expect(FS.deleteAsync).not.toHaveBeenCalled();
});
test('photo detail retains captured candidates; cancelling record exit preserves them and confirmed exit clears them', async () => {
  mockApi(); fixtures.camera.mockResolvedValue({ canceled: false, assets: [{ uri: 'file:private/uploads/user/keep', fileName: 'keep.jpg', mimeType: 'image/jpeg' }] });
  setParams({ id: 'schedule', date: '2027-01-01' }); await mount(<Schedule />);
  await press('A 장소 기록'); await press('＋ 사진·동영상 올리기'); await press('사진·동영상 추가'); await press('📷 사진 촬영'); await press('시트 닫기');
  await press('사진 열기'); await act(async () => setFocused(true));
  await press('＋ 사진·동영상 올리기');
  expect(tree.root.findAll((n) => n.type === 'button' && n.props.children === '1개 업로드하기')).toHaveLength(1);
  expect(FS.deleteAsync).not.toHaveBeenCalled(); await press('시트 닫기');
  await press('뒤로'); expect(JSON.stringify(tree.toJSON())).toContain('다시 가져올 수 없어요');
  await press('계속 담기'); expect(FS.deleteAsync).not.toHaveBeenCalled();
  await press('뒤로'); await press('비우고 나가기');
  expect(FS.deleteAsync).toHaveBeenCalledExactlyOnceWith('file:private/uploads/user/keep', { idempotent: true });
  await press('A 장소 기록'); await press('＋ 사진·동영상 올리기');
  expect(tree.root.findAll((n) => n.type === 'button' && n.props.children === '1개 업로드하기')).toHaveLength(0);
});
test('route removal waits for explicit discard; cancelling never dispatches the removal action', async () => {
  mockApi(); fixtures.camera.mockResolvedValue({ canceled: false, assets: [{ uri: 'file:private/uploads/user/remove', fileName: 'r.jpg', mimeType: 'image/jpeg' }] });
  setParams({ id: 'schedule', date: '2027-01-01' }); await mount(<Schedule />);
  await press('A 장소 기록'); await press('＋ 사진·동영상 올리기'); await press('사진·동영상 추가'); await press('📷 사진 촬영'); await press('시트 닫기');
  expect(removal.enabled).toBe(true);
  const action = { type: 'POP', payload: { count: 1 } };
  await act(async () => removal.callback({ data: { action } })); await press('계속 담기');
  expect(removal.dispatch).not.toHaveBeenCalled(); expect(FS.deleteAsync).not.toHaveBeenCalled();
  await act(async () => removal.callback({ data: { action } })); await press('비우고 나가기');
  expect(removal.dispatch).toHaveBeenCalledExactlyOnceWith(action);
  await act(async () => tree.update(<></>));
  expect(FS.deleteAsync).toHaveBeenCalledExactlyOnceWith('file:private/uploads/user/remove', { idempotent: true });
});
test('recovery and refresh notices are inside the safe screen body and expose 48dp actions', async () => {
  const draft = { ...emptyDraft('group'), dayKeys: [vlogDay.key], placeKeys: { [vlogDay.key]: ['A'] }, mediaIds: { A: ['photo', 'deleted'] }, settings: { A: { ...defaultSetting(), done: true } } };
  fixtures.storage.set('atp.draft:user:vlog:v1:group', JSON.stringify({ group: draft }));
  fixtures.source.mockResolvedValue({ group: { id: 'group', name: '모임' }, days: [vlogDay] }); setParams({ groupId: 'group' });
  await mount(<Vlog />); await press('이어서 만들기');
  fixtures.source.mockRejectedValueOnce(new Error('오프라인')); await act(async () => AppState.emit('active'));
  for (const label of ['A 장소 기록 다시 선택', '다시 시도']) {
    const action = tree.root.findAll((n) => n.type === 'Pressable' && n.props.accessibilityLabel === label)[0];
    expect(action.props.style.minHeight).toBeGreaterThanOrEqual(48);
    let parent = action.parent; let safe = false, scroll = false;
    while (parent) { safe ||= parent.type === 'safe'; scroll ||= typeof parent.type !== 'string' && !!parent.props.contentContainerStyle; parent = parent.parent; }
    expect(safe).toBe(true); expect(scroll).toBe(true);
  }
});
test('closing a failed time dialog clears its error before opening another place', async () => {
  mockApi(); const original = fixtures.api.getMockImplementation()!; const d = detail();
  d.plan[0].visits.push({ ...d.plan[0].visits[0], id: 'B', name: 'B 장소' });
  fixtures.api.mockImplementation(async (path, body, method) => {
    if (method === 'PUT') throw new ApiError('VERSION_CONFLICT');
    if (path === '/schedules/schedule') return d;
    return original(path, body, method);
  });
  setParams({ id: 'schedule', date: '2027-01-01' }); await mount(<Schedule />);
  await press('A 장소 시간 수정'); await press('확인');
  expect(JSON.stringify(tree.toJSON())).toContain('다른 참여자가 계획을 바꿨어요');
  expect(JSON.stringify(tree.toJSON())).not.toContain('버전 1');
  await press('취소'); await press('B 장소 시간 수정');
  expect(JSON.stringify(tree.toJSON())).not.toContain('다른 참여자가 계획을 바꿨어요');
});
test('legacy cleanup link is absent when empty and disappears after the last historic draft is removed', async () => {
  await mount(<LegacyDraftLink />); expect(tree.toJSON()).toBeNull();
  fixtures.storage.set('atp.upload-draft:user:old', JSON.stringify([{ uri: 'file:private/uploads/user/old', name: 'old.jpg', recordDate: '2026-01-01' }]));
  await act(async () => { setFocused(false); }); await act(async () => setFocused(true));
  expect(JSON.stringify(tree.toJSON())).toContain('이전 저장 후보 정리');
  fixtures.storage.clear(); await act(async () => setFocused(false)); await act(async () => setFocused(true));
  expect(tree.toJSON()).toBeNull();
});

describe('expired schedule stays on its guidance screen', () => {
  test('a fast device clock cannot expire records accepted by the server', async () => {
    mockApi(); setParams({id:'schedule'});
    const original=fixtures.api.getMockImplementation()!;
    fixtures.api.mockImplementation(async (path,...args) => path==='/schedules/schedule'
      ? {...detail(),retention:{expiresAt:'2020-01-01T00:00:00Z',lastDate:'2019-12-31'}} : original(path,...args));
    await mount(<Schedule />);
    expect(textOf(tree.toJSON())).not.toContain('기록 보관 기한이 지났어요');
    expect(fixtures.api.mock.calls.some(([path])=>path.includes('/media?'))).toBe(true);
    expect(router.replace).not.toHaveBeenCalled();
  });
  test('server expiry during media loading also shows expiry guidance', async () => {
    mockApi(); setParams({id:'schedule'});
    const original=fixtures.api.getMockImplementation()!;
    fixtures.api.mockImplementation(async (path,...args)=>{
      if(path.includes('/media?'))throw new ApiError('EXPIRED');
      return original(path,...args);
    });
    await mount(<Schedule />);
    expect(textOf(tree.toJSON())).toContain('기록 보관 기한이 지났어요');
    expect(router.replace).not.toHaveBeenCalled();
  });
});
