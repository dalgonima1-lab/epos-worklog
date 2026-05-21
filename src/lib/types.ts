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
  /** 현장 역사명 (예: 명동역) */
  stationName: string;
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
  note?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Database {
  teamName: string;
  managerPin: string;
  members: Member[];
  reports: DailyReport[];
  /** 최근 사용 역사 목록 (탭 선택용) */
  stationHistory: StationRecord[];
  schedules: ScheduleEntry[];
}
