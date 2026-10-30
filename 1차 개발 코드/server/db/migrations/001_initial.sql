-- At that place v0.3 / PostgreSQL 16. Empty database baseline, not application implementation.
-- Run: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f 001_initial.sql
BEGIN;
SELECT pg_advisory_xact_lock(74103102);
CREATE SCHEMA atp;
REVOKE ALL ON SCHEMA atp FROM PUBLIC;
SET LOCAL search_path = atp, pg_catalog;
CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name text NOT NULL CHECK (btrim(display_name) <> '' AND display_name !~ E'[\n\r]'),
  status text NOT NULL DEFAULT 'onboarding' CHECK (status IN ('onboarding','active','restricted','deleting','deleted')),
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

COMMENT ON COLUMN users.id IS '내부 불변 식별자';

COMMENT ON COLUMN users.display_name IS 'NFC 후 grapheme 1~20은 API 검증';

COMMENT ON COLUMN users.status IS '계정 생명주기';

COMMENT ON COLUMN users.version IS 'API가 expectedVersion 검증 후 +1';

COMMENT ON COLUMN users.created_at IS '서버 생성 시각';

COMMENT ON COLUMN users.deleted_at IS '개인정보 정리 시각';

CREATE INDEX users_status_idx ON users(status);

CREATE TABLE identities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE NO ACTION,
  provider text NOT NULL CHECK (provider IN ('kakao','google')),
  provider_subject text NOT NULL,
  linked_at timestamptz NOT NULL DEFAULT now(),
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  UNIQUE(provider,provider_subject)
);

COMMENT ON COLUMN identities.id IS '내부 불변 식별자';

COMMENT ON COLUMN identities.user_id IS '참조 대상';

COMMENT ON COLUMN identities.provider IS '이메일 자동병합 없음';

COMMENT ON COLUMN identities.provider_subject IS '검증한 공급자 subject';

COMMENT ON COLUMN identities.linked_at IS '연결시각';

COMMENT ON COLUMN identities.version IS 'API가 expectedVersion 검증 후 +1';

CREATE INDEX identities_user_idx ON identities(user_id);

CREATE TABLE sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE NO ACTION,
  device_id text NOT NULL,
  refresh_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  reauthenticated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON COLUMN sessions.id IS '내부 불변 식별자';

COMMENT ON COLUMN sessions.user_id IS '참조 대상';

COMMENT ON COLUMN sessions.device_id IS '앱 설치별 임의 식별자';

COMMENT ON COLUMN sessions.refresh_hash IS 'refresh 원문 미저장';

COMMENT ON COLUMN sessions.expires_at IS '세션 만료';

COMMENT ON COLUMN sessions.revoked_at IS '폐기 시각';

COMMENT ON COLUMN sessions.reauthenticated_at IS '재인증 시각';

COMMENT ON COLUMN sessions.created_at IS '서버 생성 시각';

CREATE INDEX sessions_user_idx ON sessions(user_id,revoked_at);

CREATE TABLE consent_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_key text NOT NULL,
  version text NOT NULL,
  required boolean NOT NULL,
  content_ref text NOT NULL,
  content_hash text NOT NULL,
  effective_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(item_key,version)
);

COMMENT ON COLUMN consent_documents.id IS '내부 불변 식별자';

COMMENT ON COLUMN consent_documents.item_key IS '동의 항목';

COMMENT ON COLUMN consent_documents.version IS '불변 문서 버전';

COMMENT ON COLUMN consent_documents.required IS '필수 여부';

COMMENT ON COLUMN consent_documents.content_ref IS '문서 경로';

COMMENT ON COLUMN consent_documents.content_hash IS '문서 SHA256';

COMMENT ON COLUMN consent_documents.effective_at IS '적용시각';

COMMENT ON COLUMN consent_documents.created_at IS '서버 생성 시각';

CREATE TABLE operations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid NOT NULL REFERENCES users(id) ON DELETE NO ACTION,
  idempotency_key text NOT NULL,
  route text NOT NULL,
  request_hash text NOT NULL,
  kind text NOT NULL,
  state text NOT NULL DEFAULT 'pending' CHECK (state IN ('pending','review','succeeded','failed')),
  response_snapshot jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  UNIQUE(actor_id,route,idempotency_key)
);

COMMENT ON COLUMN operations.id IS '내부 불변 식별자';

COMMENT ON COLUMN operations.actor_id IS '참조 대상';

COMMENT ON COLUMN operations.idempotency_key IS '네트워크 멱등키';

COMMENT ON COLUMN operations.route IS 'operationId';

COMMENT ON COLUMN operations.request_hash IS '정규화 요청 SHA256';

COMMENT ON COLUMN operations.kind IS '업무 결과 종류';

COMMENT ON COLUMN operations.state IS '진행 상태';

COMMENT ON COLUMN operations.response_snapshot IS '응답 재사용, 토큰 등 민감값 별도 암호화';

COMMENT ON COLUMN operations.created_at IS '서버 생성 시각';

COMMENT ON COLUMN operations.finished_at IS '확정시각';

CREATE INDEX operations_actor_idx ON operations(actor_id,created_at DESC);

CREATE TABLE consent_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE NO ACTION,
  document_id uuid NOT NULL REFERENCES consent_documents(id) ON DELETE NO ACTION,
  agreed boolean NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  operation_id uuid NOT NULL REFERENCES operations(id) ON DELETE NO ACTION,
  UNIQUE(operation_id,document_id)
);

COMMENT ON COLUMN consent_events.id IS '내부 불변 식별자';

COMMENT ON COLUMN consent_events.user_id IS '참조 대상';

COMMENT ON COLUMN consent_events.document_id IS '참조 대상';

COMMENT ON COLUMN consent_events.agreed IS '동의/철회';

COMMENT ON COLUMN consent_events.occurred_at IS '서버 시각';

COMMENT ON COLUMN consent_events.operation_id IS '참조 대상';

CREATE INDEX consent_events_user_idx ON consent_events(user_id,document_id,occurred_at DESC);

CREATE TABLE groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (btrim(name) <> ''),
  owner_user_id uuid NOT NULL REFERENCES users(id) ON DELETE NO ACTION,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','closed')),
  cover_asset_id uuid,
  activity_at timestamptz NOT NULL DEFAULT now(),
  completed_bytes bigint NOT NULL DEFAULT 0 CHECK (completed_bytes >= 0),
  reserved_bytes bigint NOT NULL DEFAULT 0 CHECK (reserved_bytes >= 0),
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  CHECK(completed_bytes + reserved_bytes <= 5000000000),
  CHECK ((status='closed') = (closed_at IS NOT NULL))
);

COMMENT ON COLUMN groups.id IS '내부 불변 식별자';

COMMENT ON COLUMN groups.name IS 'grapheme 1~50, 공개 전 검사';

COMMENT ON COLUMN groups.owner_user_id IS '참조 대상';

COMMENT ON COLUMN groups.status IS '종료 후 재개 불가';

COMMENT ON COLUMN groups.cover_asset_id IS 'assets 생성 후 지연 FK 연결';

COMMENT ON COLUMN groups.activity_at IS '공동 활동만 갱신';

COMMENT ON COLUMN groups.completed_bytes IS '물리 정리 전 원본 포함';

COMMENT ON COLUMN groups.reserved_bytes IS '미완료 전송 예약';

COMMENT ON COLUMN groups.version IS 'API가 expectedVersion 검증 후 +1';

COMMENT ON COLUMN groups.created_at IS '서버 생성 시각';

COMMENT ON COLUMN groups.closed_at IS '종료 확정시각';

CREATE INDEX groups_activity_idx ON groups(activity_at DESC,created_at DESC,id DESC);

CREATE TABLE memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES groups(id) ON DELETE NO ACTION,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE NO ACTION,
  joined_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  end_reason text CHECK (end_reason IN ('left','removed','group_closed','account_deleted')),
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  CHECK ((ended_at IS NULL) = (end_reason IS NULL))
);

COMMENT ON COLUMN memberships.id IS '내부 불변 식별자';

COMMENT ON COLUMN memberships.group_id IS '참조 대상';

COMMENT ON COLUMN memberships.user_id IS '참조 대상';

COMMENT ON COLUMN memberships.joined_at IS '재가입은 새 ID';

COMMENT ON COLUMN memberships.ended_at IS 'NULL이면 활성';

COMMENT ON COLUMN memberships.end_reason IS '종료 사유';

COMMENT ON COLUMN memberships.version IS 'API가 expectedVersion 검증 후 +1';

CREATE UNIQUE INDEX memberships_active_uq ON memberships(group_id,user_id) WHERE ended_at IS NULL;

CREATE INDEX memberships_user_idx ON memberships(user_id,ended_at);

CREATE TABLE reentry_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES groups(id) ON DELETE NO ACTION,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE NO ACTION,
  created_by uuid NOT NULL REFERENCES users(id) ON DELETE NO ACTION,
  cleared_at timestamptz,
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON COLUMN reentry_blocks.id IS '내부 불변 식별자';

COMMENT ON COLUMN reentry_blocks.group_id IS '참조 대상';

COMMENT ON COLUMN reentry_blocks.user_id IS '참조 대상';

COMMENT ON COLUMN reentry_blocks.created_by IS '참조 대상';

COMMENT ON COLUMN reentry_blocks.cleared_at IS '해제시각';

COMMENT ON COLUMN reentry_blocks.version IS 'API가 expectedVersion 검증 후 +1';

COMMENT ON COLUMN reentry_blocks.created_at IS '서버 생성 시각';

CREATE UNIQUE INDEX reentry_blocks_active_uq ON reentry_blocks(group_id,user_id) WHERE cleared_at IS NULL;

CREATE TABLE invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES groups(id) ON DELETE NO ACTION,
  issuer_user_id uuid NOT NULL REFERENCES users(id) ON DELETE NO ACTION,
  code_hash text NOT NULL UNIQUE,
  token_hash text NOT NULL UNIQUE,
  code_ciphertext bytea NOT NULL,
  token_ciphertext bytea NOT NULL,
  issued_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  use_count integer NOT NULL DEFAULT 0 CHECK (use_count BETWEEN 0 AND 50),
  max_uses integer NOT NULL DEFAULT 50 CHECK (max_uses = 50),
  exhausted_at timestamptz,
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  CHECK(expires_at = issued_at + interval '168 hours'),
  CHECK((use_count >= max_uses) = (exhausted_at IS NOT NULL))
);

COMMENT ON COLUMN invitations.id IS '내부 불변 식별자';

COMMENT ON COLUMN invitations.group_id IS '참조 대상';

COMMENT ON COLUMN invitations.issuer_user_id IS '참조 대상';

COMMENT ON COLUMN invitations.code_hash IS '조회용 hash';

COMMENT ON COLUMN invitations.token_hash IS '링크 토큰 hash';

COMMENT ON COLUMN invitations.code_ciphertext IS '재조회용 암호문';

COMMENT ON COLUMN invitations.token_ciphertext IS '재조회용 암호문';

COMMENT ON COLUMN invitations.issued_at IS '발급 서버시각';

COMMENT ON COLUMN invitations.expires_at IS '168시간 뒤';

COMMENT ON COLUMN invitations.revoked_at IS '개별 취소';

COMMENT ON COLUMN invitations.use_count IS '초대 확인(미리보기) 응답 횟수';

COMMENT ON COLUMN invitations.max_uses IS '소진 한도';

COMMENT ON COLUMN invitations.exhausted_at IS '50회 도달 시각';

COMMENT ON COLUMN invitations.version IS 'API가 expectedVersion 검증 후 +1';

CREATE INDEX invitations_group_idx ON invitations(group_id,issued_at DESC);

CREATE TABLE schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES groups(id) ON DELETE NO ACTION,
  title text NOT NULL CHECK(btrim(title)<>''),
  start_date date NOT NULL,
  end_date date NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','cancelled','deleted')),
  cancelled_at timestamptz,
  cancelled_end_date date,
  retention_fixed_at timestamptz,
  retention_last_date date,
  expires_at timestamptz,
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(id,group_id),
  CHECK(end_date >= start_date AND end_date-start_date <=365),
  CHECK(num_nonnulls(retention_fixed_at,retention_last_date,expires_at) IN (0,3))
);

COMMENT ON COLUMN schedules.id IS '내부 불변 식별자';

COMMENT ON COLUMN schedules.group_id IS '참조 대상';

COMMENT ON COLUMN schedules.title IS 'grapheme 1~100';

COMMENT ON COLUMN schedules.start_date IS 'KST 시작 날짜';

COMMENT ON COLUMN schedules.end_date IS 'KST 포함 종료 날짜. 시각·반복 없음';

COMMENT ON COLUMN schedules.status IS '일정 상태';

COMMENT ON COLUMN schedules.cancelled_at IS '취소 전 접수 비교';

COMMENT ON COLUMN schedules.cancelled_end_date IS '취소 직전 종료일';

COMMENT ON COLUMN schedules.retention_fixed_at IS '첫 완료에서 고정';

COMMENT ON COLUMN schedules.retention_last_date IS '보관 마지막 날';

COMMENT ON COLUMN schedules.expires_at IS '다음날 00:00 KST';

COMMENT ON COLUMN schedules.version IS 'API가 expectedVersion 검증 후 +1';

COMMENT ON COLUMN schedules.created_at IS '서버 생성 시각';

CREATE INDEX schedules_calendar_idx ON schedules(group_id,start_date,end_date);

CREATE INDEX schedules_expiry_idx ON schedules(expires_at) WHERE expires_at IS NOT NULL;

CREATE TABLE places (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES groups(id) ON DELETE NO ACTION,
  provider text NOT NULL CHECK(provider IN ('kakao','manual')),
  provider_place_id text,
  name text NOT NULL CHECK(btrim(name)<>''),
  address text,
  latitude numeric(9,6) CHECK(latitude BETWEEN -90 AND 90),
  longitude numeric(9,6) CHECK(longitude BETWEEN -180 AND 180),
  normalized_fingerprint text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(id,group_id),
  CHECK((latitude IS NULL)=(longitude IS NULL)),
  CHECK((provider='manual' AND provider_place_id IS NULL) OR (provider='kakao' AND provider_place_id IS NOT NULL))
);

COMMENT ON COLUMN places.id IS '내부 불변 식별자';

COMMENT ON COLUMN places.group_id IS '참조 대상';

COMMENT ON COLUMN places.provider IS '장소 원천';

COMMENT ON COLUMN places.provider_place_id IS '공급자 ID';

COMMENT ON COLUMN places.name IS 'grapheme 최대100';

COMMENT ON COLUMN places.address IS 'grapheme 최대200';

COMMENT ON COLUMN places.latitude IS '선택 위도';

COMMENT ON COLUMN places.longitude IS '선택 경도';

COMMENT ON COLUMN places.normalized_fingerprint IS '모임 내 중복 비교';

COMMENT ON COLUMN places.created_at IS '서버 생성 시각';

CREATE INDEX places_provider_idx ON places(group_id,provider,provider_place_id);

CREATE TABLE day_plans (
  schedule_id uuid NOT NULL REFERENCES schedules(id) ON DELETE NO ACTION,
  plan_date date NOT NULL,
  title text,
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(schedule_id,plan_date)
);

COMMENT ON COLUMN day_plans.schedule_id IS '참조 대상';

COMMENT ON COLUMN day_plans.plan_date IS '정리·필터 속성';

COMMENT ON COLUMN day_plans.title IS '빈값은 날짜 표시, 최대30 graphemes';

COMMENT ON COLUMN day_plans.version IS 'API가 expectedVersion 검증 후 +1';

COMMENT ON COLUMN day_plans.created_at IS '서버 생성 시각';

CREATE TABLE visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id uuid NOT NULL REFERENCES schedules(id) ON DELETE NO ACTION,
  place_id uuid NOT NULL REFERENCES places(id) ON DELETE NO ACTION,
  visit_date date NOT NULL,
  position integer CHECK(position>=0),
  planned_time time CHECK(planned_time<'24:00'::time AND extract(second FROM planned_time)=0 AND extract(minute FROM planned_time)::int%5=0),
  dedupe_key text NOT NULL,
  deleted_at timestamptz,
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(id,schedule_id,visit_date),
  UNIQUE(schedule_id,visit_date,position) DEFERRABLE INITIALLY DEFERRED,
  CHECK((deleted_at IS NULL)=(position IS NOT NULL))
);

COMMENT ON COLUMN visits.id IS '내부 불변 식별자';

COMMENT ON COLUMN visits.schedule_id IS '참조 대상';

COMMENT ON COLUMN visits.place_id IS '참조 대상';

COMMENT ON COLUMN visits.visit_date IS '방문일';

COMMENT ON COLUMN visits.position IS '활성은 필수, 삭제 후 NULL';

COMMENT ON COLUMN visits.planned_time IS '00:00~23:55 또는 NULL(시간 미정). 추가 시 입력, 날짜별 활성 방문 15개 트리거';

COMMENT ON COLUMN visits.dedupe_key IS '공급자 ID 또는 정규화 수기정보';

COMMENT ON COLUMN visits.deleted_at IS '빈 방문 삭제 tombstone';

COMMENT ON COLUMN visits.version IS 'API가 expectedVersion 검증 후 +1';

COMMENT ON COLUMN visits.created_at IS '서버 생성 시각';

CREATE UNIQUE INDEX visits_active_dedupe_uq ON visits(schedule_id,visit_date,dedupe_key) WHERE deleted_at IS NULL;

CREATE TABLE submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id uuid NOT NULL REFERENCES schedules(id) ON DELETE NO ACTION,
  author_user_id uuid NOT NULL REFERENCES users(id) ON DELETE NO ACTION,
  first_completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(id,schedule_id,author_user_id)
);

COMMENT ON COLUMN submissions.id IS '내부 불변 식별자';

COMMENT ON COLUMN submissions.schedule_id IS '참조 대상';

COMMENT ON COLUMN submissions.author_user_id IS '참조 대상';

COMMENT ON COLUMN submissions.first_completed_at IS '첫 완료 이후 불변';

COMMENT ON COLUMN submissions.created_at IS '서버 생성 시각';

CREATE INDEX submissions_sort_idx ON submissions(schedule_id,first_completed_at DESC,id DESC);

CREATE TABLE upload_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid,
  schedule_id uuid,
  author_user_id uuid NOT NULL REFERENCES users(id) ON DELETE NO ACTION,
  cover_group_id uuid REFERENCES groups(id) ON DELETE NO ACTION,
  client_file_id text NOT NULL,
  selection_index integer CHECK(selection_index BETWEEN 0 AND 119),
  kind text NOT NULL CHECK(kind IN ('photo','video')),
  fingerprint text NOT NULL CHECK(fingerprint ~ '^[0-9a-f]{64}$'),
  checksum text CHECK(checksum ~ '^[0-9a-f]{64}$'),
  record_date date,
  visit_id uuid,
  description text NOT NULL DEFAULT '',
  accepted_at timestamptz NOT NULL DEFAULT now(),
  state text NOT NULL DEFAULT 'queued' CHECK (state IN ('queued','uploading','verifying','review','complete','failed','cancelled')),
  reserved_bytes bigint NOT NULL CHECK(reserved_bytes>=0),
  declared_bytes bigint NOT NULL CHECK(declared_bytes BETWEEN 1 AND 200000000),
  actual_bytes bigint CHECK(actual_bytes>=0),
  quarantine_key text NOT NULL,
  upload_offset bigint NOT NULL DEFAULT 0 CHECK(upload_offset>=0),
  upload_generation integer NOT NULL DEFAULT 1 CHECK(upload_generation>0),
  transport_expires_at timestamptz NOT NULL,
  chunk_manifest jsonb NOT NULL DEFAULT '[]'::jsonb CHECK(jsonb_typeof(chunk_manifest)='array'),
  error_code text,
  cancel_requested_at timestamptz,
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(submission_id,selection_index),
  UNIQUE(id,schedule_id,author_user_id,submission_id),
  FOREIGN KEY(submission_id,schedule_id,author_user_id) REFERENCES submissions(id,schedule_id,author_user_id) ON DELETE NO ACTION,
  FOREIGN KEY(visit_id,schedule_id,record_date) REFERENCES visits(id,schedule_id,visit_date) ON DELETE NO ACTION,
  CHECK((cover_group_id IS NULL AND submission_id IS NOT NULL AND schedule_id IS NOT NULL AND record_date IS NOT NULL AND selection_index IS NOT NULL) OR (cover_group_id IS NOT NULL AND submission_id IS NULL AND schedule_id IS NULL AND record_date IS NULL AND selection_index IS NULL AND visit_id IS NULL)),
  CHECK(upload_offset<=declared_bytes)
);

COMMENT ON COLUMN upload_tasks.id IS '내부 불변 식별자';

COMMENT ON COLUMN upload_tasks.submission_id IS '기록일 때 필수';

COMMENT ON COLUMN upload_tasks.schedule_id IS '기록일 때 필수';

COMMENT ON COLUMN upload_tasks.author_user_id IS '참조 대상';

COMMENT ON COLUMN upload_tasks.cover_group_id IS '참조 대상';

COMMENT ON COLUMN upload_tasks.client_file_id IS '후보별 클라이언트 ID';

COMMENT ON COLUMN upload_tasks.selection_index IS '기록일 때 필수';

COMMENT ON COLUMN upload_tasks.kind IS '선언 종류, 서버 probe와 대조. 작성자×방문 사진5/영상2 트리거';

COMMENT ON COLUMN upload_tasks.fingerprint IS '원본 SHA256';

COMMENT ON COLUMN upload_tasks.checksum IS '서버 전체 파일 SHA256';

COMMENT ON COLUMN upload_tasks.record_date IS '기록일 때 필수';

COMMENT ON COLUMN upload_tasks.visit_id IS '미지정 가능';

COMMENT ON COLUMN upload_tasks.description IS '최대1000 graphemes';

COMMENT ON COLUMN upload_tasks.accepted_at IS '원래 접수, retry로 변경 금지';

COMMENT ON COLUMN upload_tasks.state IS '서버 업무 상태';

COMMENT ON COLUMN upload_tasks.reserved_bytes IS '현재 예약량';

COMMENT ON COLUMN upload_tasks.declared_bytes IS '원본 예정 크기';

COMMENT ON COLUMN upload_tasks.actual_bytes IS '서버 확인 원본 크기';

COMMENT ON COLUMN upload_tasks.quarantine_key IS '비공개 원본 또는 청크 prefix';

COMMENT ON COLUMN upload_tasks.upload_offset IS 'DB가 확정한 누적 바이트';

COMMENT ON COLUMN upload_tasks.upload_generation IS '재시도 transport 세대';

COMMENT ON COLUMN upload_tasks.transport_expires_at IS '재개 세션 만료';

COMMENT ON COLUMN upload_tasks.chunk_manifest IS '불변 청크 key/offset/size/hash';

COMMENT ON COLUMN upload_tasks.error_code IS '파일별 실패';

COMMENT ON COLUMN upload_tasks.cancel_requested_at IS '취소 선행 여부';

COMMENT ON COLUMN upload_tasks.version IS 'API가 expectedVersion 검증 후 +1';

COMMENT ON COLUMN upload_tasks.created_at IS '서버 생성 시각';

CREATE INDEX upload_tasks_author_idx ON upload_tasks(author_user_id,state);

CREATE INDEX upload_tasks_schedule_idx ON upload_tasks(schedule_id,state);

CREATE TABLE media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL UNIQUE,
  submission_id uuid NOT NULL,
  schedule_id uuid NOT NULL,
  author_user_id uuid NOT NULL REFERENCES users(id) ON DELETE NO ACTION,
  record_date date NOT NULL,
  visit_id uuid,
  description text NOT NULL DEFAULT '',
  kind text NOT NULL CHECK(kind IN ('photo','video')),
  mime text NOT NULL,
  original_bytes bigint NOT NULL CHECK(original_bytes>0),
  captured_at timestamptz,
  completed_at timestamptz NOT NULL,
  selection_index integer NOT NULL CHECK(selection_index BETWEEN 0 AND 119),
  access_state text NOT NULL DEFAULT 'available' CHECK(access_state IN ('available','deleted','expired','restricted')),
  moderation_state text NOT NULL CHECK(moderation_state IN ('passed','review','restricted')),
  deleted_at timestamptz,
  purged_at timestamptz,
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(task_id,schedule_id,author_user_id,submission_id) REFERENCES upload_tasks(id,schedule_id,author_user_id,submission_id) ON DELETE NO ACTION,
  FOREIGN KEY(visit_id,schedule_id,record_date) REFERENCES visits(id,schedule_id,visit_date) ON DELETE NO ACTION
);

COMMENT ON COLUMN media.id IS '내부 불변 식별자';

COMMENT ON COLUMN media.task_id IS '업로드 작업당 완료 1회';

COMMENT ON COLUMN media.submission_id IS '묶음';

COMMENT ON COLUMN media.schedule_id IS '일정';

COMMENT ON COLUMN media.author_user_id IS '참조 대상';

COMMENT ON COLUMN media.record_date IS '정리용 기록일';

COMMENT ON COLUMN media.visit_id IS '미지정 가능';

COMMENT ON COLUMN media.description IS '최대1000 graphemes';

COMMENT ON COLUMN media.kind IS '파일 종류';

COMMENT ON COLUMN media.mime IS '서버 probe 결과';

COMMENT ON COLUMN media.original_bytes IS '원본 업로드 바이트';

COMMENT ON COLUMN media.captured_at IS '촬영시각, 없는 값 생성 금지';

COMMENT ON COLUMN media.completed_at IS '공개 완료시각';

COMMENT ON COLUMN media.selection_index IS '최초 선택 순서';

COMMENT ON COLUMN media.access_state IS '접근 상태';

COMMENT ON COLUMN media.moderation_state IS '운영 상태';

COMMENT ON COLUMN media.deleted_at IS '새 접근 차단';

COMMENT ON COLUMN media.purged_at IS '실제 원본/파생 정리 완료';

COMMENT ON COLUMN media.version IS 'API가 expectedVersion 검증 후 +1';

COMMENT ON COLUMN media.created_at IS '서버 생성 시각';

CREATE INDEX media_author_idx ON media(author_user_id,completed_at DESC,id DESC);

CREATE INDEX media_schedule_idx ON media(schedule_id,record_date,visit_id);

CREATE TABLE assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  media_id uuid REFERENCES media(id) ON DELETE NO ACTION,
  cover_group_id uuid REFERENCES groups(id) ON DELETE NO ACTION,
  variant text NOT NULL CHECK(variant IN ('original_private','sanitized_original','view','thumbnail')),
  object_key text NOT NULL UNIQUE,
  bytes bigint NOT NULL CHECK(bytes>0),
  checksum text NOT NULL,
  location_verified_absent boolean NOT NULL DEFAULT false,
  probe_result jsonb NOT NULL,
  state text NOT NULL DEFAULT 'staged' CHECK (state IN ('staged','ready','delete_pending','purged')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK(num_nonnulls(media_id,cover_group_id)=1),
  CHECK(state<>'ready' OR variant='original_private' OR location_verified_absent)
);

COMMENT ON COLUMN assets.id IS '내부 불변 식별자';

COMMENT ON COLUMN assets.media_id IS '참조 대상';

COMMENT ON COLUMN assets.cover_group_id IS '참조 대상';

COMMENT ON COLUMN assets.variant IS '원본 직접 배포 금지';

COMMENT ON COLUMN assets.object_key IS 'private key';

COMMENT ON COLUMN assets.bytes IS '객체 크기';

COMMENT ON COLUMN assets.checksum IS '객체 SHA256';

COMMENT ON COLUMN assets.location_verified_absent IS '위치 제거 검증';

COMMENT ON COLUMN assets.probe_result IS '길이·회전·음성·형식 검사';

COMMENT ON COLUMN assets.state IS '객체 상태';

COMMENT ON COLUMN assets.created_at IS '서버 생성 시각';

CREATE INDEX assets_media_idx ON assets(media_id,variant);

CREATE TABLE metadata_operations (
  id uuid PRIMARY KEY REFERENCES operations(id) ON DELETE NO ACTION,
  author_user_id uuid NOT NULL REFERENCES users(id) ON DELETE NO ACTION,
  schedule_id uuid NOT NULL REFERENCES schedules(id) ON DELETE NO ACTION,
  targets jsonb NOT NULL,
  fields jsonb NOT NULL,
  state text NOT NULL DEFAULT 'pending_check' CHECK (state IN ('pending_check','review','applying','succeeded','failed')),
  item_errors jsonb,
  result jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON COLUMN metadata_operations.id IS '공통 operationId와 동일';

COMMENT ON COLUMN metadata_operations.author_user_id IS '참조 대상';

COMMENT ON COLUMN metadata_operations.schedule_id IS '참조 대상';

COMMENT ON COLUMN metadata_operations.targets IS '1~120개의 id/expectedVersion';

COMMENT ON COLUMN metadata_operations.fields IS 'apply/value';

COMMENT ON COLUMN metadata_operations.state IS '내부 상태';

COMMENT ON COLUMN metadata_operations.item_errors IS '대상별 미적용 사유';

COMMENT ON COLUMN metadata_operations.result IS 'typed MetadataChangeResult';

COMMENT ON COLUMN metadata_operations.created_at IS '서버 생성 시각';

CREATE INDEX metadata_operations_author_idx ON metadata_operations(author_user_id,state);

CREATE TABLE personal_blocks (
  blocker_user_id uuid NOT NULL REFERENCES users(id) ON DELETE NO ACTION,
  blocked_user_id uuid NOT NULL REFERENCES users(id) ON DELETE NO ACTION,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(blocker_user_id,blocked_user_id),
  CHECK(blocker_user_id<>blocked_user_id)
);

COMMENT ON COLUMN personal_blocks.blocker_user_id IS '참조 대상';

COMMENT ON COLUMN personal_blocks.blocked_user_id IS '참조 대상';

COMMENT ON COLUMN personal_blocks.created_at IS '서버 생성 시각';

CREATE TABLE reports_and_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_user_id uuid REFERENCES users(id) ON DELETE NO ACTION,
  type text NOT NULL CHECK(type IN ('report','scan','appeal','inquiry')),
  target_type text NOT NULL,
  target_id uuid NOT NULL,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'received' CHECK (status IN ('received','reviewing','decided','closed')),
  evidence_ref text,
  review_due_at timestamptz NOT NULL,
  closed_at timestamptz,
  evidence_delete_at timestamptz,
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK(evidence_delete_at IS NULL OR (closed_at IS NOT NULL AND evidence_delete_at<=closed_at+interval '90 days'))
);

COMMENT ON COLUMN reports_and_cases.id IS '내부 불변 식별자';

COMMENT ON COLUMN reports_and_cases.reporter_user_id IS '참조 대상';

COMMENT ON COLUMN reports_and_cases.type IS '운영 케이스';

COMMENT ON COLUMN reports_and_cases.target_type IS 'media/cover/member 등';

COMMENT ON COLUMN reports_and_cases.target_id IS '유형별 서비스 검증';

COMMENT ON COLUMN reports_and_cases.reason IS '최대2000 graphemes';

COMMENT ON COLUMN reports_and_cases.status IS '운영 상태';

COMMENT ON COLUMN reports_and_cases.evidence_ref IS '암호화 최소 증거';

COMMENT ON COLUMN reports_and_cases.review_due_at IS '최초24h/이의3영업일';

COMMENT ON COLUMN reports_and_cases.closed_at IS '종료시각';

COMMENT ON COLUMN reports_and_cases.evidence_delete_at IS '종료 후90일 이내';

COMMENT ON COLUMN reports_and_cases.version IS 'API가 expectedVersion 검증 후 +1';

COMMENT ON COLUMN reports_and_cases.created_at IS '서버 생성 시각';

CREATE INDEX cases_queue_idx ON reports_and_cases(status,review_due_at);

CREATE TABLE recovery_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES groups(id) ON DELETE NO ACTION,
  requester_id uuid NOT NULL REFERENCES users(id) ON DELETE NO ACTION,
  candidate_membership_id uuid NOT NULL REFERENCES memberships(id) ON DELETE NO ACTION,
  owner_snapshot uuid NOT NULL REFERENCES users(id) ON DELETE NO ACTION,
  group_version bigint NOT NULL,
  candidate_consent_at timestamptz,
  notified_at timestamptz,
  response_due_at timestamptz,
  reason text NOT NULL,
  evidence_refs jsonb NOT NULL DEFAULT '[]'::jsonb,
  state text NOT NULL DEFAULT 'received' CHECK (state IN ('received','verifying','notified','waiting','held','approved','rejected','applied')),
  decision_reason text,
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK((notified_at IS NULL AND response_due_at IS NULL) OR (notified_at IS NOT NULL AND response_due_at=notified_at+interval '168 hours'))
);

COMMENT ON COLUMN recovery_requests.id IS '내부 불변 식별자';

COMMENT ON COLUMN recovery_requests.group_id IS '참조 대상';

COMMENT ON COLUMN recovery_requests.requester_id IS '참조 대상';

COMMENT ON COLUMN recovery_requests.candidate_membership_id IS '참조 대상';

COMMENT ON COLUMN recovery_requests.owner_snapshot IS '참조 대상';

COMMENT ON COLUMN recovery_requests.group_version IS '신청 당시 버전';

COMMENT ON COLUMN recovery_requests.candidate_consent_at IS '후임 별도 동의';

COMMENT ON COLUMN recovery_requests.notified_at IS '실제 통지 성공';

COMMENT ON COLUMN recovery_requests.response_due_at IS '통지+168시간';

COMMENT ON COLUMN recovery_requests.reason IS '부재 사유';

COMMENT ON COLUMN recovery_requests.evidence_refs IS '최소 증거';

COMMENT ON COLUMN recovery_requests.state IS '복구 상태';

COMMENT ON COLUMN recovery_requests.decision_reason IS '수동 근거';

COMMENT ON COLUMN recovery_requests.version IS 'API가 expectedVersion 검증 후 +1';

COMMENT ON COLUMN recovery_requests.created_at IS '서버 생성 시각';

CREATE INDEX recovery_group_idx ON recovery_requests(group_id,state);

CREATE TABLE account_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE NO ACTION,
  case_id uuid REFERENCES reports_and_cases(id) ON DELETE NO ACTION,
  recovery_request_id uuid REFERENCES recovery_requests(id) ON DELETE NO ACTION,
  kind text NOT NULL,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz,
  CHECK(num_nonnulls(case_id,recovery_request_id)=1)
);

COMMENT ON COLUMN account_notifications.id IS '내부 불변 식별자';

COMMENT ON COLUMN account_notifications.user_id IS '참조 대상';

COMMENT ON COLUMN account_notifications.case_id IS '참조 대상';

COMMENT ON COLUMN account_notifications.recovery_request_id IS '참조 대상';

COMMENT ON COLUMN account_notifications.kind IS '복구통지·운영결과';

COMMENT ON COLUMN account_notifications.payload IS '최소 문구/대상 ID';

COMMENT ON COLUMN account_notifications.created_at IS '서버 생성 시각';

COMMENT ON COLUMN account_notifications.read_at IS '읽음시각';

CREATE INDEX account_notifications_user_idx ON account_notifications(user_id,created_at DESC);

CREATE TABLE outbox_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_id uuid REFERENCES operations(id) ON DELETE NO ACTION,
  event_type text NOT NULL,
  target_id uuid NOT NULL,
  generation bigint NOT NULL CHECK(generation>0),
  payload jsonb NOT NULL,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(event_type,target_id,generation)
);

COMMENT ON COLUMN outbox_events.id IS '내부 불변 식별자';

COMMENT ON COLUMN outbox_events.operation_id IS '참조 대상';

COMMENT ON COLUMN outbox_events.event_type IS '도메인 이벤트';

COMMENT ON COLUMN outbox_events.target_id IS '대상';

COMMENT ON COLUMN outbox_events.generation IS '처리 세대';

COMMENT ON COLUMN outbox_events.payload IS '민감 원문 제외';

COMMENT ON COLUMN outbox_events.published_at IS 'worker 인계확정';

COMMENT ON COLUMN outbox_events.created_at IS '서버 생성 시각';

CREATE INDEX outbox_pending_idx ON outbox_events(created_at) WHERE published_at IS NULL;

CREATE TABLE cleanup_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_type text NOT NULL,
  target_id uuid NOT NULL,
  state text NOT NULL DEFAULT 'queued' CHECK (state IN ('queued','running','failed','complete')),
  attempts integer NOT NULL DEFAULT 0 CHECK(attempts>=0),
  generation bigint NOT NULL CHECK(generation>0),
  due_at timestamptz NOT NULL,
  finished_at timestamptz,
  error_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(target_type,target_id,generation)
);

COMMENT ON COLUMN cleanup_jobs.id IS '내부 불변 식별자';

COMMENT ON COLUMN cleanup_jobs.target_type IS '정리대상 유형';

COMMENT ON COLUMN cleanup_jobs.target_id IS '대상 ID';

COMMENT ON COLUMN cleanup_jobs.state IS '작업 상태';

COMMENT ON COLUMN cleanup_jobs.attempts IS '시도 횟수';

COMMENT ON COLUMN cleanup_jobs.generation IS '오래된 이벤트 방어';

COMMENT ON COLUMN cleanup_jobs.due_at IS '논리차단+24h';

COMMENT ON COLUMN cleanup_jobs.finished_at IS '물리정리 완료';

COMMENT ON COLUMN cleanup_jobs.error_code IS '재시도 이유';

COMMENT ON COLUMN cleanup_jobs.created_at IS '서버 생성 시각';

CREATE INDEX cleanup_queue_idx ON cleanup_jobs(state,due_at);

CREATE TABLE operator_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_id text NOT NULL,
  case_id uuid REFERENCES reports_and_cases(id) ON DELETE NO ACTION,
  recovery_request_id uuid REFERENCES recovery_requests(id) ON DELETE NO ACTION,
  target_type text NOT NULL,
  target_id uuid NOT NULL,
  action text NOT NULL,
  reason text NOT NULL CHECK(btrim(reason)<>''),
  before_state jsonb NOT NULL,
  after_state jsonb NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  CHECK(num_nonnulls(case_id,recovery_request_id)=1)
);

COMMENT ON COLUMN operator_audit.id IS '내부 불변 식별자';

COMMENT ON COLUMN operator_audit.operator_id IS '별도 OIDC issuer/subject 식별';

COMMENT ON COLUMN operator_audit.case_id IS '참조 대상';

COMMENT ON COLUMN operator_audit.recovery_request_id IS '참조 대상';

COMMENT ON COLUMN operator_audit.target_type IS '대상 유형';

COMMENT ON COLUMN operator_audit.target_id IS '대상 ID';

COMMENT ON COLUMN operator_audit.action IS '조치';

COMMENT ON COLUMN operator_audit.reason IS '운영 근거';

COMMENT ON COLUMN operator_audit.before_state IS '최소 이전 상태';

COMMENT ON COLUMN operator_audit.after_state IS '최소 이후 상태';

COMMENT ON COLUMN operator_audit.occurred_at IS '서버 시각';

CREATE INDEX operator_audit_target_idx ON operator_audit(target_id,occurred_at);

CREATE INDEX operator_audit_actor_idx ON operator_audit(operator_id,occurred_at);

CREATE TABLE export_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE NO ACTION,
  purpose text NOT NULL CHECK(purpose = 'save'),
  state text NOT NULL DEFAULT 'preparing' CHECK (state IN ('preparing','ready','partial','failed')),
  targets jsonb NOT NULL,
  results jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);

COMMENT ON COLUMN export_jobs.id IS '내부 불변 식별자';

COMMENT ON COLUMN export_jobs.user_id IS '참조 대상';

COMMENT ON COLUMN export_jobs.purpose IS '휴대폰 저장만. share는 2026-10-20 회의로 폐지';

COMMENT ON COLUMN export_jobs.state IS '준비 상태';

COMMENT ON COLUMN export_jobs.targets IS '1~120개 ID';

COMMENT ON COLUMN export_jobs.results IS '파일별 결과';

COMMENT ON COLUMN export_jobs.created_at IS '서버 생성 시각';

COMMENT ON COLUMN export_jobs.expires_at IS '준비결과24h, 실제 GET은 재권한검사';

CREATE INDEX export_jobs_user_idx ON export_jobs(user_id,created_at DESC);

ALTER TABLE groups ADD CONSTRAINT groups_cover_asset_fk FOREIGN KEY(cover_asset_id) REFERENCES assets(id) ON DELETE NO ACTION DEFERRABLE INITIALLY DEFERRED;
-- All functions are INVOKER. No mobile client has direct DB privileges.
CREATE FUNCTION retention_last_day(end_date date) RETURNS date
LANGUAGE sql IMMUTABLE STRICT SET search_path=atp,pg_catalog
AS $$ SELECT (end_date + interval '3 months')::date $$;
CREATE FUNCTION retention_expires(end_date date) RETURNS timestamptz
LANGUAGE sql IMMUTABLE STRICT SET search_path=atp,pg_catalog
AS $$ SELECT ((retention_last_day(end_date)+1)::timestamp AT TIME ZONE 'Asia/Seoul') $$;

CREATE FUNCTION guard_schedule_retention() RETURNS trigger LANGUAGE plpgsql
SET search_path=atp,pg_catalog AS $$
DECLARE basis date;
BEGIN
 IF TG_OP='UPDATE' AND OLD.retention_fixed_at IS NOT NULL THEN
   IF ROW(NEW.retention_fixed_at,NEW.retention_last_date,NEW.expires_at)
      IS DISTINCT FROM ROW(OLD.retention_fixed_at,OLD.retention_last_date,OLD.expires_at) THEN
     RAISE EXCEPTION 'RETENTION_IMMUTABLE' USING ERRCODE='23514';
   END IF;
 END IF;
 IF TG_OP='UPDATE' AND OLD.status='active' AND NEW.status='cancelled' THEN
   NEW.cancelled_at:=statement_timestamp(); NEW.cancelled_end_date:=OLD.end_date;
 END IF;
 IF TG_OP='UPDATE' AND OLD.status IN ('cancelled','deleted') AND NEW.status='active' THEN
   RAISE EXCEPTION 'SCHEDULE_REOPEN_FORBIDDEN' USING ERRCODE='23514';
 END IF;
 IF NEW.retention_fixed_at IS NOT NULL AND (TG_OP='INSERT' OR OLD.retention_fixed_at IS NULL) THEN
   basis:=CASE WHEN NEW.status='cancelled' THEN NEW.cancelled_end_date ELSE NEW.end_date END;
   IF basis IS NULL OR NEW.retention_last_date<>retention_last_day(basis)
      OR NEW.expires_at<>retention_expires(basis) THEN
     RAISE EXCEPTION 'RETENTION_CALCULATION_INVALID' USING ERRCODE='23514';
   END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER schedule_retention_guard BEFORE INSERT OR UPDATE ON schedules
FOR EACH ROW EXECUTE FUNCTION guard_schedule_retention();

CREATE FUNCTION guard_membership_capacity() RETURNS trigger LANGUAGE plpgsql
SET search_path=atp,pg_catalog AS $$
DECLARE active_count int; group_state text; user_state text;
BEGIN
 IF NEW.ended_at IS NOT NULL THEN RETURN NEW; END IF;
 SELECT status INTO user_state FROM users WHERE id=NEW.user_id FOR UPDATE;
 SELECT status INTO group_state FROM groups WHERE id=NEW.group_id FOR UPDATE;
 IF TG_OP='UPDATE' AND OLD.ended_at IS NULL THEN RETURN NEW; END IF;
 IF user_state<>'active' OR group_state<>'active' THEN
   RAISE EXCEPTION 'MEMBERSHIP_NOT_ACTIVE' USING ERRCODE='23514';
 END IF;
 SELECT count(*) INTO active_count FROM memberships WHERE group_id=NEW.group_id AND ended_at IS NULL AND id<>NEW.id;
 IF active_count>=10 THEN RAISE EXCEPTION 'CAPACITY_FULL' USING ERRCODE='23514'; END IF;
 SELECT count(*) INTO active_count FROM memberships WHERE user_id=NEW.user_id AND ended_at IS NULL AND id<>NEW.id;
 IF active_count>=100 THEN RAISE EXCEPTION 'GROUP_LIMIT' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER membership_capacity_guard BEFORE INSERT OR UPDATE ON memberships
FOR EACH ROW EXECUTE FUNCTION guard_membership_capacity();

CREATE FUNCTION check_active_owner() RETURNS trigger LANGUAGE plpgsql
SET search_path=atp,pg_catalog AS $$
DECLARE gid uuid; g groups%ROWTYPE;
BEGIN
 IF TG_TABLE_NAME='groups' THEN gid:=COALESCE(NEW.id,OLD.id);
 ELSE gid:=COALESCE(NEW.group_id,OLD.group_id); END IF;
 SELECT * INTO g FROM groups WHERE id=gid;
 IF FOUND AND g.status='active' AND NOT EXISTS(
   SELECT 1 FROM memberships WHERE group_id=gid AND user_id=g.owner_user_id AND ended_at IS NULL
 ) THEN RAISE EXCEPTION 'ACTIVE_OWNER_REQUIRED' USING ERRCODE='23514'; END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER groups_owner_check AFTER INSERT OR UPDATE ON groups
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION check_active_owner();
CREATE CONSTRAINT TRIGGER memberships_owner_check AFTER INSERT OR UPDATE OR DELETE ON memberships
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION check_active_owner();

CREATE FUNCTION guard_group_state() RETURNS trigger LANGUAGE plpgsql
SET search_path=atp,pg_catalog AS $$
DECLARE owned int; candidate assets%ROWTYPE;
BEGIN
 IF TG_OP='INSERT' THEN
   PERFORM 1 FROM users WHERE id=NEW.owner_user_id FOR UPDATE;
   SELECT count(*) INTO owned FROM groups WHERE owner_user_id=NEW.owner_user_id AND status='active';
   IF owned>=20 THEN RAISE EXCEPTION 'OWNER_CREATE_LIMIT' USING ERRCODE='23514'; END IF;
 ELSIF OLD.status='closed' AND NEW.status<>'closed' THEN
   RAISE EXCEPTION 'GROUP_REOPEN_FORBIDDEN' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER group_state_guard BEFORE INSERT OR UPDATE ON groups
FOR EACH ROW EXECUTE FUNCTION guard_group_state();

CREATE FUNCTION check_group_cover() RETURNS trigger LANGUAGE plpgsql
SET search_path=atp,pg_catalog AS $$
DECLARE actual_owner uuid;
BEGIN
 IF NEW.cover_asset_id IS NOT NULL THEN
   SELECT cover_group_id INTO actual_owner FROM assets WHERE id=NEW.cover_asset_id;
   IF actual_owner IS DISTINCT FROM NEW.id THEN
     RAISE EXCEPTION 'COVER_GROUP_MISMATCH' USING ERRCODE='23514';
   END IF;
 END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER group_cover_guard AFTER INSERT OR UPDATE ON groups
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION check_group_cover();

CREATE FUNCTION guard_empty_delete() RETURNS trigger LANGUAGE plpgsql
SET search_path=atp,pg_catalog AS $$
DECLARE sid uuid; vid uuid; has_work boolean;
BEGIN
 IF TG_TABLE_NAME='schedules' THEN
   IF TG_OP='UPDATE' AND (NEW.status<>'deleted' OR OLD.status='deleted') THEN RETURN NEW; END IF;
   sid:=OLD.id;
   SELECT EXISTS(SELECT 1 FROM media WHERE schedule_id=sid AND (purged_at IS NULL OR access_state NOT IN ('deleted','expired')))
     OR EXISTS(SELECT 1 FROM upload_tasks WHERE schedule_id=sid AND state NOT IN ('complete','cancelled')) INTO has_work;
 ELSE
   IF TG_OP='UPDATE' AND (NEW.deleted_at IS NULL OR OLD.deleted_at IS NOT NULL) THEN RETURN NEW; END IF;
   vid:=OLD.id;
   SELECT EXISTS(SELECT 1 FROM media WHERE visit_id=vid AND (purged_at IS NULL OR access_state NOT IN ('deleted','expired')))
     OR EXISTS(SELECT 1 FROM upload_tasks WHERE visit_id=vid AND state NOT IN ('complete','cancelled')) INTO has_work;
 END IF;
 IF has_work THEN RAISE EXCEPTION 'NOT_EMPTY' USING ERRCODE='23514'; END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER empty_schedule_guard BEFORE UPDATE OR DELETE ON schedules
FOR EACH ROW EXECUTE FUNCTION guard_empty_delete();
CREATE TRIGGER empty_visit_guard BEFORE UPDATE OR DELETE ON visits
FOR EACH ROW EXECUTE FUNCTION guard_empty_delete();

CREATE FUNCTION guard_append_only() RETURNS trigger LANGUAGE plpgsql
AS $$ BEGIN RAISE EXCEPTION 'APPEND_ONLY' USING ERRCODE='23514'; END $$;
CREATE TRIGGER operator_audit_append_only BEFORE UPDATE OR DELETE ON operator_audit
FOR EACH ROW EXECUTE FUNCTION guard_append_only();


-- P12: 일정×방문일별 활성 방문 최대 15개. 일정 행 잠금으로 동시 추가를 직렬화한다.
CREATE FUNCTION guard_visit_limit() RETURNS trigger LANGUAGE plpgsql
SET search_path=atp,pg_catalog AS $$
DECLARE active_count int;
BEGIN
 IF NEW.deleted_at IS NOT NULL THEN RETURN NEW; END IF;
 IF TG_OP='UPDATE' AND OLD.deleted_at IS NULL AND OLD.schedule_id=NEW.schedule_id AND OLD.visit_date=NEW.visit_date THEN RETURN NEW; END IF;
 PERFORM 1 FROM schedules WHERE id=NEW.schedule_id FOR UPDATE;
 SELECT count(*) INTO active_count FROM visits
  WHERE schedule_id=NEW.schedule_id AND visit_date=NEW.visit_date AND deleted_at IS NULL AND id<>NEW.id;
 IF active_count>=15 THEN RAISE EXCEPTION 'VISIT_LIMIT' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER visit_limit_guard BEFORE INSERT OR UPDATE ON visits
FOR EACH ROW EXECUTE FUNCTION guard_visit_limit();

-- P11: 작성자×방문(미지정은 작성자×일정×기록일) 사진 5·영상 2.
-- 완료 media(available)와 진행 중 upload_tasks를 합산한다. advisory lock으로 같은 묶음의 동시 접수를 직렬화한다.
CREATE FUNCTION media_bucket_count(p_author uuid,p_schedule uuid,p_visit uuid,p_record date,p_kind text,p_exclude_task uuid,p_exclude_media uuid)
RETURNS int LANGUAGE sql STABLE SET search_path=atp,pg_catalog AS $$
 SELECT (SELECT count(*) FROM media m WHERE m.author_user_id=p_author AND m.kind=p_kind AND m.access_state='available'
          AND ((p_visit IS NOT NULL AND m.visit_id=p_visit) OR (p_visit IS NULL AND m.visit_id IS NULL AND m.schedule_id=p_schedule AND m.record_date=p_record))
          AND m.id IS DISTINCT FROM p_exclude_media AND m.task_id IS DISTINCT FROM p_exclude_task)
      + (SELECT count(*) FROM upload_tasks u WHERE u.author_user_id=p_author AND u.kind=p_kind AND u.cover_group_id IS NULL
          AND u.state NOT IN ('complete','failed','cancelled')
          AND ((p_visit IS NOT NULL AND u.visit_id=p_visit) OR (p_visit IS NULL AND u.visit_id IS NULL AND u.schedule_id=p_schedule AND u.record_date=p_record))
          AND u.id IS DISTINCT FROM p_exclude_task)
$$;
CREATE FUNCTION guard_media_limit() RETURNS trigger LANGUAGE plpgsql
SET search_path=atp,pg_catalog AS $$
DECLARE n int; lim int; bucket text; ex_task uuid; ex_media uuid;
BEGIN
 IF TG_TABLE_NAME='upload_tasks' THEN
   IF NEW.cover_group_id IS NOT NULL OR NEW.state IN ('complete','failed','cancelled') THEN RETURN NEW; END IF;
   IF TG_OP='UPDATE' AND OLD.state NOT IN ('complete','failed','cancelled') AND OLD.visit_id IS NOT DISTINCT FROM NEW.visit_id AND OLD.record_date=NEW.record_date THEN RETURN NEW; END IF;
   ex_task:=NEW.id; ex_media:=NULL;
 ELSE
   IF NEW.access_state<>'available' THEN RETURN NEW; END IF;
   IF TG_OP='UPDATE' AND OLD.access_state='available' AND OLD.visit_id IS NOT DISTINCT FROM NEW.visit_id AND OLD.record_date=NEW.record_date THEN RETURN NEW; END IF;
   ex_task:=NEW.task_id; ex_media:=NEW.id;
 END IF;
 bucket:=NEW.author_user_id::text||':'||COALESCE(NEW.visit_id::text,NEW.schedule_id::text||':'||NEW.record_date::text);
 PERFORM pg_advisory_xact_lock(hashtext('atp.media_limit'),hashtext(bucket));
 lim:=CASE WHEN NEW.kind='video' THEN 2 ELSE 5 END;
 n:=media_bucket_count(NEW.author_user_id,NEW.schedule_id,NEW.visit_id,NEW.record_date,NEW.kind,ex_task,ex_media);
 IF n>=lim THEN RAISE EXCEPTION 'MEDIA_LIMIT' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER upload_task_media_limit_guard BEFORE INSERT OR UPDATE ON upload_tasks
FOR EACH ROW EXECUTE FUNCTION guard_media_limit();
CREATE TRIGGER media_media_limit_guard BEFORE INSERT OR UPDATE ON media
FOR EACH ROW EXECUTE FUNCTION guard_media_limit();

-- F05: 초대 확인 횟수 50회 소진. use_count는 증가만 허용하고 50 도달 시 exhausted_at을 고정한다.
CREATE FUNCTION guard_invitation_uses() RETURNS trigger LANGUAGE plpgsql
SET search_path=atp,pg_catalog AS $$
BEGIN
 IF TG_OP='UPDATE' THEN
   IF NEW.use_count<OLD.use_count THEN RAISE EXCEPTION 'INVITE_USE_COUNT_DECREASE' USING ERRCODE='23514'; END IF;
   IF NEW.use_count>OLD.use_count AND (OLD.use_count>=OLD.max_uses OR OLD.revoked_at IS NOT NULL OR OLD.expires_at<=statement_timestamp()) THEN
     RAISE EXCEPTION 'INVITE_EXHAUSTED' USING ERRCODE='23514';
   END IF;
 END IF;
 IF NEW.use_count>=NEW.max_uses AND NEW.exhausted_at IS NULL THEN NEW.exhausted_at:=statement_timestamp(); END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER invitation_uses_guard BEFORE INSERT OR UPDATE ON invitations
FOR EACH ROW EXECUTE FUNCTION guard_invitation_uses();

-- API service still owns permission checks, recurrence, grapheme validation,
-- moderation, exact file probe, atomic accounting and final completion gates.
-- These DDL guards do not claim that the full F01-F28 implementation exists.

COMMIT;
