"""구현 착수 피드백을 반영한 v0.2 보완. 제품 기능 범위를 변경하지 않는다."""
from pathlib import Path
import json,hashlib,shutil

REVISION='0.3.2-design'
SECTIONS=[
('2026-10-30 UI 통합 — v0.3.2 / 명세 v2.2',[
'feature/ui-prototype@c19f34c의 최신 화면을 반영했다. 마이페이지 UI36·계정 UI37을 추가하고 설정 UI28·참여자 UI26·기록 선택을 기존 API 계약에 연결한다. UI/2026-10-30_UI_통합_설계.md를 적용 기준으로 사용한다.',
'날짜 카드는 전체 보기에서 필터로 진입한다. 모든 현재 참여자는 참여자 목록에서 초대 관리 UI23을 연다. 기록 선택은 120개, 누적 업로드는 작성자×방문별 사진5/영상2로 구분한다.',
'날짜 비연속 추가·30일, 업로드 최신순, 일정별 대표 사진, 프로필 사진은 기존 정책과 다르므로 회의 안건으로 보류했다. 캡처는 데모이며 제품 권한·정렬·보관·API를 대체하지 않는다.',
'출시 전 별도 결정: 약관 13번 개정안과 종전 F02/F20/F24의 동의·GPS 원본·계정 삭제 규칙 차이가 남아 있다. UI 갱신이나 문서 검증 통과는 출시 적합성 확인이 아니다.']),
('0 이전 v0.3.1 변경 요약 — 초대 권한 확대와 기존 회의 반영',[
'2026-10-24 추가 결정: F05 초대 조회·발급·공유·복사·개별 취소를 방장을 포함한 모든 현재 참여자에게 허용한다. 같은 모임의 다른 참여자가 발급한 초대도 조회·공유·취소할 수 있다. 발급자 ID는 감사 이력이며 권한 근거가 아니다. UI05·UI23·권한표·invitesList/inviteCreate/inviteRevoke(member)·F05 검수와 CT16을 함께 변경했다.',
'탈퇴·퇴장·모임 종료·서비스 이용 제한 시 요청 및 멱등 재시도에서도 현재 권한을 재검증한다. 발급자의 참여 종료만으로 이미 발급한 초대를 자동 취소하지 않으며 다른 현재 참여자가 개별 취소할 수 있다. 7일·50회·정원10명 규칙은 유지한다. 이 개정은 명세·설계 변경이며 기존 앱·서버의 방장 전용 구현을 수정하거나 권한 검수를 통과한 결과가 아니다.',
'당시 기준 기능명세서는 v2.1(2026-10-24)이었다. v1(2026-10-17) 대비 기존 회의 결정은 명세 0절의 10건 표에 남겼다. 이번 v2.2 UI 보완은 이 문서의 2026-10-30 절을 따른다.',
'① 초대 7일+확인 50회: invitations.use_count/max_uses/exhausted_at 컬럼, invitation_uses_guard 트리거, invitePreview 성공 응답마다 +1, INVITE_EXHAUSTED 오류, Invitation.useCount/state 계약, UI23·UI24 표시. 참여 확정은 횟수를 소모하지 않는다.',
'② 반복 폐지·기간 일정 수동 추가 / ④ 수동 추가·제거: recurrence_series·recurrence_exceptions 테이블과 schedules.series_id/original_occurrence_key 제거. recurrencePreview·schedulePreview·scheduleApply를 제거하고 scheduleUpdate(PATCH, 기간 밖 영향 확인)·scheduleCancel·scheduleDelete(범위 없음)로 대체. UI07 맞춤 반복 화면 폐지, UI06을 일정 추가와 변경으로 재정의.',
'③ 종일 제거·시각은 장소에: schedules.all_day/start_at/end_at 제거, ScheduleInput은 title·startDate·endDate·timezone만. visitCreate에 plannedTime 입력 추가, 일정 상세 plan에 방문별 예정 시각·visitLimit 표시(UI08·UI10·UI11).',
'⑤ UI16+UI19 통합: UI16 파일 선택과 업로드 확인이 업로드 후보 선택과 기존 기록 다중 선택(저장·본인 수정·본인 삭제)을 함께 담당한다. UI19 번호는 폐지하고 화면 전환표를 갱신했다. 화면 수는 35→33.',
'⑥ 사람별 묶음/시간순: mediaList에 view(by_time|by_author)·order 매개변수, Media.sortAt/sortBasis, by_author 구역 머리글 groups[]. 제출 묶음 완료순 정렬 규칙은 제거했다. UI09·UI13에 보기 전환.',
'⑦ 길게 눌러 여러 장 저장 / ⑧ 외부 공유 제거: UI09·UI13·UI16 선택 모드 → UI21 휴대폰 저장. exportCreate purpose는 save만, export_jobs.purpose CHECK, UI21의 OS 공유 제거, 권한 판정표·업무 흐름 9절에서 공유 삭제.',
'⑨ 사진 5·영상 2 / ⑩ 일차별 장소 15개: upload_tasks.kind 컬럼 추가, media_bucket_count 함수와 guard_media_limit 트리거(작성자×방문, 미지정은 작성자×일정×기록일, advisory lock), guard_visit_limit 트리거(일정 행 잠금). uploadPrepare fileErrors MEDIA_LIMIT·remaining[], visitCreate VISIT_LIMIT, metadataPatch 한도 재검증. UI08·UI10·UI11·UI13·UI16에 남은 개수 표시.',
'검증: 003_contract_checks.sql에 6번째 사진·3번째 영상·16번째 방문·51번째 초대 확인·share 내보내기 거부와 실패 작업 자리 반환·삭제 방문 자리 복귀 회귀를 추가했다. 계약 통합 시나리오 CT13~CT15와 기능 검수 시나리오(F05·F06~F11·F13·F14·F16·F17·F19)를 갱신했다. 설계 검토 엑셀 1~3번(종료 후 맥락·만료 직전 업로드·차단과 관리 알림)은 미확정으로 두어 설계를 바꾸지 않았다.']),
('1 패키지 기준과 변경 통제',[
'이 패키지의 정책 기준은 기준/기능명세서.md(v2.2, 2026-10-30)다. 프로젝트의 기능 명세서/기능명세서.md 원본과 바이트가 같은 사본이며 SHA256·크기·정책 적용 범위를 기준/기준선.json에 기록한다. 상위 원본이 바뀌면 자동으로 새 정책을 적용하지 않고 차이를 검토해 기준선을 다시 확정한다. v0.3은 2026-10-20 회의 결정에 따라 F05·F07~F11·F13·F14·F16·F17·F19·F20·F21·F23·F28과 P11·P12를 바꾼 명세 v2를 기준으로 삼는다.',
'문서 사이의 우선순위는 기준 기능명세 → OpenAPI 및 DB 물리 정의 → 업무 절차·화면 연결 → 예제다. 문서와 스키마가 다르면 구현자가 임의 선택하지 않고 계약 오류로 기록한다. 이번 변경의 operationId·컬럼명·HTTP 동작은 OpenAPI와 physical_model.py가 각각 원천이다. 실행 SQL은 빈 DB에 적용하는 초기 스키마이며 완성된 서버 구현을 뜻하지 않는다.']),
('2 구현 도구와 코드 배치 결정',[
'서버는 Node.js 24 계열·TypeScript·Fastify 5·node-postgres(pg) 8, PostgreSQL 16을 선택한다. ORM은 사용하지 않고 매개변수화 SQL과 명시적 트랜잭션을 사용한다. 모든 트랜잭션은 pool에서 얻은 동일 client로 BEGIN/COMMIT/ROLLBACK을 실행한다. 프레임워크와 드라이버의 패치 버전은 최초 서버 설치에서 lockfile로 고정하고 빌드·테스트 결과를 기록한다.',
'마이그레이션은 부록/DB/001_initial.sql 같은 번호별 SQL을 psql의 ON_ERROR_STOP으로 적용한다. 운영 배포 runner는 전용 migrator 계정, advisory lock, 버전·파일 SHA256 이력 테이블, 커밋 후 기록을 사용한다. 이미 적용한 파일의 hash가 다르면 중단한다. 초기 스키마를 운영 DB에 재실행하거나 DROP SCHEMA로 복구하지 않는다. 롤백은 이전 앱과 호환되는 전진 보완 migration으로 처리한다.',
'구현 폴더는 mobile/(신규 앱 셸과 선별 이식), server/api/, server/worker/, server/db/migrations/, server/adapters/, ops-web/로 나눈다. 공유 계약 타입은 contracts/에 두고 OpenAPI에서 생성한다. 이번 산출물은 이 구조의 설계이며 해당 앱·서버를 생성한 결과가 아니다.',
'미디어 작업자는 ffprobe로 형식·길이·회전·스트림을 확인하고 FFmpeg로 동영상 호환본을 만든다. 사진 디코딩·호환 JPEG/PNG 생성에는 ImageMagick을 사용한다. 위치 태그 읽기·재검증에는 ExifTool을 사용한다. 원래 해상도 저장본은 지원 형식별 메타데이터 처리 경로를 사용하고 일괄 재인코딩으로 대체하지 않는다. 새 도구의 정확한 버전·이미지 digest·HEIF/HDR/코덱 지원은 혼합 파일 기술 검증에서 고정한다. 메타데이터 삭제 명령 하나만으로 F20 완료라고 판정하지 않는다.']),
('3 DayLog 선별 재사용과 SDK 기준',[
'기존 DayLog 앱은 선택적 참고 자료였으며, 2026-10-24 문서 저장소 정리에서 원본 앱과 사용하지 않는 루트 캐시 폴더를 제거했다. 기준/재사용후보.json의 원래 경로·hash는 과거 관찰 이력이다. 설계서 열람·재생성에는 원본 앱이 필요하지 않으며, 신규 앱 구현 완료를 뜻하지 않는다.',
'재사용 후보는 CameraScreen/CameraXScreen과 카메라 상태 머신, media ingest/probe, 파일 선택·재생·공유 보조 코드다. 각 후보는 출처 경로·SHA256·새 요구와의 차이를 기준/재사용후보.json에 기록한다. API31 권한, 1~5초·무음·조기 종료, Photo Picker, 계정별 임시 파일, 백그라운드 복구를 새 앱에서 검증한 뒤 채택한다.',
'기존 로컬 SQLite 업무 모델, 개인 로그·편집 스택·영상 프로젝트·자동 알림·DayLog 라우팅과 브랜딩은 이식하지 않는다. DayLog 패키지명·scheme·개발 서버 주소·광범위 미디어 권한 설정도 그대로 사용하지 않는다. 새 앱은 별도 applicationId·인증 리디렉트·minSdk31 설정과 선택 권한 정책을 갖는다.',
'실제 원본의 선언 조합은 Expo ~57.0.27 / React Native 0.86.3 / React 19.2.3이다. 선행 XLSX의 Expo54/RN0.81은 과거 자료다. 선언값과 lockfile hash를 기준선에 보관하며 버전 문서의 대응 조합은 확인했다. 실제 설치·expo-doctor·typecheck·lint·Android 개발 빌드·기기 검수 통과를 주장하지 않는다. 새 앱 lockfile을 고정하는 단계가 SDK 수락 조건이다.']),
('4 ATP Upload 1 전송 계약',[
'파일 접수 응답의 UploadTask.transport는 전송할 수 있을 때만 UploadTransport 객체이고 그 외에는 null이다. 객체에는 protocol=ATP-Upload/1, uploadEndpoint, generation, resumeOffset, length, expiresAt, alignmentBytes=1,048,576, maxChunkBytes=4,194,304가 모두 포함된다. 원본 SHA256을 checksum/fingerprint로 사용하고 재시도에서도 같은 원본을 증명한다. 이 프로토콜은 앱 자체 계약이며 tus 표준 구현이라고 표시하지 않는다.',
'전송 URL은 /v1/upload-tasks/{taskId}/content다. HEAD는 Authorization과 Upload-Generation을 받아 204 및 Upload-Offset·Upload-Length·Upload-Generation·Upload-Expires·Cache-Control:no-store를 돌려준다. 오류 HEAD도 본문이 없으며 X-Error-Code·X-Request-Id로 사유를 전달한다. JSON 작업 조회는 GET /upload-tasks/{taskId}를 사용한다. verifying/review/complete는 전송 재개 대상이 아니며 content 요청은409 TASK_NOT_TRANSFERABLE, cancelled는410 CANCELLED로 응답한다.',
'PATCH는 Content-Type:application/offset+octet-stream, Content-Length, Upload-Offset, Upload-Generation, Upload-Checksum:sha256 <소문자64자리hex>와 바이너리 본문을 보낸다. 청크는 양수·최대4MiB이며 마지막 청크를 제외하면1MiB의 배수다. 현재 확정 offset에서만 이어 쓴다. 합계는 접수 length를 넘을 수 없다. 성공은204와 갱신된 오프셋이다. 이 경로는 업무 Idempotency-Key 대신 세대·오프셋·청크 해시로 중복을 판정한다.',
'청크 저장 중에는 DB 잠금을 유지하지 않는다. 서버는 저장 전 입력을 검사하고, 객체 저장 후 task를 잠가 세대·현재 권한·기한·취소·현재 offset을 다시 검증한다. 청크를 private 저장소에 불변 객체로 내구성 있게 기록한 뒤 chunk_manifest와 upload_offset을 같은 DB 커밋으로 전진시킨다. 객체 기록 성공 뒤 DB 커밋 전 장애면 offset은 이전 값이며 남은 객체는 재사용하거나 고아 정리한다. 저장되지 않은 바이트를 offset에 먼저 반영하지 않는다. 업로드 예약은 원본 전체 크기 기준이며 청크 재전송으로 중복 예약하지 않는다.',
'마지막 성공 PATCH의 응답이 유실되어 동일 세대·시작 offset·크기·해시가 다시 오면 같은204를 돌려주고 쓰기·집계를 반복하지 않는다. 다른 과거 offset, 중첩·건너뛴 offset, 같은 위치의 다른 해시는409다. 클라이언트는 HEAD의 확정 offset으로 복구한다. 동시에 두 기기에서 같은 세대에 전송하면 직렬화된 현재 offset만 수락한다.',
'필수 헤더 누락428, 청크/전체 해시 불일치400, 크기 초과413, offset/세대 충돌409, transport 만료410을 사용한다. 모든 요청에서 현재 작성자·참여 또는 대표사진 방장·모임 상태·보관·이용 제한을 다시 검사한다. 일정 취소 전 서버가 접수한 같은 기록 작업은 예외를 적용하지만 퇴장·계정 삭제·모임 종료·만료·사용자 취소가 우선한다.',
'transport 만료는 발급 후24시간이다. 410은 업로드 작업 자체의 최종 취소를 의미하지 않는다. uploadRetry로 같은 fingerprint와 현재 권한을 검증하고 generation을 증가시켜 transport를 재발급한다. 청크가 보존 중이면 offset을 유지하고 정리됐다면0을 반환한다. accepted_at은 바뀌지 않으며 파일 교체·추가 접수는 허용하지 않는다. 재시도 멱등키를 바꾸지 않으면 같은 세대를 반환한다. 실패 예약을 반환한 작업은 재시도에서 다시 예약한다.',
'offset=length 뒤 POST commit(checksum,actualBytes)을 호출한다. 전체 파일 합치기·실제 해시·probe·위치 제거·제거 검증·호환본·콘텐츠 검사는 별도 worker에서 수행한다. 신규 접수202는 Operation이며 전송100%를 공동 공개 완료로 표시하지 않는다. 전송 취소가 먼저 확정되면 이후 PATCH/commit을 거부한다. 완료가 먼저면 전송 취소 대신 본인 기록 삭제로 안내한다.']),
('5 업무 결과와 예제 계약',[
'비동기 결과는 operationId·kind·state·result·itemErrors를 항상 갖는 Operation으로 통일한다. 기존 Operation.id 표기는 제거했다. pending/review/failed의 result는 null이고 succeeded의 result는 kind에 대응하는 타입이다. 실패에는 최소 한 개의 itemErrors, 성공에는 빈 itemErrors를 사용한다. metadata_change 성공은 appliedIds와 대상별 새 versions를 제공한다.',
'일괄 수정은 설명 검사 후 전 대상 재검증·단일 커밋이다. 하나라도 오류면 전체 미적용이다. 일괄 삭제는 사전 권한 검증 실패 시 전체 거부하지만 유효 요청 실행은 파일별 deleted/already_deleted/failed 결과다. 두 결과 타입을 혼용하지 않는다. 새 commit·metadata-change의202와 동일 멱등 요청의 확정200을 구분한다.',
'부록/계약예제/examples.json에는 작업 대기·성공·실패, 파일 transport, 파일별 삭제 결과의 정상 예제와 의도적으로 잘못된 예제를 넣는다. 검증기는 각 예제를 실제 OpenAPI 컴포넌트에 적용해 기대한 성공/실패 여부를 검사한다. 이는 서버 실행 검수가 아닌 계약 예제 검증이다.']),
('6 물리 스키마 적용과 책임 분리',[
'부록/DB/001_initial.sql은27개 업무 테이블의 컬럼별 타입·NULL·기본값·FK·CHECK·유일성·인덱스·트리거를 정의한다. UUID·timestamptz·날짜·버전을 개별 컬럼으로 풀었다. 업로드 청크 매니페스트·확정 offset·transport 세대와 만료, v0.3의 초대 횟수·방문 15개·사진5/영상2 트리거를 포함한다. 반복 테이블은 없다. 운영자 ID는 앱 users FK가 아니라 별도 OIDC issuer/subject 식별 문자열이다.',
'DB가 직접 보장하는 것은 활성 참여 중복·정원/활성모임수·활성 방장 존재·원본 용량 상한·첫 보관 기한 계산/불변·기록과 방문 날짜 FK·파일별 완료 유일성·위치 미검증 파생본 ready 차단·일정×방문일 15개·작성자×방문 사진5/영상2·초대 확인 50회·감사 이력 append-only 등이다. Unicode grapheme, 현재 권한·차단, 공개 전 검사, 계정 삭제 선행 조건, 남은 개수 응답, 실제 파일 정리·집계는 서비스 트랜잭션과 worker 검증 책임이다. DDL 적용 성공만으로 이 기능의 완료를 주장하지 않는다.',
'기본 FK는 ON DELETE NO ACTION이다. 계정과 모임을 하드 삭제해 타인 기록을 연쇄 삭제하지 않는다. 방문 삭제 후 position은NULL로 비워 활성 순서의 지연 유일 제약과 충돌하지 않게 한다. 기간 축소로 기존 방문·기록이 범위 밖이 되는 것은 허용하고 신규 지정만 서비스에서 검사한다.',
'스키마는 PUBLIC 접근을 제거한 atp에 만든다. mobile 클라이언트 DB 접속은 없다. API/worker/운영은 서버 전용 최소권한 계정과 별도 pool을 사용한다. 역할·권한 템플릿은 부록/DB/002_service_roles.sql에 제공한다. 실제 접속 비밀번호·클라우드 서비스 역할은 배포에서 설정하며 migrator 계정을 런타임에 사용하지 않는다.']),
('7 운영자 별도 인증과 삭제 경로',[
'운영 웹은 별도 OIDC client·issuer/audience와 MFA를 사용한다. 운영 API는 앱 사용자 JWT를 거부하고 operator_subject·허용 역할·대상 버전을 검사한다. 역할은 case_reviewer, content_moderator, recovery_approver로 나눈다. 복구 이전은 recovery_approver만 실행하며 사유·확인 자료·통지·7일 대기·후임 동의와 최신 모임 버전을 검증한다. 공급자 주소·등록 계정은 출시 설정값이다.',
'로그아웃·이용 제한이 본인 기록 삭제·계정 삭제·동의 철회·이의 문의를 막지 않도록 제한 계정용 허용 경로를 둔다. 계정 삭제 전 방장 역할 정리가 필요한 경우 전용 화면에서 본인 방장 모임의 최소 정보와 후임 후보만 조회하고 방장 이전/마지막1인 종료만 허용한다. GET /me/deletion-preconditions는 본인 방장 모임명·버전·활성 수·후임 후보만 반환한다. ownerTransfer/groupClose의 purpose=account_deletion에는 최근 reauthProof를 요구한다. 서버는 제한 계정에 이 정리 목적만 허용하고 일반 공동 조회·새 업로드를 다시 열지 않는다.']),
('8 실제 로컬 구현과 외부 테스트 대역',[
'DB 트랜잭션·private 파일 저장·원본 전송·probe·위치 제거·변환·정리·기한 계산은 로컬에서도 실제 구현 대상이다. ObjectStore 어댑터의 로컬 구현은 private 디렉터리에 임시 쓰기→fsync→atomic rename을 사용하고 외부에는 인증 API만 제공한다. 운영 object storage도 같은 청크 key·원자 커밋 계약을 만족해야 한다.',
'카카오/Google·실제 지도·콘텐츠 판정 공급자에는 인터페이스와 명시적인 개발용 테스트 대역을 둘 수 있다. 개발용 판정 결과는 테스트로 표시하고 production에서는 대역 선택 시 시작을 거부한다. 콘텐츠 엔진 미설정/장애/판정 불가 상태는 review이며 자동 passed로 치환하지 않는다. 외부 키가 준비되면 실패·타임아웃·재인증을 포함한 실연동 검수를 수행한다.',
'약관·동의 항목·연락처는 문서/운영 설정값이며, 실기기 성능은 측정 과제다. 이들을 API 스텁과 같은 종류로 묶지 않는다. 사용자에게 실제 문서가 없는 동의를 완료했다고 표시하거나 빈 문의 연락처로 출시 완료 처리하지 않는다.']),
('9 개발 순서와 완료 문턱',[
'1단계 계약/기술 검증: 기준선·스키마·API 예제·업로드 프로토콜을 고정하고 API31 개발 빌드,120개 혼합 후보, 전송 복구, 위치 포함 HEIF/MOV·HDR 호환본을 먼저 검증한다. 실패하면 도구/어댑터 결정을 바꾸고 기록한다.',
'2단계 계정·모임·초대(F01~F05, 50회 소진 포함)와 최소 파일 처리 뼈대를 함께 만든다. 3단계 일정 수동 추가·장소·예정 시각·계획(F06~F11, 15개 한도)을 구현한다. 4단계 촬영/가져오기/전송/감상(F12~F16)에 F20 위치 제거와 F26 공개 전 검사를 동시에 연결한다. 위치 검증·검사가 통과하기 전에는 완료/공동 공개를 만들지 않는다.',
'5단계 공통 선택 화면·본인 일괄 수정·삭제·휴대폰 저장(F17~F19),6단계 보관·역할·종료·계정·신고·복구·운영(F21~F28)을 마무리한다. 운영 웹의 나머지 기능은 뒤에 완성할 수 있어도 비공개 review 저장과 실제 공개 차단은4단계부터 필요하다.',
'각 단계는 코드 존재, 로컬 자동화 통과, staging 실제 연동, Android 실기기 검수, 출시 준비의 상태를 따로 기록한다. 기능 검수 시나리오를 같은 수의 단위 테스트로 기계적으로 치환하지 않는다. 테스트 방식별 실행 계획과 신규 계약 검증 시나리오를06 추적표에 추가했다.']),
('10 이번 실행 결과와 남은 검증',[
'부록/DB/검증결과.json은 임시 PostgreSQL에서 초기 DDL과 제약을 검사한 결과다. 부록/계약예제/검증결과.json은 OpenAPI 정상/오류 예제 검증 결과다. 부록/산출물 검증.json은 문서·파일·연결 검증 결과다. 각각의 범위를 구분하며 F01~F28의 실제 구현 검수 결과는 미실행으로 유지한다.',
'실제 인증 등록·지도키·운영 저장지역/접속권한·콘텐츠 판정 공급자·운영 인력·약관/동의 문서·문의 연락처·실기기 성능 검수는 여전히 출시 준비 항목이다. 이번 작업은 제품 구현을 시작한 것이 아니라 구현 가능한 수준으로 설계 계약을 보완한 것이다.'])]

EXTERNAL=[
 ['인증·지도','실제 자격 증명 필요','개발 어댑터/명시적 테스트 대역','실제 로그인·인증 취소·만료·실지도 실패 검수'],
 ['DB·private 저장소','실제 로컬 구현 가능','PostgreSQL·비공개 디렉터리 또는 실제 object storage','경쟁·정리·재개·접근차단 검수'],
 ['미디어 처리','실제 로컬 구현 가능','probe·메타데이터 처리·호환본·정리 worker','실제 혼합 파일·GPS·HDR·음성/회전 보존'],
 ['콘텐츠 판정','실제 엔진 필요','판정 대역은 개발 전용·장애 시 review','production 대역 금지·운영 검토 연결'],
 ['약관·동의·문의','운영 문서/연락처 필요','버전별 문서·실제 공개 채널','열람·동의·철회·실제 문의 확인'],
 ['실기기·성능','측정 필요','자동화+실기기 검수','버전·OS·기기·파일·네트워크 실측 증거']]

def prepare_baseline(root):
    root=Path(root);basis=root/'기준';basis.mkdir(exist_ok=True)
    source=root.parent/'기능 명세서'/'기능명세서.md';snapshot=basis/'기능명세서.md'
    # 원본이 없는 단독 패키지에서도 기존 사본으로 재생성할 수 있다.
    if not snapshot.exists():shutil.copy2(source,snapshot)
    digest=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
    if source.exists() and digest(source)!=digest(snapshot):raise RuntimeError('기준 명세와 상위 원본이 다릅니다. 정책 변경 검토 후 기준선을 명시적으로 갱신하세요.')
    # The original reference application is not a package dependency. Preserve observation metadata.
    reuse=basis/'재사용후보.json'
    if reuse.exists():
        record=json.loads(reuse.read_text())
        record.update({'source_available':False,'source_required':False,'source_note':'원본 참고 앱은 2026-10-24 docs 브랜치 정리로 제거했다. 경로·hash·선언 버전은 과거 관찰 이력이며 현재 파일의 존재나 재사용 완료를 뜻하지 않는다.'})
        reuse.write_text(json.dumps(record,ensure_ascii=False,indent=2))
    (basis/'기준선.json').write_text(json.dumps({'design_version':REVISION,'policy_snapshot':'기능명세서.md','sha256':digest(snapshot),'bytes':snapshot.stat().st_size,'policy_version':'2.2','policy_date':'2026-10-30','scope':'F01~F28/P01~P12/6절 한도/7절 제외','upper_source':'../기능 명세서/기능명세서.md (정책 원본, 독립 패키지에서는 내부 기준 사본 사용)','change_rule':'동일 SHA256 사본으로 전달; 원본 변경 시 정책 차이 검토 후 명시 갱신'},ensure_ascii=False,indent=2))

def apply_content(arch,decisions,sources,workflows):
    arch[0][1][0]='At that place 1차 기준은 패키지 내부 기준/기능명세서.md(v2.2, 2026-10-30)의 F01~F28·P01~P12이며 Android12(API31)+, Asia/Seoul 고정이다. 상위 원본과 동일한 SHA256 사본을 포함한다. v0.3은 2026-10-20 회의 피드백 10건(초대 50회·반복 폐지·일정 시각 제거·수동 일정·UI16/19 통합·보기 방식·길게 눌러 저장·외부 공유 제거·사진5/영상2·장소15)을 반영한 명세 v2를 따른다.'
    arch[0][1][1]='실행 DB 정의·업로드 프로토콜·업무 결과 형식·선별 재사용 범위(v0.2)에 더해 v0.3에서 일정 모델 단순화·한도 트리거·초대 횟수·보기 방식·공통 선택 화면을 반영했다. 09 구현 계약 보완 0절과 부록/DB/001_initial.sql·부록/openapi.json을 함께 적용한다. 실제 공급자 등록·문서·연락처·실기기 측정은 출시 준비다.'
    arch[0][1].append('v0.3.2 추가 변경: 초대 관리는 방장 전용 기능에서 모든 현재 참여자의 기능으로 이동했다. API는 member 권한, UI23은 모든 현재 참여자 진입이며 발급자 본인 여부로 취소를 제한하지 않는다. 조회·발급·취소마다 현재 참여와 모임/이용 상태를 재검증한다.')
    arch[2][1][0]='Android 앱은 React Native·Expo 신규 앱 셸에 DayLog의 촬영·파일 처리 후보를 선별 이식한다. 기존 로컬 업무 DB·편집·알림·라우팅은 재사용하지 않는다. 기존 코드가 없어도 기준 명세와 UI/API 계약으로 구현할 수 있다. Expo57/RN0.86.3/React19.2.3 선언 조합과 채택 조건은09 문서·기준/재사용후보.json을 따른다.'
    arch[2][1].append('서버 도구는 Node24·TypeScript·Fastify5·pg8, PostgreSQL16, 번호별 SQL 마이그레이션으로 선택했다. ORM은 사용하지 않는다. 작업자 도구·운영자 OIDC/MFA·실제 로컬 구현과 테스트 대역 구분은09 문서에서 정의한다.')
    arch[3][1][-1]='파일 GET은 인증 프록시에서 현재 권한·기한을 검사한다. 파일 업로드도 인증 HEAD/PATCH로 격리 청크를 기록하고 DB의 확정 offset으로 재개한다. 공개 버킷·직접 원본 GET을 허용하지 않는다. 전송 프로토콜은09 문서와 OpenAPI uploadHead/uploadChunk를 적용한다.'
    workflows[2][1].append('바이너리 전송은 ATP-Upload/1의 HEAD/PATCH, 세대·offset·SHA256·24시간 transport 만료 계약을 사용한다. offset 전진은 private 청크 내구성 저장 후 DB 커밋으로 확정한다. 상세 복구 규칙은09 문서를 적용한다.')
    workflows.append(('15 구현 단계의 공개 완료 문턱·한도 판정',['F20 위치 제거 및 제거 검증과 F26 공개 전 검사는 F15 완료의 필수 선행 조건이다. 운영 웹을 후속 단계에 구현하더라도 비공개 review와 공개 차단은 업로드 단계부터 동작해야 한다. 전송100%·스텁 passed를 업로드 완료로 판정하지 않는다.','방문 15개·사진 5/영상 2·초대 50회 한도는 접수·추가·확인 트랜잭션 안에서 DB 트리거가 최종 판정하고 서비스는 남은 개수를 응답에 실어 화면이 표시한다. 앱의 로컬 계산을 한도 판정으로 쓰지 않는다.']))
    replacements={'ADR01':('클라이언트','신규 Expo 셸 + DayLog 선별 이식','촬영/파일 후보만 조건부 채택; 기존 업무DB·편집·알림·브랜딩 제외','선택 확정·채택 검증 필요'),
                  'ADR02':('서버/DB','Node24·Fastify5·TypeScript·pg8·PostgreSQL16·SQL migration','ORM 미사용·같은 client 명시적 트랜잭션·마이그레이션 hash 이력','선택 확정·서버 구현 전'),
                  'ADR05':('미디어 처리','ffprobe/FFmpeg·ImageMagick·ExifTool + 공개 전 검사','지원 형식별 실제 위치 제거 검증, 장애 시 review; 정확한 이미지 digest는 기술 검증 후 잠금','도구 선택 확정·혼합파일 검증 필요'),
                  'ADR11':('SDK','기존 선언 Expo57/RN0.86.3/React19.2.3·새 앱 lockfile','선행 XLSX54/0.81과 구분. 설치/doctor/빌드/API31 확인 후 채택','기준 조합 확인·실제 빌드 검증 전')}
    for i,row in enumerate(decisions):
        if row[0] in replacements:
            area,choice,why,status=replacements[row[0]];decisions[i]=(row[0],area,choice,why,status,row[-1])
    decisions.extend([('ADR13','전송','ATP-Upload/1: 인증 HEAD/PATCH·offset·generation·SHA256','불변 청크 저장 후 DB offset 커밋; 응답유실/중복/만료 정의','선택 확정·서버 구현 전','서버/앱 담당'),('ADR14','운영 인증','별도 OIDC client/issuer/audience + MFA·역할 분리','일반 앱 JWT 거부, reviewer/moderator/recovery approver','방식 확정·실계정 설정 필요','운영/백엔드 담당')])
    sources[0]=('S1','기준/기능명세서.md','원본과 동일한 SHA256 사본·F01~F28·P01~P10','패키지 내부 구현 최우선 기준')
    sources.extend([
      ('T5','https://fastify.dev/docs/latest/Reference/LTS/','Fastify 지원 정책','도구 선택 근거·2026-10-17 확인'),
      ('T6','https://node-postgres.com/features/transactions','동일 client의 명시적 트랜잭션','pg 선택·2026-10-17 확인'),
      ('T7','https://docs.expo.dev/versions/v57.0.0/','SDK57/RN0.86/React19.2.3 대응','선언 조합 확인, 실제 빌드 결과 아님'),
      ('T8','https://www.postgresql.org/docs/16/ddl-constraints.html','물리 제약과 FK 정의','초기 스키마 근거·2026-10-17 확인'),
      ('T9','https://ffmpeg.org/ffmpeg.html','미디어 변환·metadata 제어','작업자 도구 선택·실파일 위치 검증 별도')])
    sources.append(('T10','https://raw.githubusercontent.com/exiftool/exiftool/master/html/exiftool_pod.html','메타데이터 읽기·쓰기·지원 형식','위치 제거 재검증 도구 선택, 실제 형식별 검증 필요'))

CONTRACT_CASES=[
 ('CT01','정상 청크·마지막 청크','1MiB/4MiB·나머지 바이트 전송','204·정확한 offset·최종 length','API통합+실파일'),
 ('CT02','응답 유실 뒤 동일 PATCH','같은 세대·offset·길이·hash 재전송','중복 기록/예약 없이 같은 확정 offset','API통합+장애주입'),
 ('CT03','다른 offset/동시 두 기기','앞선/중첩/건너뛴 offset·서로 다른 청크','직렬화·409·HEAD로 현재 offset 확인','API통합+DB경쟁'),
 ('CT04','청크 저장과 DB 커밋 사이 장애','객체저장 뒤 커밋 실패','offset 미전진·고아 정리·재전송 복구','스토리지 장애주입'),
 ('CT05','transport 만료와 재발급','24시간 경계·같은 fingerprint·재시도 응답 유실','410→동일 task 새 세대·같은 키는 같은 세대','고정시계+API통합'),
 ('CT06','세대/파일 변경 우회','오래된 generation·다른 SHA256','409 또는 FILE_CHANGED·accepted_at 불변','API통합'),
 ('CT07','HEAD/청크 권한 변경','전송 중 퇴장·계정삭제·모임종료·만료','현재 상태 재검증·보존된 URL로 우회 불가','API권한+DB경쟁'),
 ('CT08','commit 공개 문턱','offset=length·GPS검증실패·검사엔진장애','202/verifying/review·공개/완료 집계 없음','실파일+API통합'),
 ('CT09','업무 결과 타입','operationId/state/kind별 정상/오류 JSON','스키마 예제와 서버 응답 동일·구형 id 제거','계약+API통합'),
 ('CT10','운영자 인증','앱 JWT·운영 JWT·MFA/역할 조합','앱 토큰/역할 부족 거부·조치와 감사 원자성','인증통합+운영수동'),
 ('CT11','개발 대역의 운영 혼입','production에 테스트 판정/로그인 어댑터 선택','시작 거부·판정 미설정은 review','배포설정+통합'),
 ('CT12','제한 계정 삭제 선행 정리','이용 제한 계정의 방장 이전/마지막 종료','최소 정리만 허용·공동감상/업로드 차단 유지','API권한+운영수동'),
 ('CT13','초대 확인 50회 경쟁','49회에서 동시 두 미리보기·51번째·로그인 복귀·참여하기','50회까지만 응답·INVITE_EXHAUSTED·복귀/참여는 횟수 미증가·기존 참여 유지','DB경쟁+API통합'),
 ('CT14','일차별 방문 15개 경쟁','14개에서 두 참여자 동시 추가·16번째·빈 방문 삭제 후 추가','15개 확정·VISIT_LIMIT·자리 복귀·planned_time 저장','DB경쟁+API통합'),
 ('CT15','작성자별 사진5/영상2 경쟁','같은 방문에 두 기기 동시 접수·실패/취소 반환·F17 방문 이동·미지정 묶음','합산 한도 유지·MEDIA_LIMIT 파일별·remaining 일치·이동 대상 재검증','DB경쟁+API통합+실파일')]

CONTRACT_CASES.append(('CT16','모든 현재 참여자의 초대 관리','방장/일반 참여자·타인 초대 취소·비참여/탈퇴/퇴장/이용 제한·종료 경합·멱등 재시도','현재 참여자 동일 권한·발급자 이력 유지·권한 소멸 뒤 거부·7일/50회/정원 유지','API권한+DB경쟁+Android 화면'))

def test_method(f,scenario):
    if any(k in scenario for k in ['동시','경쟁']):return 'DB 경쟁 + API 통합'
    if f in ['F01']:return '공급자 실연동 + Android 자동화/수동'
    if f in ['F07','F21']:return '고정 시계 도메인 단위 + API 통합'
    if f in ['F12','F13','F19','F28']:return 'Android 자동화 + 권한/저장 실기기 수동'
    if f=='F20':return '실파일 fixture + 메타데이터/호환성 검사'
    if f in ['F25','F26','F27']:return 'API 권한 + 운영 시나리오 수동'
    return 'API 통합 + Android 화면 확인'
