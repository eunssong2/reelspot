/**
 * 로그인 → 내 모임 → 모임 달력 → 일정 → 초대(공유하기) 화면의 예시 데이터.
 * 명세: docs/login-calendar-ui-spec.md 9장. 디자인: docs/stitch/*.html
 *
 * 모임(Group)은 기존 프로토타입의 Trip(tripId)과 이어 두어, 일정 카드를 누르면
 * 일정 요약(UI08, ItinerarySummaryScreen)이 그 모임의 참여자·일정으로 열린다.
 */
import * as Linking from 'expo-linking';
import type { ImageSourcePropType } from 'react-native';

import type { Itinerary } from './tripData';
import { addDays, todayKst, type DateStr } from '../utils/calendar';

export type Role = 'owner' | 'member';

export interface Group {
  id: string;
  name: string;
  /** 일정 요약(UI08)을 열 때 쓰는 기존 프로토타입 모임 id */
  tripId: string;
  cover: ImageSourcePropType | null;
  /** 방장 포함 현재 참여자 표시명. 첫 번째가 방장이다. */
  members: string[];
  myRole: Role;
  /** 최근 공동 활동 시각(epoch ms). 목록은 이 값의 내림차순. */
  activityAt: number;
  createdAt: number;
  /** 마지막 방장이 끝낸 모임. 목록·초대·참여에서 모두 막는다. */
  closed?: boolean;
  /** 이 모임에서 강제 퇴장되어 재참여가 막힌 상태(F22) */
  blockedMe?: boolean;
  /** 방장이 내보내 재참여가 막힌 참여자 표시명 */
  blocked?: string[];
}

export interface Schedule {
  id: string;
  groupId: string;
  title: string;
  startDate: DateStr;
  endDate: DateStr;
  status: 'active' | 'cancelled';
  /** 일정 요약(UI08)의 일정 id. 없으면 처음 열 때 빈 일정으로 만든다. */
  itineraryId?: string;
  /** 올라온 사진·영상 수(예시). 0이면 빈 일정이라 삭제할 수 있다. */
  mediaCount: number;
  /** 첫 기록 완료로 고정된 보관 마지막 날. 없으면 아직 고정 전. */
  retentionLastDate?: DateStr;
  version: number;
  createdAt: number;
}

export type InviteState = 'active' | 'exhausted' | 'expired' | 'revoked';

export interface Invite {
  id: string;
  groupId: string;
  code: string;
  issuedAt: number;
  revokedAt?: number;
  useCount: number;
  version: number;
}

export interface ConsentDoc {
  id: string;
  title: string;
  version: string;
  effectiveDate: DateStr;
  required: boolean;
  /** 본문(초안). 실제 문서는 서버가 주는 주소의 내용이다. */
  body: { heading: string; text: string }[];
}

export const MAX_MEMBERS = 10;
export const INVITE_MAX_USES = 50;
export const INVITE_TTL_MS = 168 * 60 * 60 * 1000;
export const INVITE_CODE_LENGTH = 8;
/**
 * 초대 링크. 실제 앱은 https 앱 링크(assetlinks)로 열지만, 프로토타입은 지금 실행 중인 앱·웹 주소로 만들어
 * 복사한 링크를 그대로 열면 초대 확인(UI24)이 뜬다.
 */
export const inviteLink = (code: string) => Linking.createURL('prototype/invite', { queryParams: { code } });

export const inviteExpiresAt = (invite: Invite) => invite.issuedAt + INVITE_TTL_MS;

export function inviteState(invite: Invite, now = Date.now()): InviteState {
  if (invite.revokedAt) return 'revoked';
  if (invite.useCount >= INVITE_MAX_USES) return 'exhausted';
  if (now >= inviteExpiresAt(invite)) return 'expired';
  return 'active';
}

/**
 * 동의 문서. 실제 앱은 서버(consentDocs)가 항목·버전·본문 주소를 준다.
 * 본문은 2026-10-26 회의의 "약관에 들어갈 항목" 조사를 위한 **초안**이며 법무 검토 전이다.
 * 기능명세(F02·F20·F21·F24·F28)에 이미 정해진 처리만 적었다.
 */
export const CONSENT_DOCS: ConsentDoc[] = [
  {
    id: 'terms',
    title: '서비스 이용약관',
    version: '1.0',
    effectiveDate: '2026-11-01',
    required: true,
    body: [
      { heading: '1. 목적', text: '이 약관은 At that place(이하 "서비스")를 이용할 때 회사와 이용자의 권리·의무를 정합니다.' },
      {
        heading: '2. 서비스 내용',
        text: '이용자는 모임을 만들거나 초대를 받아 참여하고, 모임의 일정별로 장소 계획을 세우고 사진·짧은 영상을 함께 보관·감상할 수 있습니다. 한 모임의 정원은 방장을 포함해 10명입니다.',
      },
      {
        heading: '3. 기록의 보관 기간',
        text: '일정의 기록은 그 일정의 종료 날짜로부터 3개월이 되는 날까지 보관되며, 이후에는 열람할 수 없고 정해진 절차에 따라 삭제됩니다. 보관 기한은 일정 상세 화면에서 확인할 수 있습니다.',
      },
      {
        heading: '4. 이용자의 의무',
        text: '다른 사람의 권리를 침해하거나 법령에 어긋나는 사진·영상·글을 올려서는 안 됩니다. 신고된 기록은 검토 후 숨기거나 삭제될 수 있습니다.',
      },
      {
        heading: '5. 사진·영상 저장',
        text: '조회할 수 있는 사진·영상은 내 휴대폰에 저장할 수 있습니다. 다른 앱으로 바로 보내는 기능은 제공하지 않습니다.',
      },
      {
        heading: '6. 탈퇴',
        text: '이용자는 설정에서 언제든 계정을 삭제할 수 있습니다. 계정을 삭제하면 내가 올린 기록이 삭제되며 되돌릴 수 없습니다.',
      },
    ],
  },
  {
    id: 'privacy',
    title: '개인정보 수집 및 이용 동의',
    version: '1.0',
    effectiveDate: '2026-11-01',
    required: true,
    body: [
      {
        heading: '수집 항목',
        text: '로그인 수단(카카오·Google)의 사용자 식별값, 표시명, 동의 기록(문서·버전·시각), 이용자가 올린 사진·영상과 설명·촬영 시각, 로그인 기기 정보.',
      },
      { heading: '이용 목적', text: '회원 식별과 로그인 유지, 모임·일정·기록 기능 제공, 신고 처리와 문의 응대.' },
      {
        heading: '보관 기간',
        text: '계정 정보는 탈퇴할 때까지, 사진·영상은 일정별 보관 기한까지 보관합니다. 탈퇴하거나 기한이 지나면 지체 없이 파기합니다(백업은 최대 30일).',
      },
      {
        heading: '이메일',
        text: '같은 이메일을 쓰는 다른 로그인 수단이라도 계정을 자동으로 합치지 않습니다.',
      },
      { heading: '동의 거부', text: '필수 항목에 동의하지 않으면 서비스를 이용할 수 없습니다.' },
    ],
  },
  {
    id: 'marketing',
    title: '마케팅 정보 수신 동의',
    version: '1.0',
    effectiveDate: '2026-11-01',
    required: false,
    body: [
      { heading: '내용', text: '새 기능과 이벤트 소식을 앱 안에서 안내합니다.' },
      { heading: '선택 동의', text: '동의하지 않아도 모든 기능을 쓸 수 있고, 설정에서 언제든 바꾸거나 철회할 수 있습니다.' },
    ],
  },
  {
    id: 'location',
    title: '위치정보 이용약관',
    version: '1.0',
    effectiveDate: '2026-11-01',
    required: false,
    body: [
      {
        heading: '현재 위치',
        text: '장소 검색에서 "현재 위치" 버튼을 누를 때만 위치를 사용해 지도를 옮기며, 위치를 서버에 저장하지 않습니다. 거부해도 검색어로 장소를 찾을 수 있습니다.',
      },
      {
        heading: '사진의 촬영 위치',
        text: '올린 사진·영상에 들어 있는 촬영 위치 정보는 다른 참여자에게 공개되기 전에 지웁니다.',
      },
      { heading: '선택 동의', text: '동의하지 않아도 서비스를 이용할 수 있습니다.' },
    ],
  },
];

/** 소셜 계정에서 받아 온 이름(표시명 제안값) */
export const SOCIAL_NAME = '지민';

const HOUR = 60 * 60 * 1000;
const now = Date.now();
const today = todayKst(now);

export const SEED_GROUPS: Group[] = [
  {
    id: 'g-walk',
    name: '주말 산책 모임',
    tripId: 'trip1',
    cover: require('../../../assets/prototype/groups/group-walk.jpg'),
    members: ['지민', '수아', '도윤', '하은', '지호', '민준'],
    myRole: 'owner',
    activityAt: now - 1 * HOUR,
    createdAt: now - 60 * 24 * HOUR,
  },
  {
    id: 'g-archive',
    name: '보관 안내 모임',
    tripId: 'trip2',
    cover: require('../../../assets/prototype/groups/group-archive.jpg'),
    members: ['서연', '지민'],
    myRole: 'member',
    activityAt: now - 5 * HOUR,
    createdAt: now - 120 * 24 * HOUR,
  },
  {
    id: 'g-campus',
    name: '대학 동기 모임',
    tripId: 'trip3',
    cover: require('../../../assets/prototype/groups/group-campus.jpg'),
    members: ['현우', '지민', '예린', '태오'],
    myRole: 'member',
    activityAt: now - 30 * HOUR,
    createdAt: now - 200 * 24 * HOUR,
  },
  {
    id: 'g-lunch',
    name: '회사 점심 모임',
    tripId: 'trip1',
    cover: require('../../../assets/prototype/groups/group-lunch.jpg'),
    members: ['지민', '소희', '준호'],
    myRole: 'owner',
    activityAt: now - 72 * HOUR,
    createdAt: now - 90 * 24 * HOUR,
  },
  {
    // 내가 속하지 않은 정원 10/10 모임: 초대 참여 시 CAPACITY_FULL 확인용
    id: 'g-packed',
    name: '꽉 찬 등산 모임',
    tripId: 'trip1',
    cover: null,
    members: ['재현', '가', '나', '다', '라', '마', '바', '사', '아', '자'],
    myRole: 'member',
    activityAt: now - 200 * HOUR,
    createdAt: now - 300 * 24 * HOUR,
  },
  {
    id: 'g-closed',
    name: '지난 동아리 모임',
    tripId: 'trip1',
    cover: null,
    members: ['민서', '하준'],
    myRole: 'member',
    activityAt: now - 400 * HOUR,
    createdAt: now - 400 * 24 * HOUR,
    closed: true,
  },
  {
    id: 'g-blocked',
    name: '수요일 독서 모임',
    tripId: 'trip1',
    cover: null,
    members: ['유나', '시우', '채원'],
    myRole: 'member',
    activityAt: now - 300 * HOUR,
    createdAt: now - 250 * 24 * HOUR,
    blockedMe: true,
  },
  {
    id: 'g-full',
    name: '같은 날 검수 모임',
    tripId: 'trip1',
    cover: null,
    members: ['지민', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'],
    myRole: 'owner',
    activityAt: now - 96 * HOUR,
    createdAt: now - 30 * 24 * HOUR,
  },
];

const s = (
  id: string,
  groupId: string,
  title: string,
  startDate: DateStr,
  endDate: DateStr,
  extra: Partial<Schedule> = {},
): Schedule => ({ id, groupId, title, startDate, endDate, status: 'active', mediaCount: 0, version: 1, createdAt: 0, ...extra });

export const SEED_SCHEDULES: Schedule[] = [
  s('sc-seoul', 'g-walk', '우리의 서울 여행', '2026-10-17', '2026-10-19', {
    itineraryId: 'itin-seoul-1',
    mediaCount: 12,
    retentionLastDate: '2027-01-19',
  }),
  s('sc-seongsu', 'g-walk', '성수 당일치기', '2026-10-24', '2026-10-24', { itineraryId: 'itin-seongsu', mediaCount: 3 }),
  s('sc-picnic', 'g-walk', '한강 피크닉', '2026-10-25', '2026-10-25', { status: 'cancelled', mediaCount: 2 }),
  s('sc-bukhan', 'g-walk', '북한산 둘레길', '2026-11-07', '2026-11-07'),
  s('sc-autumn', 'g-archive', '가을 소풍', addDays(today, -92), addDays(today, -92), {
    mediaCount: 8,
    retentionLastDate: addDays(today, 6),
  }),
  s('sc-jeju', 'g-campus', '제주 졸업 여행', '2026-12-30', '2027-01-02'),
  s('sc-a', 'g-full', 'A 일정', '2026-10-27', '2026-10-27', { createdAt: 1 }),
  s('sc-b', 'g-full', 'B 일정', '2026-10-28', '2026-10-28', { createdAt: 2 }),
  s('sc-c', 'g-full', 'C 연휴 일정', '2026-10-30', '2026-11-01', { createdAt: 3 }),
  s('sc-d', 'g-full', 'D 일정', '2026-11-03', '2026-11-03', { createdAt: 4 }),
  s('sc-e', 'g-full', 'E 일정', '2026-11-04', '2026-11-04', { createdAt: 5 }),
];

const inv = (id: string, groupId: string, code: string, hoursAgo: number, useCount: number, revoked = false): Invite => ({
  id,
  groupId,
  code,
  issuedAt: now - hoursAgo * HOUR,
  revokedAt: revoked ? now - (hoursAgo - 2) * HOUR : undefined,
  useCount,
  version: 1,
});

export const SEED_INVITES: Invite[] = [
  inv('inv-1', 'g-walk', 'Q7KM2P8R', 24, 12),
  inv('inv-2', 'g-walk', 'M3XT9KQ2', 51, 45),
  inv('inv-3', 'g-walk', 'H5TW8C2N', 66, 50),
  inv('inv-4', 'g-walk', 'B2RD7NW4', 13 * 24, 8),
  inv('inv-5', 'g-walk', 'Z9PL4HC6', 98, 3, true),
  inv('inv-6', 'g-packed', 'F4LL10AB', 10, 4),
  inv('inv-7', 'g-campus', 'C4MPUS27', 20, 2),
  inv('inv-8', 'g-closed', 'CLSDGRP2', 30, 6),
  inv('inv-9', 'g-blocked', 'BLKDRD45', 12, 3),
];

/** 성수 당일치기처럼 기존 tripData 에 없는 일정의 장소 계획(일정 요약 화면이 쓴다). */
export const SEED_ITINERARIES: Itinerary[] = [
  {
    id: 'itin-seongsu',
    tripId: 'trip1',
    name: '성수 당일치기',
    startDate: '2026-10-24',
    endDate: '2026-10-24',
    days: [
      {
        id: 'day-1',
        date: '2026-10-24',
        dayNumber: 1,
        title: '빵 먹고 전시 보고 저녁까지',
        places: [
          {
            id: 'mock-bakery',
            name: '아침 빵집',
            address: '서울 성동구 성수이로 7',
            categoryLabel: '카페',
            emoji: '🥐',
            tint: '#FFE7D6',
            visitTime: '10:30',
          },
          {
            id: 'mock-gallery',
            name: '작은 전시관',
            address: '서울 성동구 아차산로 17',
            categoryLabel: '관광지',
            emoji: '🖼️',
            tint: '#E8E2F4',
            visitTime: '13:00',
          },
          {
            id: 'mock-dinner',
            name: '골목 저녁 식당',
            address: '서울 성동구 서울숲2길 32',
            categoryLabel: '맛집',
            emoji: '🍲',
            tint: '#FDE4DB',
          },
        ],
      },
    ],
  },
];

/** 일정의 날짜마다 빈 날짜를 만든다(처음 여는 일정의 일정 요약용). */
export function emptyItinerary(id: string, tripId: string, name: string, startDate: DateStr, endDate: DateStr): Itinerary {
  const days = [];
  for (let d = startDate, n = 1; d <= endDate; d = addDays(d, 1), n += 1) {
    days.push({ id: `day-${n}`, date: d, dayNumber: n, places: [] });
  }
  return { id, tripId, name, startDate, endDate, days };
}

/** 영문 대문자·숫자 8자. 헷갈리는 0·O·1·I 는 쓰지 않는다. */
export function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < INVITE_CODE_LENGTH; i += 1) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

/** 입력·붙여넣기 값을 코드 형태로 정리한다. 링크가 들어 있으면 링크 끝의 코드를 꺼낸다. */
export function normalizeInviteCode(raw: string): string {
  const fromLink = raw.match(/(?:invite\/|[?&]code=)([A-Za-z0-9-]+)/);
  const base = fromLink ? fromLink[1] : raw;
  return base
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, INVITE_CODE_LENGTH);
}
