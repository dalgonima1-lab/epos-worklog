import type { WeeklySummary } from "./summary";

export interface SubmissionReadiness {
  complete: boolean;
  reason: string;
  members: {
    name: string;
    submittedDays: number;
    expectedDays: number;
    missingDates: string[];
  }[];
}

/** 팀원 전원이 해당 주 월~금 일일 기록을 제출했는지 */
export function isWeekSubmissionComplete(
  summary: WeeklySummary
): SubmissionReadiness {
  const members = summary.members.map((m) => ({
    name: m.member.name,
    submittedDays: m.submittedDays,
    expectedDays: m.expectedDays,
    missingDates: m.missingDates,
  }));

  const incomplete = members.filter((m) => m.missingDates.length > 0);
  if (incomplete.length > 0) {
    const detail = incomplete
      .map((m) => `${m.name}: 미제출 ${m.missingDates.join(", ")}`)
      .join(" · ");
    return {
      complete: false,
      reason: `주간 제출 미완료 — ${detail}`,
      members,
    };
  }

  const emptyContent = summary.members.filter((m) =>
    m.reports.some(
      (r) => !r.stationName?.trim() || !r.done?.trim()
    )
  );
  if (emptyContent.length > 0) {
    const names = emptyContent.map((m) => m.member.name).join(", ");
    return {
      complete: false,
      reason: `역사명·금일 실적이 비어 있는 날이 있습니다: ${names}`,
      members,
    };
  }

  return {
    complete: true,
    reason:
      summary.expectedDays > 0
        ? `등록된 현장·사무 일정 ${summary.expectedDays}건 기준 제출 확인`
        : `공휴일·미등록 일 제외 — 제출 대상 일정 없음`,
    members,
  };
}
