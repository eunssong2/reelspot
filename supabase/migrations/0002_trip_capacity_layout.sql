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
