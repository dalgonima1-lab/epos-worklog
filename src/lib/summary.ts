import type { DailyReport, Member } from "./types";
import { weekdaysBetween } from "./dates";
import { formatWorkDuration } from "./workTime";
import { photoApiUrl } from "./photoUrl";

export interface MemberWeekSummary {
  member: Member;
  submittedDays: number;
  expectedDays: number;
  missingDates: string[];
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

export function buildWeeklySummary(
  teamName: string,
  weekLabel: string,
  start: string,
  end: string,
  members: Member[],
  reports: DailyReport[]
): WeeklySummary {
  const workdays = weekdaysBetween(start, end);

  const memberSummaries: MemberWeekSummary[] = members.map((member) => {
    const memberReports = reports
      .filter((r) => r.memberId === member.id)
      .sort((a, b) => a.date.localeCompare(b.date));
    const submittedDates = new Set(memberReports.map((r) => r.date));
    const missingDates = workdays.filter((d) => !submittedDates.has(d));

    return {
      member,
      submittedDays: memberReports.length,
      expectedDays: workdays.length,
      missingDates,
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

export function summaryToMarkdown(summary: WeeklySummary): string {
  const lines: string[] = [
    `# ${summary.teamName} 주간 업무 요약`,
    ``,
    `**기간:** ${summary.weekLabel}`,
    `**생성:** ${new Date(summary.generatedAt).toLocaleString("ko-KR")}`,
    ``,
  ];

  for (const m of summary.members) {
    const rate = Math.round((m.submittedDays / m.expectedDays) * 100);
    lines.push(`## ${m.member.name}`);
    lines.push(
      `- 제출: ${m.submittedDays}/${m.expectedDays}일 (${rate}%)`
    );
    if (m.missingDates.length > 0) {
      lines.push(`- 미제출: ${m.missingDates.join(", ")}`);
    }
    lines.push("");

    for (const r of m.reports) {
      lines.push(`### ${r.date}`);
      if (r.stationName) {
        const place = r.facilityArea?.trim()
          ? `${r.stationName} · ${r.facilityArea}`
          : r.stationName;
        lines.push(`- **역사:** ${place}`);
      }
      if (r.processingRole) {
        lines.push(`- **공종:** ${r.processingRole}`);
      }
      if (r.workMinutes != null) {
        lines.push(`- **작업 시간:** ${formatWorkDuration(r.workMinutes)}`);
      }
      if (r.beforePhotoAt) {
        lines.push(`- 작업 전 시각: ${r.beforePhotoAt}`);
      }
      if (r.afterPhotoAt) {
        lines.push(`- 작업 후 시각: ${r.afterPhotoAt}`);
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
