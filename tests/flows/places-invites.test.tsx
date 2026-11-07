import React from 'react';
import { afterEach, expect, test, vi } from 'vitest';
import { act, create } from 'react-test-renderer';
import { fixtures } from './setup';
import { setParams } from './router';
import Places from '../../src/app/places';
import Invites from '../../src/app/group/invites';
const clipboard = vi.hoisted(() => ({ write: vi.fn() }));
vi.mock('expo-clipboard', () => ({ setStringAsync: clipboard.write }));
vi.mock('expo-location', () => ({}));
vi.mock('../../src/components/place-map', () => ({ PlaceMap: (props: any) => <map {...props} /> }));
let tree: any;
afterEach(async () => { if (tree) await act(async () => tree.unmount()); vi.useRealTimers(); });
function text(n: any): string { return typeof n === 'string' ? n : (n.children ?? []).map(text).join(''); }
const button = (name: string) => tree.root.findAll((n: any) => n.type === 'button' && text(n) === name)[0];
test('one-character place search debounces input and clears results when erased', async () => {
  vi.useFakeTimers(); setParams({id:'s',groupId:'g',visitDate:'2026-11-06'});
  fixtures.api.mockImplementation(async(path:string)=>path.startsWith('/places?')
    ? {places:[{id:'p',name:'서울숲',lat:37.5,lng:127}],page:1,isEnd:true}
    : {schedule:{title:'일정',status:'active'},days:[{date:'2026-11-06',status:'active'}],plan:[]});
  await act(async()=>{tree=create(<Places/>);});
  await act(async()=>tree.root.findByType('input').props.onChangeText('서'));
  await act(async()=>vi.advanceTimersByTimeAsync(349));
  expect(fixtures.api.mock.calls.filter(([p])=>p.startsWith('/places?'))).toHaveLength(0);
  await act(async()=>vi.advanceTimersByTimeAsync(1));
  expect(fixtures.api.mock.calls.filter(([p])=>p.startsWith('/places?'))).toHaveLength(1);
  expect(JSON.stringify(tree.toJSON())).toContain('서울숲');
  await act(async()=>tree.root.findByType('input').props.onChangeText(''));
  await act(async()=>vi.advanceTimersByTimeAsync(350));
  expect(tree.root.findByType('map').props.places).toEqual([]);
});
test('a late failed search cannot replace a newer successful result with an error', async () => {
  vi.useFakeTimers();setParams({id:'s',groupId:'g',visitDate:'2026-11-06'});
  let rejectOld:(e:Error)=>void=()=>{};
  let searches=0;
  fixtures.api.mockImplementation(async(path:string)=>{
    if(!path.startsWith('/places?'))return {schedule:{status:'active'},days:[],plan:[]};
    if(++searches===1)return new Promise((_,reject)=>{rejectOld=reject;});
    return {places:[{id:'new',name:'새 결과',lat:37.5,lng:127}],page:1,isEnd:true};
  });
  await act(async()=>{tree=create(<Places/>);});
  await act(async()=>tree.root.findByType('input').props.onChangeText('서'));
  await act(async()=>vi.advanceTimersByTimeAsync(350));
  await act(async()=>tree.root.findByType('input').props.onChangeText('서울'));
  await act(async()=>vi.advanceTimersByTimeAsync(350));
  await act(async()=>rejectOld(new Error('old failure')));
  expect(tree.root.findByType('map').props.places[0].id).toBe('new');
  expect(tree.root.findAllByType('error')).toHaveLength(0);
});
test('place registration keeps the selected day; map selection highlights before explicit addition', async () => {
  setParams({ id: 's', groupId: 'g', startDate: '2026-11-06', endDate: '2026-11-07', visitDate: '2026-11-07' });
  fixtures.api.mockImplementation(async (path) => {
    if (path === '/schedules/s') return { schedule: { title: '일정', status: 'active' }, days: [{ date: '2026-11-07', status: 'active' }], plan: [] };
    if (path.startsWith('/places?')) return { places: [{ id: 'p', name: '카페', category: '음식점 > 카페', lat: 37.5, lng: 127, address: '서울' }], page: 1, isEnd: true };
    return {};
  });
  await act(async () => { tree = create(<Places />); });
  await act(async () => tree.root.findByType('input').props.onChangeText('카페'));
  await act(async () => button('검색').props.onPress());
  await act(async () => tree.root.findByType('map').props.onSelect('p'));
  expect(tree.root.findByType('map').props.selectedId).toBe('p');
  expect(fixtures.api.mock.calls.some(([path]) => path.endsWith('/visits'))).toBe(false);
  await act(async () => button('+ 스팟에 추가').props.onPress());
  expect(tree.root.findAllByType('input')).toHaveLength(1); // Only the search field; date is fixed.
  await act(async () => button('이 날의 장소로 추가').props.onPress());
  expect(fixtures.api).toHaveBeenCalledWith('/schedules/s/visits', { visitDate: '2026-11-07', providerPlaceId: 'p' });
});
test('invites expire while open without consuming preview quota; full groups can still issue invitations', async () => {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-06T00:00:00Z')); setParams({ id: 'g' });
  fixtures.api.mockImplementation(async (path) => path === '/groups/g'
    ? { id: 'g', name: '모임', activeCount: 15, ownerUserId: 'user', coverAssetId: 'cover' }
    : { invites: [{ id: 'i', code: 'ABCDEF', state: 'active', issuedAt: '2026-11-05T00:00:00Z', expiresAt: '2026-11-06T00:00:30Z', useCount: 41 }] });
  await act(async () => { tree = create(<Invites />); });
  await act(async () => button('이전 초대·관리').props.onPress());
  expect(button('＋ 새 초대 발급하기').props.disabled).toBe(false);
  expect(JSON.stringify(tree.toJSON())).toContain('9회 남음');
  expect(button('모임 사진 신고')).toBeTruthy();
  await act(async () => { await vi.advanceTimersByTimeAsync(60000); });
  expect(button('링크 복사')).toBeUndefined();
  expect(JSON.stringify(tree.toJSON())).toContain('만료');
  expect(fixtures.api).toHaveBeenCalledTimes(4);
  expect(fixtures.api.mock.calls.some(([path]) => path.includes('/invitations/preview'))).toBe(false);
  expect(fixtures.api.mock.calls.filter(([path]) => path.endsWith('/invites/current'))).toHaveLength(0);
});

test('manual revocation survives refresh and remount until an explicit new invitation', async () => {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-06T00:00:00Z')); setParams({ id: 'g' });
  let invite = { id: 'i', code: 'ABCDEF', state: 'active', version: 1, issuedAt: '2026-11-05T00:00:00Z', expiresAt: '2026-11-12T00:00:00Z', useCount: 0 };
  fixtures.api.mockImplementation(async (path) => {
    if (path === '/groups/g') return { id: 'g', name: '모임', activeCount: 1, ownerUserId: 'user' };
    if (path.endsWith('/revocation')) { invite = { ...invite, state: 'revoked' }; return invite; }
    if (path.endsWith('/invites/current')) { invite = { ...invite, id: 'new', state: 'active' }; return invite; }
    return { invites: [invite] };
  });
  await act(async () => { tree = create(<Invites />); });
  expect(JSON.stringify(tree.toJSON())).not.toContain('확인 횟수');
  expect(button('이 초대 취소하기 ›')).toBeUndefined();
  await act(async () => button('이전 초대·관리').props.onPress());
  await act(async () => button('이 초대 취소하기 ›').props.onPress());
  await act(async () => vi.advanceTimersByTimeAsync(60000));
  expect(button('링크 복사')).toBeUndefined();
  await act(async () => tree.unmount());
  await act(async () => { tree = create(<Invites />); });
  expect(button('링크 복사')).toBeUndefined();
  expect(fixtures.api.mock.calls.filter(([path]) => path.endsWith('/invites/current'))).toHaveLength(0);
  await act(async () => button('새 초대 만들기').props.onPress());
  expect(button('링크 복사')).toBeTruthy();
  expect(fixtures.api.mock.calls.filter(([path]) => path.endsWith('/invites/current'))).toHaveLength(1);
});

test('copying a remotely revoked invitation immediately shows the replacement code that was copied', async () => {
  setParams({ id: 'g' });
  const active = { id: 'old', code: 'OLDCODE1', link: 'old-link', state: 'active', issuedAt: '2026-11-06T00:00:00Z', expiresAt: '2099-11-12T00:00:00Z', useCount: 0 };
  let invite = active;
  fixtures.api.mockImplementation(async (path) => {
    if (path === '/groups/g') return { id: 'g', name: '모임', activeCount: 1, ownerUserId: 'user' };
    if (path.endsWith('/invites/current')) { invite = { ...active, id: 'new', code: 'NEWCODE2', link: 'new-link' }; return invite; }
    return { invites: [invite] };
  });
  await act(async () => { tree = create(<Invites />); });
  invite = { ...active, state: 'revoked' }; // Another device revokes after this screen loaded.
  await act(async () => button('링크 복사').props.onPress());
  expect(JSON.stringify(tree.toJSON())).toContain('NEWCODE2');
  expect(clipboard.write).toHaveBeenCalledWith('new-link');
  expect(JSON.stringify(tree.toJSON())).not.toContain('OLDCODE1');
  expect(fixtures.api.mock.calls.slice(-3).map(([p]) => p)).toEqual(['/groups/g/invites/current', '/groups/g', '/groups/g/invites']);
});
