/** EPOS 관리팀 공종 */
export const PROCESSING_ROLES = [
  "전력감시시스템",
  "조명제어시스템",
  "유지보수 용역",
  "A/S",
] as const;

export type ProcessingRole = (typeof PROCESSING_ROLES)[number];

export const DEFAULT_TEAM_NAME = "EPOS 관리팀";

export const DEFAULT_TEAM_MEMBERS = [
  { id: "m2", name: "이준명 대리", role: "member" },
  { id: "m3", name: "유영준 사원", role: "member" },
  { id: "mgr", name: "최원제 팀장", role: "manager" },
] as const;
