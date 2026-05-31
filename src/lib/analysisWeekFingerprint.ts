import { createHash } from "crypto";
import type { DailyReport, ScheduleEntry, WeekAnalysisDataSignature } from "./types";
import { formatDirectiveTimestamp } from "./managerDirective";

function maxIso(dates: (string | undefined)[]): string | null {
  const valid = dates.filter(Boolean) as string[];
  if (valid.length === 0) return null;
  return valid.sort((a, b) => b.localeCompare(a))[0];
}

/** 해당 주 일일 기록·일정의 변경 감지용 지문 */
export function buildWeekDataSignature(
  reports: DailyReport[],
  schedules: ScheduleEntry[]
): WeekAnalysisDataSignature {
  const parts: string[] = [];

  for (const r of [...reports].sort((a, b) => a.id.localeCompare(b.id))) {
    parts.push(
      [
        "r",
        r.id,
        r.updatedAt,
        r.date,
        r.memberId,
        r.stationName ?? "",
        r.facilityArea ?? "",
        r.processingRole ?? "",
        r.done ?? "",
        r.plan ?? "",
        r.issues ?? "",
        r.deficiencies ?? "",
      ].join("|")
    );
  }

  for (const s of [...schedules].sort((a, b) => a.id.localeCompare(b.id))) {
    parts.push(
      [
        "s",
        s.id,
        s.updatedAt,
        s.date,
        s.memberId,
        s.title ?? "",
        s.stationName ?? "",
        s.facilityArea ?? "",
        s.note ?? "",
      ].join("|")
    );
  }

  const fingerprint = createHash("sha256")
    .update(parts.join("\n"))
    .digest("hex")
    .slice(0, 20);

  return {
    reportCount: reports.length,
    scheduleCount: schedules.length,
    fingerprint,
    latestDataAt: maxIso([
      ...reports.map((r) => r.updatedAt),
      ...schedules.map((s) => s.updatedAt),
    ]),
  };
}

export function describeWeekDataChange(
  prev: WeekAnalysisDataSignature | undefined,
  next: WeekAnalysisDataSignature
): string {
  if (!prev) {
    return `일일 기록 ${next.reportCount}건 · 일정 ${next.scheduleCount}건 반영`;
  }

  const bits: string[] = [];
  if (next.reportCount !== prev.reportCount) {
    bits.push(`일일 기록 ${prev.reportCount}→${next.reportCount}건`);
  }
  if (next.scheduleCount !== prev.scheduleCount) {
    bits.push(`일정 ${prev.scheduleCount}→${next.scheduleCount}건`);
  }
  if (bits.length === 0) {
    bits.push("일정·기록 내용 수정");
  }
  return bits.join(", ");
}

export function formatUnchangedAnalysisMessage(
  analyzedAt: string,
  signature?: WeekAnalysisDataSignature
): string {
  const when = formatDirectiveTimestamp(analyzedAt);
  const counts =
    signature != null
      ? ` (기록 ${signature.reportCount}건 · 일정 ${signature.scheduleCount}건)`
      : "";
  return `마지막 분석(${when}) 이후 일정·기록 변경이 없습니다${counts}. 기존 보고서를 유지합니다.`;
}

export function formatRefreshedAnalysisMessage(
  changeSummary: string,
  analyzedAt: string,
  source: "auto" | "gemini"
): string {
  const when = formatDirectiveTimestamp(analyzedAt);
  const src = source === "gemini" ? "Gemini" : "자동";
  return `${changeSummary} — ${src} 분석을 ${when}에 다시 저장했습니다.`;
}
