-- 릴스팟 스키마 전체 (0001 + 0002)
-- Supabase 대시보드 > SQL Editor 에 통째로 붙여넣고 Run 하세요.
-- 한 번만 실행하면 됩니다. 두 번 실행하면 'already exists' 에러가 납니다.

begin;

-- ========== 0001_init.sql ==========
-- 릴스팟 기본 스키마: 프로필 / 여행 방 / 스팟원
create type public.trip_role as enum ('owner', 'member');

-- ---------- profiles ----------
create table public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  nickname   text not null check (char_length(nickname) between 1 and 20),
  avatar_url text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "프로필은 누구나 조회" on public.profiles for select using (true);
create policy "본인 프로필만 생성" on public.profiles
  for insert with check (auth.uid() = id);
create policy "본인 프로필만 수정" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- 카카오 로그인은 닉네임/프로필 이미지를 메타데이터로 넘겨준다.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, nickname, avatar_url)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'name',
      new.raw_user_meta_data ->> 'full_name',
      '스팟원'
    ),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- trips ----------
create function public.generate_invite_code()
returns text
language sql
volatile
as $$
  -- 혼동되는 0/O/1/I 를 뺀 32자 중 6자리 = 약 10억 가지.
  -- 충돌하면 unique 제약에 걸려 insert 가 실패한다 (재시도는 호출 쪽 몫).
  select string_agg(
    substr('23456789ABCDEFGHJKLMNPQRSTUVWXYZ', floor(random() * 32 + 1)::int, 1),
    ''
  )
  from generate_series(1, 6);
$$;

create table public.trips (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references public.profiles (id) on delete cascade,
  title       text not null check (char_length(title) between 1 and 40),
  destination text not null,
  start_date  date not null,
  end_date    date not null,
  invite_code text not null unique default public.generate_invite_code(),
  created_at  timestamptz not null default now(),
  constraint trips_date_order check (end_date >= start_date)
);

create index trips_owner_idx on public.trips (owner_id);

-- ---------- trip_members (스팟원) ----------
create table public.trip_members (
  trip_id   uuid not null references public.trips (id) on delete cascade,
  user_id   uuid not null references public.profiles (id) on delete cascade,
  role      public.trip_role not null default 'member',
  joined_at timestamptz not null default now(),
  primary key (trip_id, user_id)
);

create index trip_members_user_idx on public.trip_members (user_id);

-- 방장 포함 최대 5명. 동시 참여를 막으려면 행 잠금이 필요하다.
create function public.enforce_trip_capacity()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  current_count int;
begin
  perform 1 from public.trips where id = new.trip_id for update;

  select count(*) into current_count
  from public.trip_members
  where trip_id = new.trip_id;

  if current_count >= 5 then
    raise exception '스팟원은 방장 포함 최대 5명까지 참여할 수 있습니다.'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger trip_members_capacity
  before insert on public.trip_members
  for each row execute function public.enforce_trip_capacity();

-- 방을 만든 사람은 자동으로 방장 스팟원이 된다.
create function public.add_owner_as_member()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.trip_members (trip_id, user_id, role)
  values (new.id, new.owner_id, 'owner');
  return new;
end;
$$;

create trigger trips_add_owner
  after insert on public.trips
  for each row execute function public.add_owner_as_member();

-- ---------- RLS ----------
alter table public.trips enable row level security;
alter table public.trip_members enable row level security;

-- 내가 속한 방인지 확인한다. RLS 정책 안에서 trip_members 를 직접 조회하면
-- 정책이 서로를 부르며 무한 재귀가 나므로 security definer 함수로 우회한다.
create function public.is_trip_member(in_trip_id uuid)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.trip_members
    where trip_id = in_trip_id and user_id = auth.uid()
  );
$$;

create policy "내가 속한 방만 조회" on public.trips
  for select using (public.is_trip_member(id));
create policy "로그인 사용자는 방 생성" on public.trips
  for insert with check (auth.uid() = owner_id);
create policy "방장만 방 수정" on public.trips
  for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy "방장만 방 삭제" on public.trips
  for delete using (auth.uid() = owner_id);

create policy "같은 방 스팟원끼리 조회" on public.trip_members
  for select using (public.is_trip_member(trip_id));
create policy "본인만 스팟원으로 참여" on public.trip_members
  for insert with check (auth.uid() = user_id);
create policy "본인만 방 나가기" on public.trip_members
  for delete using (auth.uid() = user_id);

-- ---------- 초대 코드로 참여 ----------
-- 코드만 아는 사람은 trips 를 select 할 수 없으므로(RLS) 함수로 참여시킨다.
create function public.join_trip_by_code(in_code text)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  target_trip uuid;
begin
  select id into target_trip
  from public.trips
  where invite_code = upper(trim(in_code));

  if target_trip is null then
    raise exception '초대 코드를 찾을 수 없습니다.' using errcode = 'no_data_found';
  end if;

  insert into public.trip_members (trip_id, user_id, role)
  values (target_trip, auth.uid(), 'member')
  on conflict (trip_id, user_id) do nothing;

  return target_trip;
end;
$$;

grant execute on function public.join_trip_by_code(text) to authenticated;

-- ========== 0002_trip_capacity_layout.sql ==========
-- 여행마다 스팟원 정원(1~5)과 화면 배치를 고른다.
alter table public.trips
  add column capacity int not null default 5 check (capacity between 1 and 5),
  add column layout text not null default 'single';

-- 정원을 고정 5명이 아니라 방마다 정한 값으로 본다.
create or replace function public.enforce_trip_capacity()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  seats int;
  taken int;
begin
  -- 동시에 두 명이 마지막 자리에 들어오는 걸 막으려면 방 행을 잠가야 한다.
  select capacity into seats from public.trips where id = new.trip_id for update;

  select count(*) into taken
  from public.trip_members
  where trip_id = new.trip_id;

  if taken >= seats then
    raise exception '스팟원 정원(%명)이 모두 찼습니다.', seats
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

-- 레이아웃의 칸 수와 정원은 같아야 한다. 정원을 줄이면 배치도 같이 맞춘다.
create or replace function public.join_trip_by_code(in_code text)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  target_trip uuid;
begin
  select id into target_trip
  from public.trips
  where invite_code = upper(trim(in_code));

  if target_trip is null then
    raise exception '초대 코드를 찾을 수 없습니다.' using errcode = 'no_data_found';
  end if;

  insert into public.trip_members (trip_id, user_id, role)
  values (target_trip, auth.uid(), 'member')
  on conflict (trip_id, user_id) do nothing;

  return target_trip;
end;
$$;

-- 정원은 이미 들어온 스팟원 수보다 작아질 수 없다.
create function public.enforce_capacity_not_below_members()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  taken int;
begin
  if new.capacity >= old.capacity then
    return new;
  end if;

  select count(*) into taken from public.trip_members where trip_id = new.id;

  if new.capacity < taken then
    raise exception '이미 스팟원이 %명이라 정원을 그보다 줄일 수 없습니다.', taken
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger trips_capacity_floor
  before update of capacity on public.trips
  for each row execute function public.enforce_capacity_not_below_members();

commit;
