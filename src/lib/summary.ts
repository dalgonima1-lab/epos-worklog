import type { DailyReport, Member, ScheduleEntry } from "./types";
import { weekdaysBetween } from "./dates";
import { formatWorkDuration } from "./workTime";
import { photoApiUrl } from "./photoUrl";
import { reportHasMeaningfulContent } from "./visitCohort";
import { isTimeOffFacility } from "./scheduleKinds";
import { MANAGEMENT_OFFICE_FACILITY } from "./stationFacility";

export interface MemberWeekSummary {
  member: Member;
  submittedDays: number;
  expectedDays: number;
  missingDates: string[];
  timeOffDates: string[];
  reports: DailyReport[];
}

export interface WeeklySummary {
  teamName: string;
  weekLabel: string;
  start: string;
  end: string;
  expectedDays: number;
  members: MemberWeekSummary[];
  generatedAt: string;
}

function timeOffDatesForMember(
  memberId: string,
  workdays: string[],
  schedules: ScheduleEntry[]
): Set<string> {
  const set = new Set<string>();
  for (const s of schedules) {
    if (s.memberId === memberId && workdays.includes(s.date)) {
      if (isTimeOffFacility(s.facilityArea)) set.add(s.date);
    }
  }
  return set;
}

export function buildWeeklySummary(
  teamName: string,
  weekLabel: string,
  start: string,
  end: string,
  members: Member[],
  reports: DailyReport[],
  schedules: ScheduleEntry[] = []
): WeeklySummary {
  const workdays = weekdaysBetween(start, end);

  const memberSummaries: MemberWeekSummary[] = members.map((member) => {
    const timeOff = timeOffDatesForMember(member.id, workdays, schedules);
    const expected = workdays.filter((d) => !timeOff.has(d));

    const memberReports = reports
      .filter((r) => r.memberId === member.id && reportHasMeaningfulContent(r))
      .sort((a, b) => a.date.localeCompare(b.date));
    const submittedDates = new Set(memberReports.map((r) => r.date));
    const missingDates = expected.filter((d) => !submittedDates.has(d));

    return {
      member,
      submittedDays: memberReports.filter((r) => expected.includes(r.date))
        .length,
      expectedDays: expected.length,
      missingDates,
      timeOffDates: [...timeOff].sort(),
      reports: memberReports,
    };
  });

  return {
    teamName,
    weekLabel,
    start,
    end,
    expectedDays: workdays.length,
    members: memberSummaries,
    generatedAt: new Date().toISOString(),
  };
}

function formatMaintenanceBlock(r: DailyReport): string[] {
  const lines: string[] = [];
  const targets = r.maintenanceVisitTargets ?? [];
  const planned = r.maintenancePlannedTargets ?? [];
  if (planned.length || targets.length) {
    lines.push(`- **유지보수 방문:** ${targets.length}/${planned.length || targets.length}건`);
    for (const t of targets.slice(0, 12)) {
      lines.push(`  - ${t.station} · ${t.facility}`);
    }
    if (targets.length > 12) lines.push(`  - … 외 ${targets.length - 12}건`);
  }
  const defs = r.maintenanceDeficienciesByStation ?? [];
  if (defs.length) {
    lines.push(`- **역별 미비:**`);
    for (const d of defs) {
      if (d.text?.trim()) lines.push(`  - ${d.station}: ${d.text.trim()}`);
    }
  }
  return lines;
}

export function summaryToMarkdown(summary: WeeklySummary): string {
  const lines: string[] = [
    `# ${summary.teamName} 주간 업무 요약`,
    ``,
    `**기간:** ${summary.weekLabel}`,
    `**생성:** ${new Date(summary.generatedAt).toLocaleString("ko-KR")}`,
    ``,
  ];

  for (const m of summary.members) {
    const rate =
      m.expectedDays > 0
        ? Math.round((m.submittedDays / m.expectedDays) * 100)
        : 100;
    lines.push(`## ${m.member.name}`);
    lines.push(
      `- 제출: ${m.submittedDays}/${m.expectedDays}일 (${rate}%)`
    );
    if (m.timeOffDates.length > 0) {
      lines.push(`- 휴무(연차·공휴): ${m.timeOffDates.join(", ")}`);
    }
    if (m.missingDates.length > 0) {
      lines.push(`- 미제출: ${m.missingDates.join(", ")}`);
    }
    lines.push("");

    for (const r of m.reports) {
      lines.push(`### ${r.date}`);
      if (r.stationName) {
        const extras = r.additionalFacilityAreas?.length
          ? ` · ${r.additionalFacilityAreas.join(" · ")}`
          : "";
        const place = r.facilityArea?.trim()
          ? `${r.stationName} · ${r.facilityArea}${extras}`
          : r.stationName;
        lines.push(`- **역사:** ${place}`);
      }
      if (r.processingRole) {
        lines.push(`- **공종:** ${r.processingRole}`);
      }
      if (r.facilityArea === MANAGEMENT_OFFICE_FACILITY) {
        lines.push(...formatMaintenanceBlock(r));
      }
      if (r.workMinutes != null) {
        lines.push(`- **작업 시간:** ${formatWorkDuration(r.workMinutes)}`);
      }
      if (r.hasBeforePhoto) {
        lines.push(
          `- 작업 전 사진: ${photoApiUrl(r.memberId, r.date, "before")}`
        );
      }
      if (r.hasAfterPhoto) {
        lines.push(
          `- 작업 후 사진: ${photoApiUrl(r.memberId, r.date, "after")}`
        );
      }
      lines.push("");
      lines.push(`**금일 수행**`);
      lines.push(r.done || "(없음)");
      lines.push("");
      lines.push(`**익일 계획**`);
      lines.push(r.plan || "(없음)");
      if (r.issues?.trim()) {
        lines.push("");
        lines.push(`**이슈/지원요청**`);
        lines.push(r.issues);
      }
      if (r.deficiencies?.trim()) {
        lines.push("");
        lines.push(`**미비사항**`);
        lines.push(r.deficiencies);
      }
      lines.push("");
    }
  }

  return lines.join("\n");
}

function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

/** 팀장용 CSV (일별 1행) */
export function summaryToCsv(summary: WeeklySummary): string {
  const header = [
    "날짜",
    "팀원",
    "역사",
    "작업장소",
    "공종",
    "금일수행",
    "익일계획",
    "이슈",
    "미비사항",
    "작업분",
    "유지보수방문",
  ].join(",");
  const rows: string[] = [header];

  for (const m of summary.members) {
    for (const r of m.reports) {
      const facilities = [
        r.facilityArea,
        ...(r.additionalFacilityAreas ?? []),
      ]
        .filter(Boolean)
        .join(" · ");
      const maint =
        r.maintenanceVisitTargets?.map((t) => `${t.station}/${t.facility}`).join("; ") ??
        "";
      rows.push(
        [
          r.date,
          m.member.name,
          r.stationName ?? "",
          facilities,
          r.processingRole ?? "",
          r.done ?? "",
          r.plan ?? "",
          r.issues ?? "",
          r.deficiencies ?? "",
          r.workMinutes != null ? String(r.workMinutes) : "",
          maint,
        ]
          .map((c) => csvEscape(String(c)))
          .join(",")
      );
    }
  }
  return rows.join("\n");
}
