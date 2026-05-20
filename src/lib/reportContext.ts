import type { DailyReport, Member } from "./types";
import { formatWorkDuration } from "./workTime";

export function buildWeeklyReportsContext(
  teamName: string,
  weekLabel: string,
  members: Member[],
  reports: DailyReport[]
): string {
  const lines: string[] = [
    `# ${teamName} 일일 업무 원본 데이터`,
    `기간: ${weekLabel}`,
    "",
  ];

  for (const member of members) {
    const memberReports = reports
      .filter((r) => r.memberId === member.id)
      .sort((a, b) => a.date.localeCompare(b.date));

    lines.push(`## ${member.name}`);
    if (memberReports.length === 0) {
      lines.push("(해당 주 제출 기록 없음)");
      lines.push("");
      continue;
    }

    for (const r of memberReports) {
      lines.push(`### ${r.date}`);
      if (r.stationName) lines.push(`- 역사: ${r.stationName}`);
      if (r.processingRole) lines.push(`- 공종: ${r.processingRole}`);
      if (r.workMinutes != null) {
        lines.push(`- 작업 시간: ${formatWorkDuration(r.workMinutes)}`);
      }
      if (r.beforePhotoAt) lines.push(`- 작업 전 시각: ${r.beforePhotoAt}`);
      if (r.afterPhotoAt) lines.push(`- 작업 후 시각: ${r.afterPhotoAt}`);
      lines.push(`- 금일 수행:\n${r.done || "(없음)"}`);
      lines.push(`- 익일 계획:\n${r.plan || "(없음)"}`);
      if (r.issues?.trim()) lines.push(`- 이슈:\n${r.issues}`);
      if (r.deficiencies?.trim()) lines.push(`- 미비사항:\n${r.deficiencies}`);
      lines.push("");
    }
  }

  return lines.join("\n");
}
