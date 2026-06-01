import { weekdaysBetween, weekdayLabel } from "./dates";
import { isTimeOffFacility } from "./scheduleKinds";
import type { DailyReport, Member, MemberWeekPlan, ScheduleEntry } from "./types";

export function buildNextWeekPlanContext(params: {
  nextWeekLabel: string;
  nextWeekStart: string;
  nextWeekEnd: string;
  members: Member[];
  nextWeekSchedules: ScheduleEntry[];
  weekPlans: MemberWeekPlan[];
  /** 분석 대상 주 일일 기록에 적힌 차주 계획 메모 */
  reportNextWeekPlans: DailyReport[];
}): string {
  const {
    nextWeekLabel,
    nextWeekStart,
    nextWeekEnd,
    members,
    nextWeekSchedules,
    weekPlans,
    reportNextWeekPlans,
  } = params;

  const workdays = weekdaysBetween(nextWeekStart, nextWeekEnd);
  const lines: string[] = [
    `# 차주(${nextWeekLabel}) 업무 계획`,
    "",
  ];

  let hasAny = false;

  for (const member of members) {
    const memberLines: string[] = [];
    const planText = weekPlans.find((p) => p.memberId === member.id)?.text?.trim();
    if (planText) {
      memberLines.push(`- **차주 계획 메모:** ${planText}`);
      hasAny = true;
    }

    const fromReports = reportNextWeekPlans
      .filter((r) => r.memberId === member.id && r.nextWeekPlan?.trim())
      .sort((a, b) => a.date.localeCompare(b.date));
    if (fromReports.length) {
      const latest = fromReports[fromReports.length - 1]!;
      memberLines.push(
        `- **일일 기록 차주 계획** (${latest.date}): ${latest.nextWeekPlan!.trim()}`
      );
      hasAny = true;
    }

    const memberSchedules = nextWeekSchedules
      .filter((s) => s.memberId === member.id && workdays.includes(s.date))
      .sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title));

    if (memberSchedules.length) {
      hasAny = true;
      memberLines.push(`- **등록 일정:**`);
      for (const s of memberSchedules) {
        const dow = weekdayLabel(s.date);
        const place = [s.stationName, s.facilityArea].filter(Boolean).join(" · ");
        const timeOff = isTimeOffFacility(s.facilityArea);
        const detail = timeOff
          ? s.title
          : [s.title, place, s.note?.trim()].filter(Boolean).join(" — ");
        memberLines.push(`  - ${s.date}(${dow}): ${detail}`);
      }
    }

    if (memberLines.length) {
      lines.push(`## ${member.name}`);
      lines.push(...memberLines);
      lines.push("");
    }
  }

  if (!hasAny) {
    lines.push("(차주 일정·계획 메모 없음)");
  }

  return lines.join("\n");
}

/** 자동 분석 보고서용 Markdown 섹션 (4번과 5번 사이) */
export function buildNextWeekPlanMarkdownSection(
  context: string,
  nextWeekLabel: string
): string {
  const trimmed = context.trim();
  if (trimmed.endsWith("(차주 일정·계획 메모 없음)")) {
    return [
      ``,
      `---`,
      ``,
      `## 4-1. 차주(${nextWeekLabel}) 업무 계획`,
      ``,
      `- 등록된 차주 일정·계획 메모가 없습니다. 홈 **다음주** 탭에서 일정을 등록하거나, 금요일 일일 기록·차주 계획 메모를 작성해 주세요.`,
    ].join("\n");
  }

  const body = trimmed
    .replace(/^# .+\n+/m, "")
    .trim();

  return [
    ``,
    `---`,
    ``,
    `## 4-1. 차주(${nextWeekLabel}) 업무 계획`,
    ``,
    body,
  ].join("\n");
}
