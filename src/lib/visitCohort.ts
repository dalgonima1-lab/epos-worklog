import { isSecurityTestPlaceholder } from "@/lib/sanitizeTestData";
import type { DailyReport, Member, ScheduleEntry } from "@/lib/types";

export function reportHasMeaningfulContent(r: DailyReport): boolean {
  if (isSecurityTestPlaceholder(r.stationName ?? "")) {
    return Boolean(
      r.processingRole?.trim() ||
        r.done?.trim() ||
        r.plan?.trim() ||
        r.hasBeforePhoto ||
        r.hasAfterPhoto
    );
  }
  return Boolean(
    r.stationName?.trim() ||
      r.processingRole?.trim() ||
      r.done?.trim() ||
      r.plan?.trim() ||
      r.hasBeforePhoto ||
      r.hasAfterPhoto
  );
}

export function visitGroupIdForMemberOnDate(
  schedules: ScheduleEntry[],
  memberId: string,
  date: string
): string | undefined {
  return schedules.find(
    (s) => s.memberId === memberId && s.date === date && s.visitGroupId?.trim()
  )?.visitGroupId?.trim();
}

export function cohortMemberIdsForVisit(
  schedules: ScheduleEntry[],
  date: string,
  visitGroupId: string
): string[] {
  const ids = new Set<string>();
  for (const s of schedules) {
    if (s.date === date && s.visitGroupId === visitGroupId) {
      ids.add(s.memberId);
    }
  }
  return [...ids];
}

export interface CohortCoverage {
  visitGroupId: string;
  recordedByMemberId: string;
  recordedByMemberName: string;
}

export function findCohortCoverage(
  memberId: string,
  date: string,
  schedules: ScheduleEntry[],
  reports: DailyReport[],
  memberNameById: Map<string, string>
): CohortCoverage | null {
  const visitGroupId = visitGroupIdForMemberOnDate(schedules, memberId, date);
  if (!visitGroupId) return null;

  const peer = reports.find(
    (r) =>
      r.date === date &&
      r.visitGroupId === visitGroupId &&
      r.memberId !== memberId &&
      reportHasMeaningfulContent(r)
  );
  if (!peer) return null;

  return {
    visitGroupId,
    recordedByMemberId: peer.memberId,
    recordedByMemberName:
      memberNameById.get(peer.memberId) ?? peer.memberId,
  };
}

export function isScheduleDayComplete(
  memberId: string,
  date: string,
  report: DailyReport | undefined,
  schedules: ScheduleEntry[],
  reports: DailyReport[],
  memberNameById: Map<string, string>
): boolean {
  if (report && reportHasMeaningfulContent(report)) return true;
  return findCohortCoverage(memberId, date, schedules, reports, memberNameById) !=
    null;
}

export function fieldMembers(members: Member[]): Member[] {
  return members.filter((m) => m.role === "member");
}

export function formatCohortMemberLabel(
  memberIds: string[],
  memberNameById: Map<string, string>
): string {
  const names = memberIds
    .map((id) => memberNameById.get(id) ?? id)
    .filter(Boolean);
  if (names.length <= 1) return names[0] ?? "";
  if (names.length === 2) return `${names[0]}·${names[1]}`;
  return `${names[0]} 외 ${names.length - 1}명`;
}
