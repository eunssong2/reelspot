import { isDemo } from '@/lib/env';
import { DEMO_USER } from '@/lib/demoUser';
import { supabase } from '@/lib/supabase';
import type { Profile } from '@/types/database';

// 데모 모드에서는 백엔드가 없으니 메모리에 편집 결과를 들고 있는다.
// 앱을 다시 켜면 DEMO_USER 로 초기화된다 — 화면 확인용일 뿐 영구 저장이 아니다.
let demoProfile: Profile = { ...DEMO_USER };

export async function fetchMyProfile(userId: string): Promise<Profile> {
  if (isDemo) return demoProfile;

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) throw error;
  return data as Profile;
}

export type ProfilePatch = Pick<Profile, 'nickname'>;

/** 지금은 닉네임만 바꾼다. 사진은 저장소(버킷) 연결 후에 추가한다. */
export async function updateMyProfile(userId: string, patch: ProfilePatch): Promise<Profile> {
  const nickname = patch.nickname.trim();
  if (!nickname) throw new Error('닉네임을 입력해 주세요.');

  if (isDemo) {
    demoProfile = { ...demoProfile, nickname };
    return demoProfile;
  }

  const { data, error } = await supabase
    .from('profiles')
    .update({ nickname })
    .eq('id', userId)
    .select('*')
    .single();

  if (error) throw error;
  return data as Profile;
}
