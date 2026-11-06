export class NetworkError extends Error {
  constructor() { super('서버에 연결할 수 없습니다. 네트워크를 확인하고 다시 시도해 주세요. 입력과 대기 파일은 유지됩니다.'); }
}
export class ApiError extends Error {
  constructor(
    public code: string,
    public requestId?: string,
    public details?: any,
    public httpStatus?: number,
  ) {
    super(
      (
        {
          GROUP_LIMIT: '참여할 수 있는 모임 수를 초과했어요.',
          OWNER_CREATE_LIMIT: '방장으로 만들 수 있는 모임 수를 초과했어요.',
          TEXT_REJECTED: '사용할 수 없는 표현이 있어요. 입력한 내용을 바꿔 주세요.',
          FILE_CHANGED: '선택한 파일이 바뀌었어요. 파일을 다시 선택해 주세요.',
          MODERATION_RESTRICTED: '검토 또는 이용 제한으로 현재 볼 수 없는 기록이에요.',
          UNSUPPORTED_MEDIA_TYPE: '지원하지 않는 요청 형식이에요. 앱을 최신 버전으로 업데이트해 주세요.',
          CAPACITY_FULL: '모임 정원 10명이 모두 찼어요.',
          INTERNAL_ERROR: '서버에서 요청을 처리하지 못했어요. 잠시 후 다시 시도해 주세요.',
          CONCURRENT_CHANGE: '다른 변경과 겹쳤어요. 최신 상태를 확인한 뒤 다시 시도해 주세요.',
          OWNER_TRANSFER_REQUIRED: '방장을 다른 참여자에게 넘긴 뒤 나갈 수 있어요.',
          MEMBERS_REMAIN: '다른 참여자가 남아 있어 모임을 종료할 수 없어요.',
          LAST_IDENTITY: '마지막 로그인 수단은 연결을 해제할 수 없어요.',
          IDENTITY_IN_USE: '다른 계정에 연결된 로그인 수단이에요.',
          REAUTH_REQUIRED: '본인 확인이 필요해요. 다시 인증해 주세요.',
          TARGET_INACTIVE: '선택한 참여자를 현재 지정할 수 없어요.',
          INVALID_VISIT_SET: '장소 목록이 변경됐어요. 최신 목록을 확인해 주세요.',
          QUOTA_EXCEEDED: '허용된 개수나 용량을 초과했어요.',
          MODERATION_REJECTED: '검사에서 반려된 내용이에요. 내용을 바꿔 주세요.',
          CONSENT_VERSION_CHANGED: '동의 문서가 변경됐어요. 최신 문서를 확인해 주세요.',
          PENDING_UPLOADS: '진행 중인 업로드를 정리한 뒤 다시 시도해 주세요.',
          NOT_FOUND: '대상을 찾을 수 없어요.',
          DELETED: '삭제된 기록이에요.',
          BLOCKED: '현재 볼 수 없는 기록이에요.',
          DUPLICATE_FILE: '이미 선택하거나 접수한 파일이에요.',
          RATE_LIMITED: '요청이 많아요. 잠시 후 다시 시도해 주세요.',
          SERVICE_NOT_READY: '서비스 연결을 준비하고 있습니다. 잠시 후 다시 시도해 주세요.',
          KAKAO_NOT_CONFIGURED: '카카오 로그인 연결 설정이 필요합니다.',
          PROVIDER_NOT_CONFIGURED: '이 로그인 수단은 아직 연결되지 않았습니다.',
          DOCUMENT_UNAVAILABLE: '가입 문서를 불러올 수 없습니다. 잠시 후 다시 확인해 주세요.',
          AUTH_INVALID: '로그인 인증에 실패했습니다. 다시 시작해 주세요.',
          AUTH_CANCELLED: '카카오 로그인을 취소했습니다.',
          PROVIDER_QUOTA_EXCEEDED:
            '장소 검색 무료 한도에 도달했습니다. 지금은 직접 등록을 이용해 주세요.',
          PROVIDER_UNAVAILABLE:
            '외부 서비스에 연결할 수 없습니다. 잠시 후 다시 시도하거나 직접 등록해 주세요.',
          INVITE_INVALID: '유효하지 않은 초대입니다. 링크나 코드를 확인해 주세요.',
          INVITE_EXPIRED: '초대가 만료되었습니다. 새 초대를 받아 주세요.',
          INVITE_REVOKED: '취소된 초대입니다. 새 초대를 받아 주세요.',
          GROUP_CLOSED: '종료된 모임입니다.',
          REENTRY_BLOCKED: '이 모임의 재참여가 차단되어 있습니다.',
          DUPLICATE_VISIT: '이 날짜에 이미 추가한 장소입니다.',
          FILE_TOO_LARGE: '사진은 50MB, 영상은 200MB까지 선택할 수 있습니다.',
          FILE_NOT_READY: '파일을 아직 준비하고 있습니다. 잠시 후 다시 확인해 주세요.',
          AUTH_EXPIRED: '다시 로그인해 주세요.',
          VALIDATION_ERROR:
            '입력한 내용을 확인해 주세요. 날짜는 YYYY-MM-DD, 시각은 1분 단위 HH:mm 형식으로 입력합니다.',
          DATE_OUTSIDE_SCHEDULE: '일정 기간 안의 날짜를 선택해 주세요.',
          FORBIDDEN: '접근 권한이 변경되었습니다.',
          ACCESS_REVOKED: '현재 이용할 수 없는 기능입니다.',
          VERSION_CONFLICT:
            '다른 사람이 먼저 변경했어요. 입력을 유지했으니 최신 내용을 확인해 주세요.',
          EXPIRED: '기록 보관 기한이 지났습니다.',
          INVITE_EXHAUSTED:
            '초대 확인 횟수를 모두 사용했어요. 현재 참여자에게 새 초대를 요청해 주세요.',
          MEDIA_LIMIT: '이 장소에 올릴 수 있는 사진·영상 개수를 초과했습니다.',
          FILE_INVALID:
            '지원하지 않거나 손상된 파일입니다. 파일 형식을 확인하거나 다시 촬영해 주세요.',
          MEDIA_PROCESSING_FAILED: '파일 처리에 실패했습니다. 잠시 후 다시 시도해 주세요.',
          LOCATION_UNVERIFIED: '촬영 위치 정보를 안전하게 제거하지 못해 공개하지 않았습니다.',
          STORAGE_LIMIT: '모임 저장 공간이 부족합니다. 저장 공간을 확인해 주세요.',
          VISIT_LIMIT: '이 날짜에는 장소를 15개까지 추가할 수 있어요.',
          CONSENT_REQUIRED: '최신 필수 약관을 확인하고 동의해 주세요.',
          OWNER_ROLES_REMAIN: '방장인 모임의 역할을 먼저 정리해 주세요.',
          SCHEDULE_DATE_TAKEN: '이미 일정이 있는 날짜예요. 하루에는 일정을 하나만 만들 수 있어요.',
          DAY_BUSY: '이 날짜에 진행 중인 업로드가 있어요. 잠시 후 다시 시도해 주세요.',
          DAY_CANCELLED: '취소된 날에는 새 사진·영상이나 장소를 추가할 수 없어요.',
          NOT_EMPTY: '장소나 기록이 담긴 날은 삭제할 수 없어요.',
          TARGET_NOT_EMPTY: '옮길 날짜에 이 일정의 기존 장소나 기록이 남아 있어 옮길 수 없어요.',
          SCHEDULE_CANCELLED: '취소된 일정은 바꿀 수 없어요.',
          ALREADY_CANCELLED: '이미 취소된 날이에요.',
        } as Record<string, string>
      )[code] ?? '요청을 처리하지 못했어요. 입력 내용과 이용 상태를 확인해 주세요.',
    );
  }
}

/** Expiry is a screen state; membership loss leaves the shared group. */
export function shouldLeaveSharedScope(method: string, path: string, status: number, code: string, handledLocally = false) {
  return (
    !handledLocally &&
    method === 'GET' &&
    /^\/(groups|schedules)\//.test(path) &&
    [403, 410].includes(status) &&
    code !== 'EXPIRED'
  );
}
