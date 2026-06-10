export type CommonCodeSeed = {
  codeGroupCd: string;
  codeCd: string;
  codeLabel: string;
  codeDescription: string;
  sortOrder: number;
  isActive: boolean;
};

const initialCommonCodes = [
  {
    codeGroupCd: "USER_STATUS",
    codeCd: "active",
    codeLabel: "활성",
    codeDescription: "정상 사용 가능한 사용자 계정 상태",
    sortOrder: 10,
    isActive: true
  },
  {
    codeGroupCd: "USER_STATUS",
    codeCd: "merged",
    codeLabel: "통합됨",
    codeDescription: "다른 대표 계정으로 통합된 보조 계정 상태",
    sortOrder: 20,
    isActive: true
  },
  {
    codeGroupCd: "AUTH_PROVIDER",
    codeCd: "kakao",
    codeLabel: "카카오",
    codeDescription: "카카오 간편로그인 제공자",
    sortOrder: 10,
    isActive: true
  },
  {
    codeGroupCd: "AUTH_PROVIDER",
    codeCd: "naver",
    codeLabel: "네이버",
    codeDescription: "네이버 간편로그인 제공자",
    sortOrder: 20,
    isActive: true
  },
  {
    codeGroupCd: "AUTH_PROVIDER",
    codeCd: "google",
    codeLabel: "구글",
    codeDescription: "구글 간편로그인 제공자",
    sortOrder: 30,
    isActive: true
  },
  {
    codeGroupCd: "MERGE_STATUS",
    codeCd: "pending",
    codeLabel: "대기",
    codeDescription: "계정 통합 요청이 승인 전인 상태",
    sortOrder: 10,
    isActive: true
  },
  {
    codeGroupCd: "MERGE_STATUS",
    codeCd: "approved",
    codeLabel: "승인",
    codeDescription: "계정 통합 요청이 승인된 상태",
    sortOrder: 20,
    isActive: true
  },
  {
    codeGroupCd: "MERGE_STATUS",
    codeCd: "cancelled",
    codeLabel: "취소",
    codeDescription: "계정 통합 요청이 취소된 상태",
    sortOrder: 30,
    isActive: true
  },
  {
    codeGroupCd: "MERGE_STATUS",
    codeCd: "expired",
    codeLabel: "만료",
    codeDescription: "계정 통합 요청이 만료된 상태",
    sortOrder: 40,
    isActive: true
  },
  {
    codeGroupCd: "JOB_STATUS",
    codeCd: "pending",
    codeLabel: "대기",
    codeDescription: "후속 작업이 실행 전인 상태",
    sortOrder: 10,
    isActive: true
  },
  {
    codeGroupCd: "JOB_STATUS",
    codeCd: "running",
    codeLabel: "실행중",
    codeDescription: "후속 작업이 실행 중인 상태",
    sortOrder: 20,
    isActive: true
  },
  {
    codeGroupCd: "JOB_STATUS",
    codeCd: "completed",
    codeLabel: "완료",
    codeDescription: "후속 작업이 정상 완료된 상태",
    sortOrder: 30,
    isActive: true
  },
  {
    codeGroupCd: "JOB_STATUS",
    codeCd: "failed",
    codeLabel: "실패",
    codeDescription: "후속 작업이 실패한 상태",
    sortOrder: 40,
    isActive: true
  },
  {
    codeGroupCd: "AUDIT_EVENT_TYPE",
    codeCd: "LOCAL_USER_CREATED",
    codeLabel: "로컬 계정 생성",
    codeDescription: "ID/PW 기반 사용자 생성 이벤트",
    sortOrder: 10,
    isActive: true
  },
  {
    codeGroupCd: "AUDIT_EVENT_TYPE",
    codeCd: "LOGIN_SUCCESS",
    codeLabel: "로그인 성공",
    codeDescription: "인증 성공 이벤트",
    sortOrder: 20,
    isActive: true
  },
  {
    codeGroupCd: "AUDIT_EVENT_TYPE",
    codeCd: "LOGIN_FAILURE",
    codeLabel: "로그인 실패",
    codeDescription: "인증 실패 이벤트",
    sortOrder: 30,
    isActive: true
  },
  {
    codeGroupCd: "AUDIT_EVENT_TYPE",
    codeCd: "AUTH_IDENTITY_LINKED",
    codeLabel: "인증수단 연결",
    codeDescription: "OAuth 식별자 연결 이벤트",
    sortOrder: 40,
    isActive: true
  },
  {
    codeGroupCd: "AUDIT_EVENT_TYPE",
    codeCd: "AUTH_IDENTITY_UNLINKED",
    codeLabel: "인증수단 해제",
    codeDescription: "OAuth 식별자 해제 이벤트",
    sortOrder: 50,
    isActive: true
  },
  {
    codeGroupCd: "AUDIT_EVENT_TYPE",
    codeCd: "ACCOUNT_MERGE_REQUESTED",
    codeLabel: "계정 통합 요청",
    codeDescription: "계정 통합 요청 생성 이벤트",
    sortOrder: 60,
    isActive: true
  },
  {
    codeGroupCd: "AUDIT_EVENT_TYPE",
    codeCd: "ACCOUNT_MERGE_APPROVED",
    codeLabel: "계정 통합 승인",
    codeDescription: "계정 통합 승인 이벤트",
    sortOrder: 70,
    isActive: true
  },
  {
    codeGroupCd: "AUDIT_EVENT_TYPE",
    codeCd: "ACCOUNT_MERGE_CANCELLED",
    codeLabel: "계정 통합 취소",
    codeDescription: "계정 통합 요청 취소 이벤트",
    sortOrder: 80,
    isActive: true
  },
  {
    codeGroupCd: "AUDIT_EVENT_TYPE",
    codeCd: "ACCOUNT_MERGE_EXPIRED",
    codeLabel: "계정 통합 만료",
    codeDescription: "계정 통합 요청 만료 이벤트",
    sortOrder: 90,
    isActive: true
  },
  {
    codeGroupCd: "AUDIT_EVENT_TYPE",
    codeCd: "ACCOUNT_MERGED",
    codeLabel: "계정 통합됨",
    codeDescription: "보조 계정이 대표 계정으로 통합된 이벤트",
    sortOrder: 100,
    isActive: true
  },
  {
    codeGroupCd: "AUDIT_EVENT_TYPE",
    codeCd: "EMAIL_VERIFICATION_REQUIRED",
    codeLabel: "이메일 인증 필요",
    codeDescription: "이메일 인증 필수 설정에 의해 로그인이 제한된 이벤트",
    sortOrder: 110,
    isActive: true
  },
  {
    codeGroupCd: "AUDIT_EVENT_TYPE",
    codeCd: "VERIFIED_EMAIL_DELETED",
    codeLabel: "인증 이메일 삭제",
    codeDescription: "검증 이메일 삭제 이벤트",
    sortOrder: 120,
    isActive: true
  },
  {
    codeGroupCd: "AUDIT_EVENT_TYPE",
    codeCd: "EMAIL_CHANGE_REQUESTED",
    codeLabel: "이메일 변경 요청",
    codeDescription: "이메일 변경 요청 이벤트",
    sortOrder: 130,
    isActive: true
  },
  {
    codeGroupCd: "AUDIT_EVENT_TYPE",
    codeCd: "EMAIL_CHANGED",
    codeLabel: "이메일 변경 완료",
    codeDescription: "새 이메일 인증 후 이메일이 교체된 이벤트",
    sortOrder: 140,
    isActive: true
  }
] satisfies CommonCodeSeed[];

export function getInitialCommonCodes(): CommonCodeSeed[] {
  return initialCommonCodes.map((code) => ({ ...code }));
}
