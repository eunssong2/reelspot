import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import {
  CONSENT_DOCS,
  emptyItinerary,
  generateInviteCode,
  inviteState,
  MAX_MEMBERS,
  SEED_GROUPS,
  SEED_INVITES,
  SEED_ITINERARIES,
  SEED_SCHEDULES,
  type ConsentDoc,
  type Group,
  type Invite,
  type Schedule,
} from '../mock/groupData';
import { MAX_SCHEDULE_DAYS, addDays, inclusiveDays, isWithin, todayKst, type DateStr } from '../utils/calendar';
import { usePrototype } from './PrototypeProvider';

/**
 * 로그인~달력~초대 화면(docs/login-calendar-ui-spec.md)의 mock 상태.
 * 서버 API(authExchange, onboard, groupsList, groupCreate, calendar, schedule*, invite*, operationGet)를
 * 같은 결과·오류 코드를 돌려주는 함수로 흉내 낸다. 화면은 서버 응답처럼 결과를 받아 처리한다.
 *
 * - 로그인 상태(세션·가입한 계정·보류 초대·달력 보기 방식)는 기기 저장소에 남겨 새로고침해도 이어진다(세션 복원).
 * - 모임·일정·초대 데이터는 예시라 새로고침하면 처음 상태로 돌아간다.
 * - "예시 상황"(scenario)을 켜면 오프라인·조회 실패·결과 불명·충돌 등을 일부러 만든다.
 */

export type Provider = 'kakao' | 'google';

export interface Session {
  provider: Provider;
  /** 가입(UI02)을 마쳤는지 */
  onboarded: boolean;
  displayName: string;
}

export interface InvitePreview {
  code: string;
  groupId: string;
  groupName: string;
  /** 진행 중 → 가까운 미래 → 최근 과거 일정 하나(취소 제외). 없으면 null */
  schedule: { title: string; startDate: DateStr; endDate: DateStr } | null;
}

/** 로그인 전에 확인한 초대. 로그인·가입이 끝나면 이 값으로 UI24 에 돌아온다(확인 횟수를 다시 쓰지 않음). */
export type PendingInvite = InvitePreview;

/** 모든 요청에 공통인 실패 */
export type CommonError = 'OFFLINE' | 'SERVER_ERROR';

export type InviteError =
  | CommonError
  | 'INVITE_INVALID'
  | 'INVITE_EXPIRED'
  | 'INVITE_EXHAUSTED'
  | 'INVITE_REVOKED'
  | 'GROUP_CLOSED'
  | 'CAPACITY_FULL'
  | 'REENTRY_BLOCKED'
  | 'GROUP_LIMIT';

export type Result<T, E extends string> = ({ ok: true } & T) | { ok: false; error: E };

export type ScheduleInput = { title: string; startDate: DateStr; endDate: DateStr };

export type UpdateResult =
  | { ok: true }
  | { ok: false; error: 'OUTSIDE_RANGE_CONFIRMATION_REQUIRED'; visits: number; media: number }
  | { ok: false; error: 'VERSION_CONFLICT'; latest: Schedule }
  | { ok: false; error: 'SCHEDULE_CANCELLED' | 'FORBIDDEN' | 'TEXT_REJECTED' | 'DATE_TAKEN' | CommonError };

export type CalendarView = 'calendar' | 'list';

/**
 * 프로토타입 "예시 상황". 켜 둔 동안 해당 요청이 그렇게 실패한다.
 * once 표시가 붙은 것은 다음 요청 한 번만 적용되고 저절로 꺼진다(다시 시도하면 성공하는 흐름 확인용).
 */
export interface Scenario {
  offline: boolean;
  slow: boolean;
  loadFail: boolean;
  authCancel: boolean;
  authFail: boolean;
  providerDown: boolean;
  textRejected: boolean;
  consentChanged: boolean;
  groupLimit: boolean;
  ownerLimit: boolean;
  unknownResult: boolean;
  conflict: boolean;
}

const NO_SCENARIO: Scenario = {
  offline: false,
  slow: false,
  loadFail: false,
  authCancel: false,
  authFail: false,
  providerDown: false,
  textRejected: false,
  consentChanged: false,
  groupLimit: false,
  ownerLimit: false,
  unknownResult: false,
  conflict: false,
};

const STORAGE_KEY = 'reelspot.proto.auth.v1';

interface Stored {
  session: Session | null;
  registered: Record<Provider, string | null>;
  pendingInvite: PendingInvite | null;
  calendarView: CalendarView;
}

type CreateGroupResult = Result<
  { group: Group; schedule: Schedule },
  'GROUP_LIMIT' | 'OWNER_CREATE_LIMIT' | 'TEXT_REJECTED' | 'RESULT_UNKNOWN' | CommonError
>;

interface GroupsState {
  /** 기기에 저장된 세션을 읽는 중(스플래시) */
  restoring: boolean;
  /** 세션 갱신이 오프라인으로 실패했을 때 */
  restoreError: CommonError | null;
  retryRestore: () => void;

  session: Session | null;
  login: (
    provider: Provider,
  ) => Promise<Result<{ onboardingRequired: boolean }, 'AUTH_CANCELLED' | 'AUTH_INVALID' | 'PROVIDER_UNAVAILABLE' | CommonError>>;
  loadConsentDocs: () => Promise<Result<{ docs: ConsentDoc[] }, 'DOCUMENT_UNAVAILABLE' | CommonError>>;
  completeOnboarding: (
    displayName: string,
    consents: { documentId: string; version: string; agreed: boolean }[],
  ) => Promise<Result<object, 'TEXT_REJECTED' | 'CONSENT_REQUIRED' | CommonError>>;
  logout: () => void;

  pendingInvite: PendingInvite | null;
  setPendingInvite: (invite: PendingInvite | null) => void;

  /** 내가 현재 참여 중인 모임(최근 공동 활동순, 종료 모임 제외) */
  groups: Group[];
  loadGroups: () => Promise<Result<object, CommonError>>;
  group: (groupId: string) => Group | undefined;
  /** key: 요청 키. 같은 키로 다시 보내면 결과가 하나만 생긴다. */
  createGroup: (name: string, first: ScheduleInput, key: string) => Promise<CreateGroupResult>;
  /** 결과가 불명확할 때 요청 키로 처리 결과를 확인한다(operationGet). */
  operationGet: (key: string) => Promise<CreateGroupResult | null>;

  schedulesOf: (groupId: string) => Schedule[];
  schedule: (scheduleId: string) => Schedule | undefined;
  /** 달력 조회(calendar). 화면은 성공 응답을 받기 전까지 일정을 0개로 단정하지 않는다. */
  loadCalendar: (groupId: string, month: string) => Promise<Result<object, 'FORBIDDEN' | CommonError>>;
  placeCount: (schedule: Schedule) => number;
  firstPlaceName: (schedule: Schedule) => string | null;
  /** 일정 요약(UI08)을 열 수 있게 일정 id 를 돌려준다. 처음 여는 일정이면 빈 날짜로 만든다. */
  ensureItinerary: (scheduleId: string) => string;
  createSchedule: (
    groupId: string,
    input: ScheduleInput,
    key: string,
  ) => Promise<Result<{ schedule: Schedule }, 'TEXT_REJECTED' | 'DATE_TAKEN' | CommonError>>;
  updateSchedule: (
    scheduleId: string,
    input: ScheduleInput,
    expectedVersion: number,
    confirmOutsideRange: boolean,
  ) => Promise<UpdateResult>;
  cancelSchedule: (scheduleId: string) => Promise<Result<object, CommonError>>;
  /** 빈 일정만 지운다. 기록이 있으면 NOT_EMPTY */
  deleteSchedule: (scheduleId: string) => Promise<Result<{ deletedVisits: number }, 'NOT_EMPTY' | CommonError>>;
  visitCount: (schedule: Schedule) => number;

  /** 한 날짜(하루 일정)의 제목·날짜를 고친다. 같은 모임의 다른 일정이 쓰는 날짜로는 옮길 수 없다(DATE_TAKEN). */
  updateScheduleDay: (
    scheduleId: string,
    dayId: string,
    patch: { title: string; date: DateStr },
  ) => Promise<Result<object, 'DATE_TAKEN' | 'SCHEDULE_CANCELLED' | 'FORBIDDEN' | 'TEXT_REJECTED' | CommonError>>;
  /** 하루만 취소한다(기록은 남는다). 모든 날이 취소되면 일정 전체가 취소된 상태가 된다. */
  cancelScheduleDay: (scheduleId: string, dayId: string) => Promise<Result<object, 'FORBIDDEN' | CommonError>>;
  /** 장소가 없는 하루를 지운다. 마지막 하루였으면 일정도 함께 지워진다. */
  removeScheduleDay: (scheduleId: string, dayId: string) => Promise<Result<object, 'NOT_EMPTY' | 'FORBIDDEN' | CommonError>>;

  /** 모임 대표 사진을 바꾼다(방장). 이 프로토타입의 모임 정보는 앱을 다시 열면 처음 예시로 돌아간다. */
  setGroupCover: (groupId: string, uri: string) => void;

  /** 방장이 참여자를 내보낸다. 내보낸 사람은 같은 초대로 다시 참여할 수 없다(REENTRY_BLOCKED). */
  removeMember: (groupId: string, name: string) => Promise<Result<object, 'FORBIDDEN' | CommonError>>;

  invitesOf: (groupId: string) => Invite[];
  loadInvites: (groupId: string) => Promise<Result<object, CommonError>>;
  createInvite: (groupId: string, key: string) => Promise<Result<{ invite: Invite }, 'GROUP_CLOSED' | CommonError>>;
  revokeInvite: (inviteId: string, expectedVersion: number) => Promise<Result<object, 'VERSION_CONFLICT' | CommonError>>;
  /** 성공할 때마다 확인 횟수 +1 (서버 invitePreview 와 같음) */
  previewInvite: (code: string) => Promise<Result<{ preview: InvitePreview }, InviteError>>;
  joinInvite: (code: string, key: string) => Promise<Result<{ groupId: string; alreadyMember: boolean }, InviteError>>;

  /** 화면을 옮긴 뒤 보여 줄 토스트. 다음 화면이 꺼내 쓴다. */
  flash: string | null;
  setFlash: (message: string | null) => void;

  /** 달력/일정 목록 보기(기기에 기억) */
  calendarView: CalendarView;
  setCalendarView: (view: CalendarView) => void;

  scenario: Scenario;
  setScenario: (patch: Partial<Scenario>) => void;
}

const GroupsContext = createContext<GroupsState | null>(null);

/** 진행 중 → 가장 가까운 미래 → 가장 최근 과거(취소 제외) */
export function representativeSchedule(
  list: Schedule[],
  today = todayKst(),
): { kind: 'ongoing' | 'next' | 'recent'; schedule: Schedule } | null {
  const active = list.filter((sc) => sc.status === 'active');
  const ongoing = active
    .filter((sc) => isWithin(today, sc.startDate, sc.endDate))
    .sort((a, b) => a.startDate.localeCompare(b.startDate))[0];
  if (ongoing) return { kind: 'ongoing', schedule: ongoing };
  const next = active.filter((sc) => sc.startDate > today).sort((a, b) => a.startDate.localeCompare(b.startDate))[0];
  if (next) return { kind: 'next', schedule: next };
  const recent = active.filter((sc) => sc.endDate < today).sort((a, b) => b.endDate.localeCompare(a.endDate))[0];
  return recent ? { kind: 'recent', schedule: recent } : null;
}

const fail = <E extends string>(error: E) => ({ ok: false as const, error });

export function GroupsProvider({ children }: { children: ReactNode }) {
  const { itineraries, addItinerary, updateDayInfo, removeDay, updateItineraryInfo } = usePrototype();
  const itinerariesRefG = useRef(itineraries);
  itinerariesRefG.current = itineraries;
  const [restoring, setRestoring] = useState(true);
  const [restoreError, setRestoreError] = useState<CommonError | null>(null);
  const [restoreTick, setRestoreTick] = useState(0);
  const [session, setSession] = useState<Session | null>(null);
  const [registered, setRegistered] = useState<Record<Provider, string | null>>({ kakao: null, google: null });
  const [pendingInvite, setPendingInvite] = useState<PendingInvite | null>(null);
  const [allGroups, setAllGroups] = useState<Group[]>(SEED_GROUPS);
  const [schedules, setSchedules] = useState<Schedule[]>(SEED_SCHEDULES);
  const [invites, setInvites] = useState<Invite[]>(SEED_INVITES);
  const [docs, setDocs] = useState<ConsentDoc[]>(CONSENT_DOCS);
  const [flash, setFlash] = useState<string | null>(null);
  const [calendarView, setCalendarView] = useState<CalendarView>('calendar');
  const [scenario, setScenarioState] = useState<Scenario>(NO_SCENARIO);

  // 비동기 요청 안에서도 최신 값을 보도록 참조를 둔다(동시 요청 흉내).
  const scenarioRef = useRef(scenario);
  scenarioRef.current = scenario;
  const schedulesRef = useRef(schedules);
  schedulesRef.current = schedules;
  const invitesRef = useRef(invites);
  invitesRef.current = invites;
  const groupsRef = useRef(allGroups);
  groupsRef.current = allGroups;
  const docsRef = useRef(docs);
  docsRef.current = docs;
  /** 요청 키 → 처리 결과(서버 operations 테이블 흉내) */
  const operations = useRef(new Map<string, unknown>());

  const setScenario = useCallback((patch: Partial<Scenario>) => setScenarioState((prev) => ({ ...prev, ...patch })), []);

  /** 서버 왕복 흉내: 기다린 뒤 오프라인이면 실패 */
  const roundTrip = useCallback(async (ms = 450): Promise<CommonError | null> => {
    await new Promise((resolve) => setTimeout(resolve, scenarioRef.current.slow ? ms + 2200 : ms));
    return scenarioRef.current.offline ? 'OFFLINE' : null;
  }, []);

  /** 한 번만 적용되는 예시 상황을 꺼내 쓰고 끈다 */
  const takeOnce = useCallback((key: 'consentChanged' | 'unknownResult' | 'conflict') => {
    if (!scenarioRef.current[key]) return false;
    scenarioRef.current = { ...scenarioRef.current, [key]: false };
    setScenarioState(scenarioRef.current);
    return true;
  }, []);

  // ---------- 세션 복원(스플래시) ----------

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setRestoring(true);
      setRestoreError(null);
      let stored: Stored | null = null;
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        stored = raw ? (JSON.parse(raw) as Stored) : null;
      } catch {
        stored = null; // 저장소를 못 읽으면 로그인부터 시작한다.
      }
      if (cancelled) return;
      if (stored) {
        setRegistered(stored.registered ?? { kakao: null, google: null });
        setPendingInvite(stored.pendingInvite ?? null);
        setCalendarView(stored.calendarView ?? 'calendar');
      }
      if (stored?.session) {
        // sessionRefresh 흉내: 오프라인이면 세션을 지우지 않고 다시 시도를 기다린다.
        const err = await roundTrip(700);
        if (cancelled) return;
        if (err) {
          setRestoreError(err);
          return;
        }
        setSession(stored.session);
      }
      setRestoring(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [restoreTick, roundTrip]);

  const retryRestore = useCallback(() => setRestoreTick((n) => n + 1), []);

  useEffect(() => {
    if (restoring) return;
    const data: Stored = { session, registered, pendingInvite, calendarView };
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data)).catch(() => {
      // 저장 실패는 이번 실행의 화면에는 영향이 없다.
    });
  }, [restoring, session, registered, pendingInvite, calendarView]);

  // 기존 tripData 에 없는 예시 일정의 장소 계획을 일정 요약 데이터에 넣어 둔다.
  useEffect(() => {
    SEED_ITINERARIES.forEach(addItinerary);
  }, [addItinerary]);

  const me = session?.displayName || '지민';

  // ---------- 로그인·가입 ----------

  const login = useCallback(
    async (provider: Provider) => {
      const sc = scenarioRef.current;
      await new Promise((resolve) => setTimeout(resolve, sc.slow ? 2500 : 700));
      if (sc.authCancel) return fail('AUTH_CANCELLED' as const);
      if (sc.offline) return fail('OFFLINE' as const);
      if (sc.providerDown) return fail('PROVIDER_UNAVAILABLE' as const);
      if (sc.authFail) return fail('AUTH_INVALID' as const);
      const known = registered[provider];
      setSession({ provider, onboarded: Boolean(known), displayName: known ?? '' });
      return { ok: true as const, onboardingRequired: !known };
    },
    [registered],
  );

  const loadConsentDocs = useCallback(async () => {
    const err = await roundTrip();
    if (err) return fail(err);
    if (scenarioRef.current.loadFail) return fail('DOCUMENT_UNAVAILABLE' as const);
    return { ok: true as const, docs: docsRef.current };
  }, [roundTrip]);

  const completeOnboarding = useCallback(
    async (displayName: string, consents: { documentId: string; version: string; agreed: boolean }[]) => {
      const err = await roundTrip(500);
      if (err) return fail(err);
      if (scenarioRef.current.textRejected) return fail('TEXT_REJECTED' as const);
      if (takeOnce('consentChanged')) {
        // 그사이 필수 문서(개인정보) 새 버전이 시행된 상황
        const next = docsRef.current.map((d) =>
          d.id === 'privacy' ? { ...d, version: `${(Number(d.version) + 0.1).toFixed(1)}` } : d,
        );
        docsRef.current = next;
        setDocs(next);
      }
      const stale = docsRef.current.some(
        (d) => d.required && !consents.some((c) => c.documentId === d.id && c.version === d.version && c.agreed),
      );
      if (stale) return fail('CONSENT_REQUIRED' as const);
      const name = displayName.normalize('NFC').trim();
      const provider = session?.provider;
      setSession((prev) => (prev ? { ...prev, onboarded: true, displayName: name } : prev));
      if (provider) setRegistered((prev) => ({ ...prev, [provider]: name }));
      // 예시 모임의 '지민'을 새 표시명으로 바꿔 보여 준다(표시명이 작성자 표시에 반영되는 흉내).
      setAllGroups((prev) => prev.map((g) => ({ ...g, members: g.members.map((m) => (m === '지민' ? name : m)) })));
      return { ok: true as const };
    },
    [roundTrip, takeOnce, session],
  );

  const logout = useCallback(() => setSession(null), []);

  // ---------- 모임 ----------

  const groups = useMemo(
    () =>
      allGroups
        .filter((g) => !g.closed && g.members.includes(me))
        .sort((a, b) => b.activityAt - a.activityAt || b.createdAt - a.createdAt || b.id.localeCompare(a.id)),
    [allGroups, me],
  );

  const loadGroups = useCallback(async () => {
    const err = await roundTrip(350);
    if (err) return fail(err);
    if (scenarioRef.current.loadFail) return fail('SERVER_ERROR' as const);
    return { ok: true as const };
  }, [roundTrip]);

  const group = useCallback((groupId: string) => allGroups.find((g) => g.id === groupId), [allGroups]);

  const touch = (groupId: string) =>
    setAllGroups((prev) => prev.map((g) => (g.id === groupId ? { ...g, activityAt: Date.now() } : g)));

  const createGroup = useCallback(
    async (name: string, first: ScheduleInput, key: string): Promise<CreateGroupResult> => {
      const done = operations.current.get(key) as CreateGroupResult | undefined;
      const err = await roundTrip(600);
      if (err) return fail(err);
      if (done) return done; // 같은 요청 키의 재시도: 이미 만든 결과를 그대로 돌려준다.
      const sc = scenarioRef.current;
      if (sc.textRejected) return fail('TEXT_REJECTED');
      if (sc.groupLimit) return fail('GROUP_LIMIT');
      if (sc.ownerLimit) return fail('OWNER_CREATE_LIMIT');
      const t = Date.now();
      const created: Group = {
        id: `g-${t}`,
        name: name.normalize('NFC').trim(),
        tripId: 'trip1',
        cover: null,
        members: [me],
        myRole: 'owner',
        activityAt: t,
        createdAt: t,
      };
      const schedule: Schedule = {
        id: `sc-${t}`,
        groupId: created.id,
        title: first.title.normalize('NFC').trim(),
        startDate: first.startDate,
        endDate: first.endDate,
        status: 'active',
        mediaCount: 0,
        version: 1,
        createdAt: t,
      };
      setAllGroups((prev) => [...prev, created]);
      setSchedules((prev) => [...prev, schedule]);
      const result: CreateGroupResult = { ok: true, group: created, schedule };
      operations.current.set(key, result);
      // 서버는 만들었지만 응답이 오는 길에 끊긴 상황
      if (takeOnce('unknownResult')) return fail('RESULT_UNKNOWN');
      return result;
    },
    [me, roundTrip, takeOnce],
  );

  const operationGet = useCallback(
    async (key: string) => {
      const err = await roundTrip(500);
      if (err) return fail(err) as CreateGroupResult;
      return (operations.current.get(key) as CreateGroupResult | undefined) ?? null;
    },
    [roundTrip],
  );

  // ---------- 일정 ----------

  const schedulesOf = useCallback((groupId: string) => schedules.filter((sc) => sc.groupId === groupId), [schedules]);
  const schedule = useCallback((scheduleId: string) => schedules.find((sc) => sc.id === scheduleId), [schedules]);

  const loadCalendar = useCallback(
    async (groupId: string, _month: string) => {
      const err = await roundTrip(400);
      if (err) return fail(err);
      if (scenarioRef.current.loadFail) return fail('SERVER_ERROR' as const);
      const g = groupsRef.current.find((x) => x.id === groupId);
      if (!g || g.closed || !g.members.includes(me)) return fail('FORBIDDEN' as const);
      return { ok: true as const };
    },
    [me, roundTrip],
  );

  const itineraryOf = useCallback(
    (sc: Schedule) => (sc.itineraryId ? itineraries.find((it) => it.id === sc.itineraryId) : undefined),
    [itineraries],
  );
  const placeCount = useCallback(
    (sc: Schedule) => itineraryOf(sc)?.days.reduce((n, d) => n + d.places.length, 0) ?? 0,
    [itineraryOf],
  );
  const firstPlaceName = useCallback(
    (sc: Schedule) => itineraryOf(sc)?.days.flatMap((d) => d.places)[0]?.name ?? null,
    [itineraryOf],
  );

  const ensureItinerary = useCallback(
    (scheduleId: string) => {
      const sc = schedulesRef.current.find((x) => x.id === scheduleId);
      if (!sc) return scheduleId;
      if (sc.itineraryId) return sc.itineraryId;
      const tripId = groupsRef.current.find((g) => g.id === sc.groupId)?.tripId ?? 'trip1';
      const itineraryId = `itin-${sc.id}`;
      addItinerary(emptyItinerary(itineraryId, tripId, sc.title, sc.startDate, sc.endDate));
      setSchedules((prev) => prev.map((x) => (x.id === sc.id ? { ...x, itineraryId } : x)));
      return itineraryId;
    },
    [addItinerary],
  );

  /** 일정이 차지하는 날짜들. 일정 요약(날짜 목록)이 있으면 그 날짜들, 없으면 시작~종료 기간. */
  const datesOf = (sc: Schedule): DateStr[] => {
    const it = sc.itineraryId ? itinerariesRefG.current.find((i) => i.id === sc.itineraryId) : undefined;
    if (it && it.days.length > 0) return it.days.filter((d) => !d.cancelled).map((d) => d.date);
    const out: DateStr[] = [];
    for (let d = sc.startDate; d <= sc.endDate && out.length < 400; d = addDays(d, 1)) out.push(d);
    return out;
  };

  /** 하루에는 일정 하나만 둔다. 같은 모임의 다른 (취소되지 않은) 일정이 이미 쓰는 날짜가 [start, end] 안에 있으면 그 날짜를 돌려준다. */
  const takenDate = (groupId: string, start: DateStr, end: DateStr, exceptId?: string): DateStr | null => {
    const taken = new Set<DateStr>();
    for (const x of schedulesRef.current) {
      if (x.groupId === groupId && x.id !== exceptId && x.status === 'active') datesOf(x).forEach((d) => taken.add(d));
    }
    for (let d = start; d <= end; d = addDays(d, 1)) if (taken.has(d)) return d;
    return null;
  };

  const createSchedule = useCallback(
    async (groupId: string, input: ScheduleInput, key: string) => {
      const done = operations.current.get(key) as { ok: true; schedule: Schedule } | undefined;
      const err = await roundTrip();
      if (err) return fail(err);
      if (done) return done;
      if (scenarioRef.current.textRejected) return fail('TEXT_REJECTED' as const);
      if (takenDate(groupId, input.startDate, input.endDate)) return fail('DATE_TAKEN' as const);
      const t = Date.now();
      const sc: Schedule = {
        id: `sc-${t}`,
        groupId,
        title: input.title.normalize('NFC').trim(),
        startDate: input.startDate,
        endDate: input.endDate,
        status: 'active',
        mediaCount: 0,
        version: 1,
        createdAt: t,
      };
      setSchedules((prev) => [...prev, sc]);
      touch(groupId);
      const result = { ok: true as const, schedule: sc };
      operations.current.set(key, result);
      return result;
    },
    [roundTrip],
  );

  const visitCount = useCallback((sc: Schedule) => placeCount(sc), [placeCount]);

  const updateSchedule = useCallback(
    async (
      scheduleId: string,
      input: ScheduleInput,
      expectedVersion: number,
      confirmOutsideRange: boolean,
    ): Promise<UpdateResult> => {
      const err = await roundTrip();
      if (err) return fail(err);
      let sc = schedulesRef.current.find((x) => x.id === scheduleId);
      if (!sc) return fail('FORBIDDEN');
      if (takeOnce('conflict')) {
        // 다른 사람(공동 방장 이전 직후 등)이 먼저 제목을 고친 상황: 서버 버전이 올라가 있다.
        const latest: Schedule = { ...sc, title: `${sc.title} (수아 수정)`, version: sc.version + 1 };
        schedulesRef.current = schedulesRef.current.map((x) => (x.id === scheduleId ? latest : x));
        setSchedules(schedulesRef.current);
        sc = latest;
      }
      if (sc.status === 'cancelled') return fail('SCHEDULE_CANCELLED');
      if (sc.version !== expectedVersion) return { ok: false, error: 'VERSION_CONFLICT', latest: sc };
      if (scenarioRef.current.textRejected) return fail('TEXT_REJECTED');
      if (inclusiveDays(input.startDate, input.endDate) > MAX_SCHEDULE_DAYS) return fail('FORBIDDEN');
      if (takenDate(sc.groupId, input.startDate, input.endDate, sc.id)) return fail('DATE_TAKEN');
      // 새 기간 밖이 되는 방문(장소)·기록 수. 기록 수는 예시라 방문이 밖으로 나가는 비율로 어림한다.
      const itinerary = itineraryOf(sc);
      const outsideVisits =
        itinerary?.days
          .filter((d) => !isWithin(d.date, input.startDate, input.endDate))
          .reduce((n, d) => n + d.places.length, 0) ?? 0;
      const totalVisits = placeCount(sc);
      const outsideMedia = totalVisits ? Math.round((sc.mediaCount * outsideVisits) / totalVisits) : 0;
      if ((outsideVisits > 0 || outsideMedia > 0) && !confirmOutsideRange) {
        return { ok: false, error: 'OUTSIDE_RANGE_CONFIRMATION_REQUIRED', visits: outsideVisits, media: outsideMedia };
      }
      const title = input.title.normalize('NFC').trim();
      setSchedules((prev) => prev.map((x) => (x.id === scheduleId ? { ...x, ...input, title, version: x.version + 1 } : x)));
      if (sc.itineraryId)
        updateItineraryInfo(sc.itineraryId, { name: title, startDate: input.startDate, endDate: input.endDate });
      touch(sc.groupId);
      return { ok: true };
    },
    [itineraryOf, placeCount, roundTrip, takeOnce, updateItineraryInfo],
  );

  const cancelSchedule = useCallback(
    async (scheduleId: string) => {
      const err = await roundTrip();
      if (err) return fail(err);
      setSchedules((prev) => prev.map((x) => (x.id === scheduleId ? { ...x, status: 'cancelled', version: x.version + 1 } : x)));
      return { ok: true as const };
    },
    [roundTrip],
  );

  const deleteSchedule = useCallback(
    async (scheduleId: string) => {
      const err = await roundTrip();
      if (err) return fail(err);
      const sc = schedulesRef.current.find((x) => x.id === scheduleId);
      if (!sc || sc.mediaCount > 0) return fail('NOT_EMPTY' as const);
      const deletedVisits = placeCount(sc);
      setSchedules((prev) => prev.filter((x) => x.id !== scheduleId));
      touch(sc.groupId);
      return { ok: true as const, deletedVisits };
    },
    [placeCount, roundTrip],
  );

  // ---------- 초대 ----------

  const invitesOf = useCallback(
    (groupId: string) => invites.filter((i) => i.groupId === groupId).sort((a, b) => b.issuedAt - a.issuedAt),
    [invites],
  );

  const loadInvites = useCallback(
    async (_groupId: string) => {
      const err = await roundTrip(350);
      if (err) return fail(err);
      if (scenarioRef.current.loadFail) return fail('SERVER_ERROR' as const);
      return { ok: true as const };
    },
    [roundTrip],
  );

  const createInvite = useCallback(
    async (groupId: string, key: string) => {
      const done = operations.current.get(key) as { ok: true; invite: Invite } | undefined;
      const err = await roundTrip();
      if (err) return fail(err);
      if (done) return done;
      if (groupsRef.current.find((g) => g.id === groupId)?.closed) return fail('GROUP_CLOSED' as const);
      const t = Date.now();
      const invite: Invite = { id: `inv-${t}`, groupId, code: generateInviteCode(), issuedAt: t, useCount: 0, version: 1 };
      setInvites((prev) => [invite, ...prev]);
      const result = { ok: true as const, invite };
      operations.current.set(key, result);
      return result;
    },
    [roundTrip],
  );

  const revokeInvite = useCallback(
    async (inviteId: string, expectedVersion: number) => {
      const err = await roundTrip();
      if (err) return fail(err);
      const target = invitesRef.current.find((i) => i.id === inviteId);
      if (takeOnce('conflict') && target) {
        // 다른 참여자가 먼저 이 초대를 취소한 상황
        invitesRef.current = invitesRef.current.map((i) =>
          i.id === inviteId ? { ...i, revokedAt: Date.now(), version: i.version + 1 } : i,
        );
        setInvites(invitesRef.current);
        return fail('VERSION_CONFLICT' as const);
      }
      if (!target || target.version !== expectedVersion) return fail('VERSION_CONFLICT' as const);
      setInvites((prev) => prev.map((i) => (i.id === inviteId ? { ...i, revokedAt: Date.now(), version: i.version + 1 } : i)));
      return { ok: true as const };
    },
    [roundTrip, takeOnce],
  );

  const inviteProblem = (invite: Invite | undefined): InviteError | null => {
    if (!invite) return 'INVITE_INVALID';
    const st = inviteState(invite);
    if (st === 'revoked') return 'INVITE_REVOKED';
    if (st === 'exhausted') return 'INVITE_EXHAUSTED';
    if (st === 'expired') return 'INVITE_EXPIRED';
    const g = groupsRef.current.find((x) => x.id === invite.groupId);
    if (!g || g.closed) return 'GROUP_CLOSED';
    return null;
  };

  const previewInvite = useCallback(
    async (code: string) => {
      const err = await roundTrip();
      if (err) return fail(err);
      const invite = invitesRef.current.find((i) => i.code === code);
      const problem = inviteProblem(invite);
      if (problem || !invite) return fail(problem ?? 'INVITE_INVALID');
      // 성공한 확인마다 1회. 50회에 이르면 소진된다.
      invitesRef.current = invitesRef.current.map((i) => (i.id === invite.id ? { ...i, useCount: i.useCount + 1 } : i));
      setInvites(invitesRef.current);
      const g = groupsRef.current.find((x) => x.id === invite.groupId)!;
      const rep = representativeSchedule(schedulesRef.current.filter((sc) => sc.groupId === g.id));
      return {
        ok: true as const,
        preview: {
          code,
          groupId: g.id,
          groupName: g.name,
          schedule: rep ? { title: rep.schedule.title, startDate: rep.schedule.startDate, endDate: rep.schedule.endDate } : null,
        },
      };
    },
    [roundTrip],
  );

  const updateScheduleDay = useCallback(
    async (scheduleId: string, dayId: string, patch: { title: string; date: DateStr }) => {
      const err = await roundTrip();
      if (err) return fail(err);
      const sc = schedulesRef.current.find((x) => x.id === scheduleId);
      if (!sc) return fail('FORBIDDEN' as const);
      if (sc.status === 'cancelled') return fail('SCHEDULE_CANCELLED' as const);
      if (scenarioRef.current.textRejected) return fail('TEXT_REJECTED' as const);
      // 같은 모임의 다른 일정이 이미 쓰는 날짜로는 옮길 수 없다.
      if (takenDate(sc.groupId, patch.date, patch.date, sc.id)) return fail('DATE_TAKEN' as const);
      const itineraryId = ensureItinerary(sc.id);
      const range = updateDayInfo(itineraryId, dayId, { title: patch.title.normalize('NFC'), date: patch.date });
      if (!range) return fail('DATE_TAKEN' as const); // 같은 일정 안에 이미 있는 날짜
      setSchedules((prev) => prev.map((x) => (x.id === scheduleId ? { ...x, ...range, version: x.version + 1 } : x)));
      touch(sc.groupId);
      return { ok: true as const };
    },
    [ensureItinerary, roundTrip, updateDayInfo],
  );

  const cancelScheduleDay = useCallback(
    async (scheduleId: string, dayId: string) => {
      const err = await roundTrip();
      if (err) return fail(err);
      const sc = schedulesRef.current.find((x) => x.id === scheduleId);
      if (!sc) return fail('FORBIDDEN' as const);
      const itineraryId = ensureItinerary(sc.id);
      if (!updateDayInfo(itineraryId, dayId, { cancelled: true })) return fail('FORBIDDEN' as const);
      // 남은 (취소되지 않은) 날이 없으면 일정 전체를 취소 상태로 둔다.
      const stillActive = (itinerariesRefG.current.find((i) => i.id === itineraryId)?.days ?? [])
        .filter((d) => d.id !== dayId)
        .some((d) => !d.cancelled);
      if (!stillActive) setSchedules((prev) => prev.map((x) => (x.id === scheduleId ? { ...x, status: 'cancelled', version: x.version + 1 } : x)));
      touch(sc.groupId);
      return { ok: true as const };
    },
    [ensureItinerary, roundTrip, updateDayInfo],
  );

  const removeScheduleDay = useCallback(
    async (scheduleId: string, dayId: string) => {
      const err = await roundTrip();
      if (err) return fail(err);
      const sc = schedulesRef.current.find((x) => x.id === scheduleId);
      if (!sc) return fail('FORBIDDEN' as const);
      const itineraryId = ensureItinerary(sc.id);
      const result = removeDay(itineraryId, dayId);
      if (result === null) return fail('FORBIDDEN' as const);
      if (result === 'NOT_EMPTY') return fail('NOT_EMPTY' as const);
      if (result === 'ALL_GONE') setSchedules((prev) => prev.filter((x) => x.id !== scheduleId));
      else setSchedules((prev) => prev.map((x) => (x.id === scheduleId ? { ...x, ...result, version: x.version + 1 } : x)));
      touch(sc.groupId);
      return { ok: true as const };
    },
    [ensureItinerary, removeDay, roundTrip],
  );

  const setGroupCover = useCallback((groupId: string, uri: string) => {
    setAllGroups((prev) => prev.map((g) => (g.id === groupId ? { ...g, cover: { uri } } : g)));
  }, []);

  const removeMember = useCallback(
    async (groupId: string, name: string) => {
      const err = await roundTrip();
      if (err) return fail(err);
      const g = groupsRef.current.find((x) => x.id === groupId);
      // 방장만, 방장 본인이 아닌 참여자만 내보낼 수 있다.
      if (!g || g.myRole !== 'owner' || name === g.members[0] || !g.members.includes(name)) return fail('FORBIDDEN' as const);
      setAllGroups((prev) =>
        prev.map((x) =>
          x.id === groupId
            ? { ...x, members: x.members.filter((m) => m !== name), blocked: [...(x.blocked ?? []), name], activityAt: Date.now() }
            : x,
        ),
      );
      return { ok: true as const };
    },
    [roundTrip],
  );

  const joinInvite = useCallback(
    async (code: string, key: string) => {
      const done = operations.current.get(key) as { ok: true; groupId: string; alreadyMember: boolean } | undefined;
      const err = await roundTrip();
      if (err) return fail(err);
      if (done) return done;
      const invite = invitesRef.current.find((i) => i.code === code);
      const problem = inviteProblem(invite);
      if (problem || !invite) return fail(problem ?? 'INVITE_INVALID');
      const g = groupsRef.current.find((x) => x.id === invite.groupId)!;
      if (g.members.includes(me)) return { ok: true as const, groupId: g.id, alreadyMember: true };
      if (g.blockedMe || g.blocked?.includes(me)) return fail('REENTRY_BLOCKED' as const);
      if (scenarioRef.current.groupLimit) return fail('GROUP_LIMIT' as const);
      if (g.members.length >= MAX_MEMBERS) return fail('CAPACITY_FULL' as const);
      setAllGroups((prev) =>
        prev.map((x) => (x.id === g.id ? { ...x, members: [...x.members, me], myRole: 'member', activityAt: Date.now() } : x)),
      );
      const result = { ok: true as const, groupId: g.id, alreadyMember: false };
      operations.current.set(key, result);
      return result;
    },
    [me, roundTrip],
  );

  const value = useMemo<GroupsState>(
    () => ({
      restoring,
      restoreError,
      retryRestore,
      session,
      login,
      loadConsentDocs,
      completeOnboarding,
      logout,
      pendingInvite,
      setPendingInvite,
      groups,
      loadGroups,
      group,
      createGroup,
      operationGet,
      schedulesOf,
      schedule,
      loadCalendar,
      placeCount,
      firstPlaceName,
      ensureItinerary,
      createSchedule,
      updateSchedule,
      cancelSchedule,
      deleteSchedule,
      visitCount,
      invitesOf,
      loadInvites,
      updateScheduleDay,
      cancelScheduleDay,
      removeScheduleDay,
      setGroupCover,
      removeMember,
      createInvite,
      revokeInvite,
      previewInvite,
      joinInvite,
      flash,
      setFlash,
      calendarView,
      setCalendarView,
      scenario,
      setScenario,
    }),
    [
      restoring,
      restoreError,
      retryRestore,
      session,
      login,
      loadConsentDocs,
      completeOnboarding,
      logout,
      pendingInvite,
      groups,
      loadGroups,
      group,
      createGroup,
      operationGet,
      schedulesOf,
      schedule,
      loadCalendar,
      placeCount,
      firstPlaceName,
      ensureItinerary,
      createSchedule,
      updateSchedule,
      cancelSchedule,
      deleteSchedule,
      visitCount,
      invitesOf,
      loadInvites,
      createInvite,
      revokeInvite,
      previewInvite,
      joinInvite,
      flash,
      calendarView,
      scenario,
      setScenario,
    ],
  );

  return <GroupsContext.Provider value={value}>{children}</GroupsContext.Provider>;
}

export function useGroups(): GroupsState {
  const ctx = useContext(GroupsContext);
  if (!ctx) throw new Error('useGroups 는 GroupsProvider 안에서만 쓸 수 있습니다.');
  return ctx;
}

/** 화면이 열릴 때 넘겨받은 토스트 문구를 한 번 꺼낸다. */
export function useFlash(show: (message: string) => void) {
  const { flash, setFlash } = useGroups();
  useEffect(() => {
    if (!flash) return;
    show(flash);
    setFlash(null);
  }, [flash, setFlash, show]);
}

/** 화면마다 새 요청 키를 만든다. 같은 입력으로 다시 보내면 같은 키를 쓴다. */
export function newRequestKey() {
  return `req-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** 공통 실패 문구 */
export function commonErrorText(error: CommonError): string {
  return error === 'OFFLINE'
    ? '인터넷에 연결되어 있지 않아요. 연결을 확인하고 다시 시도해 주세요.'
    : '잠시 문제가 생겼어요. 다시 시도해 주세요.';
}
