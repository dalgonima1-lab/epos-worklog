export type Role = "manager" | "member";

export interface Member {
  id: string;
  name: string;
  role: Role;
}

export interface StationRecord {
  name: string;
  lastUsedAt: string;
  useCount: number;
}

export interface DailyReport {
  id: string;
  memberId: string;
  date: string;
  /** 현장 역사명 (예: 2호선 강남역) */
  stationName: string;
  /** 역사 내 작업 장소: 전기실 | 변전소 | 역무실 | 관리소(유지보수) */
  facilityArea?: string;
  /** 유지보수 시 전기관리소 id (예: 신답) */
  managementOffice?: string;
  /** 같은 묶음 방문 시 추가 역사명 (첫 역 제외) */
  additionalStationNames?: string[];
  /** additionalStationNames와 같은 순서의 작업 장소 */
  additionalFacilityAreas?: string[];
  /** 유지보수 방문 (역·기능실, 일일기록에서 해제 가능) */
  maintenanceVisitTargets?: { station: string; facility: string; fromPlan?: boolean }[];
  /** 유지보수 일정 기준 전체 점검 대상 (방문/미방문 구분용) */
  maintenancePlannedTargets?: {
    station: string;
    facility: string;
    fromPlan?: boolean;
  }[];
  /** 유지보수 역별 미비사항 */
  maintenanceDeficienciesByStation?: { station: string; text: string }[];
  /** 사무 작업: 역·공종별 수행 내용 */
  officeWorkEntries?: {
    station: string;
    processingRole: string;
    done: string;
  }[];
  /** 사무 작업: 오늘 실제 작업한 역사 (체크) */
  officeWorkVisitedStations?: string[];
  /** 여러 역·일정을 묶는 그룹 id */
  visitGroupId?: string;
  /** 공종 */
  processingRole: string;
  done: string;
  plan: string;
  issues: string;
  /** 미비사항 */
  deficiencies: string;
  /** 작업 전 사진 등록 시각 (ISO) */
  beforePhotoAt?: string;
  /** 작업 후 사진 등록 시각 (ISO) */
  afterPhotoAt?: string;
  /** Firebase Storage 없이 Firestore에 저장하는 소형 사진 데이터 URL */
  beforePhotoDataUrl?: string;
  /** Firebase Storage 없이 Firestore에 저장하는 소형 사진 데이터 URL */
  afterPhotoDataUrl?: string;
  /** 전·후 시각 기준 산정 작업시간(분) */
  workMinutes?: number;
  hasBeforePhoto?: boolean;
  hasAfterPhoto?: boolean;
  updatedAt: string;
}

/** 홈 주간 캘린더 일정 */
export interface ScheduleEntry {
  id: string;
  date: string;
  memberId: string;
  title: string;
  stationName?: string;
  /** 역사 내 작업 장소: 전기실 | 변전소 | 역무실 | 관리소(유지보수) */
  facilityArea?: string;
  /** 유지보수 시 전기관리소 id */
  managementOffice?: string;
  /** 유지보수 일정에 포함된 역사 전체 (일일기록에서 해제 가능) */
  maintenanceStationNames?: string[];
  /** 유지보수 점검 대상 (역·기능실) */
  maintenanceVisitTargets?: { station: string; facility: string; fromPlan?: boolean }[];
  /** 작업 내용 (제목 자동 생성에 사용) */
  note?: string;
  /** 여러 역·일정을 묶는 그룹 id */
  visitGroupId?: string;
  createdAt: string;
  updatedAt: string;
}

/** 주간 팀장 분석 (Gemini 또는 Cursor 등) */
export interface WeeklyAnalysisRecord {
  markdown: string;
  source: "gemini" | "cursor" | "file" | "auto";
  updatedAt: string;
}

export interface Database {
  teamName: string;
  managerPin: string;
  members: Member[];
  reports: DailyReport[];
  /** 최근 사용 역사 목록 (탭 선택용) */
  stationHistory: StationRecord[];
  /** 2 = 서울 1~9호선 전체 역 카탈로그 */
  stationCatalogVersion?: number;
  /** 1 = 보안테스트 placeholder 일일기록 제거 */
  dataSanitizeVersion?: number;
  schedules: ScheduleEntry[];
  /** `{start}_{end}` → 분석 본문 */
  weeklyAnalyses?: Record<string, WeeklyAnalysisRecord>;
}
