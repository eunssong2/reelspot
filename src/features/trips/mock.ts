// 데모 모드 전용 목 데이터.
import { DEMO_USER } from '@/lib/demoUser';

import type { TripMemberRow, TripSummary } from './api';

const MEMBERS: TripMemberRow[] = [
  {
    user_id: DEMO_USER.id,
    role: 'owner',
    joined_at: '2026-04-01T00:00:00.000Z',
    profile: { id: DEMO_USER.id, nickname: '은송', avatar_url: null },
  },
  {
    user_id: 'demo-user-0002',
    role: 'member',
    joined_at: '2026-04-02T00:00:00.000Z',
    profile: { id: 'demo-user-0002', nickname: '지원', avatar_url: null },
  },
  {
    user_id: 'demo-user-0003',
    role: 'member',
    joined_at: '2026-04-03T00:00:00.000Z',
    profile: { id: 'demo-user-0003', nickname: '하늘', avatar_url: null },
  },
];

export const DEMO_TRIPS: TripSummary[] = [
  {
    id: 'trip-1',
    owner_id: DEMO_USER.id,
    title: '제주 3박 4일',
    destination: '제주도',
    start_date: '2026-10-02',
    end_date: '2026-10-05',
    capacity: 5,
    layout: 'one-top-four',
    invite_code: 'K7M2QD',
    created_at: '2026-04-01T00:00:00.000Z',
    member_count: 3,
  },
  {
    id: 'trip-2',
    owner_id: 'demo-user-0002',
    title: '엄마랑 부산',
    destination: '부산',
    start_date: '2026-11-14',
    end_date: '2026-11-16',
    capacity: 2,
    layout: 'split-v',
    invite_code: 'B4X9TR',
    created_at: '2026-04-05T00:00:00.000Z',
    member_count: 2,
  },
];

const MEMBERS_BY_TRIP: Record<string, TripMemberRow[]> = {
  'trip-1': MEMBERS,
  'trip-2': MEMBERS.slice(0, 2),
};

export const demoMembers = (tripId: string) => MEMBERS_BY_TRIP[tripId] ?? [];
export const demoTrip = (tripId: string) => DEMO_TRIPS.find((t) => t.id === tripId) ?? null;
