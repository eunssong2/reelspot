import React from 'react';
import { afterEach, expect, test, vi } from 'vitest';
import { act, create } from 'react-test-renderer';
import { fixtures } from './setup';
import { setParams } from './router';
import Places from '../../src/app/places';
import Invites from '../../src/app/group/invites';
vi.mock('expo-location', () => ({}));
vi.mock('../../src/components/place-map', () => ({ PlaceMap: (props: any) => <map {...props} /> }));
let tree: any;
afterEach(async () => { if (tree) await act(async () => tree.unmount()); vi.useRealTimers(); });
function text(n: any): string { return typeof n === 'string' ? n : (n.children ?? []).map(text).join(''); }
const button = (name: string) => tree.root.findAll((n: any) => n.type === 'button' && text(n) === name)[0];
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
    ? { id: 'g', name: '모임', activeCount: 10, ownerUserId: 'user', coverAssetId: 'cover' }
    : { invites: [{ id: 'i', code: 'ABCDEF', state: 'active', issuedAt: '2026-11-05T00:00:00Z', expiresAt: '2026-11-06T00:00:30Z', useCount: 41 }] });
  await act(async () => { tree = create(<Invites />); });
  expect(button('＋ 새 초대 발급하기').props.disabled).toBe(false);
  expect(JSON.stringify(tree.toJSON())).toContain('9회 남음');
  expect(button('모임 사진 신고')).toBeTruthy();
  await act(async () => { await vi.advanceTimersByTimeAsync(60000); });
  expect(button('링크 복사')).toBeUndefined();
  expect(JSON.stringify(tree.toJSON())).toContain('만료');
  expect(fixtures.api).toHaveBeenCalledTimes(2);
});
