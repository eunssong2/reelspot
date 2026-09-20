import { isDemo } from '@/lib/env';
import { supabase } from '@/lib/supabase';
import type { Trip, TripRole } from '@/types/database';

import { demoMembers, demoTrip, DEMO_TRIPS } from './mock';

export type TripSummary = Trip & { member_count: number };

export type TripMemberRow = {
  user_id: string;
  role: TripRole;
  joined_at: string;
  profile: { id: string; nickname: string; avatar_url: string | null } | null;
};

/** 내가 스팟원으로 속한 방만 돌아온다 (RLS). */
export async function fetchMyTrips(): Promise<TripSummary[]> {
  if (isDemo) return DEMO_TRIPS;

  const { data, error } = await supabase
    .from('trips')
    .select('*, trip_members(count)')
    .order('start_date', { ascending: true });

  if (error) throw error;

  // 손으로 쓴 Database 타입에는 관계 정보가 없어 임베드 결과를 추론하지 못한다.
  // supabase gen types 로 갈아끼우면 이 단언은 지울 수 있다.
  return (data ?? []).map((row) => {
    const { trip_members, ...trip } = row as unknown as Trip & {
      trip_members: { count: number }[];
    };
    return { ...trip, member_count: trip_members[0]?.count ?? 0 };
  });
}

export async function fetchTrip(tripId: string): Promise<TripSummary | null> {
  if (isDemo) return demoTrip(tripId);

  const { data, error } = await supabase
    .from('trips')
    .select('*, trip_members(count)')
    .eq('id', tripId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const { trip_members, ...trip } = data as unknown as Trip & {
    trip_members: { count: number }[];
  };
  return { ...trip, member_count: trip_members[0]?.count ?? 0 };
}

export async function fetchMembers(tripId: string): Promise<TripMemberRow[]> {
  if (isDemo) return demoMembers(tripId);

  const { data, error } = await supabase
    .from('trip_members')
    .select('user_id, role, joined_at, profile:profiles(id, nickname, avatar_url)')
    .eq('trip_id', tripId)
    .order('joined_at', { ascending: true });

  if (error) throw error;
  return (data ?? []) as unknown as TripMemberRow[];
}

export type NewTrip = {
  title: string;
  destination: string;
  startDate: string;
  endDate: string;
  capacity: number;
  layout: string;
};

export async function createTrip(input: NewTrip, ownerId: string): Promise<TripSummary> {
  if (isDemo) {
    return {
      id: `trip-demo-${Date.now()}`,
      owner_id: ownerId,
      title: input.title,
      destination: input.destination,
      start_date: input.startDate,
      end_date: input.endDate,
      capacity: input.capacity,
      layout: input.layout,
      invite_code: 'DEMO24',
      created_at: new Date().toISOString(),
      member_count: 1,
    };
  }

  // 초대 코드와 방장 스팟원 등록은 DB 트리거가 처리한다.
  const { data, error } = await supabase
    .from('trips')
    .insert({
      owner_id: ownerId,
      title: input.title,
      destination: input.destination,
      start_date: input.startDate,
      end_date: input.endDate,
      capacity: input.capacity,
      layout: input.layout,
    })
    .select('*')
    .single();

  if (error) throw error;
  return { ...(data as Trip), member_count: 1 };
}

/** 코드만 아는 사람은 trips 를 못 읽으므로 함수로 참여시킨다. */
export async function joinTripByCode(code: string): Promise<string> {
  if (isDemo) return DEMO_TRIPS[0].id;

  const { data, error } = await supabase.rpc('join_trip_by_code', {
    in_code: code.trim().toUpperCase(),
  });

  if (error) {
    if (error.message.includes('초대 코드')) throw new Error('초대 코드를 찾을 수 없습니다.');
    if (error.message.includes('정원')) {
      throw new Error('이 여행은 스팟원 자리가 모두 찼습니다.');
    }
    throw error;
  }
  return data as string;
}

/** 정원·배치는 방장만 바꿀 수 있다 (RLS 의 update 정책). */
export async function updateTripSetup(tripId: string, capacity: number, layout: string) {
  if (isDemo) return;

  const { error } = await supabase
    .from('trips')
    .update({ capacity, layout })
    .eq('id', tripId);

  if (error) {
    if (error.message.includes('줄일 수 없습니다')) {
      throw new Error('이미 들어온 스팟원 수보다 적게는 줄일 수 없습니다.');
    }
    throw error;
  }
}

export async function leaveTrip(tripId: string, userId: string) {
  if (isDemo) return;

  const { error } = await supabase
    .from('trip_members')
    .delete()
    .eq('trip_id', tripId)
    .eq('user_id', userId);
  if (error) throw error;
}
