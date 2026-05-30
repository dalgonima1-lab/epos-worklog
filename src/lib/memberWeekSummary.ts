import type { DailyReport } from "./types";
import { weekdayLabel } from "./dates";
import { formatWorkDuration } from "./workTime";
import {
  MANAGEMENT_OFFICE_FACILITY,
  OFFICE_WORK_FACILITY,
} from "./stationFacility";

export interface ActivityRow {
  date: string;
  place: string;
  role: string;
  outcome: string;
}

export interface ThemeHighlight {
  label: string;
  count: number;
  stations: string[];
  summary: string;
}

export interface IssueRow {
  date: string;
  kind: string;
  text: string;
}

export interface MemberWeekDigest {
  statsLine: string;
  activityRows: ActivityRow[];
  highlights: ThemeHighlight[];
  issueRows: IssueRow[];
  issueSummaries: string[];
}

const WORK_THEMES: { label: string; key: RegExp }[] = [
  { label: "관제·DB·화면", key: /관제|DB|화면|Object|조명|매뉴얼/i },
  { label: "현장 설치·점검", key: /설치|점검|현장|배선|케이블|타일|콘크리트/i },
  { label: "장비·A/S·UPS", key: /A\/S|UPS|펌웨어|장비|교체|수리/i },
  { label: "유지보수", key: /유지보수|전력|점검표|기능실/i },
  { label: "통신·연동", key: /485|통신|IP|연동|부스덕|변전/i },
  { label: "사무·개발", key: /사무|스크립트|자동화|정리|검증|개발/i },
];

function summarizeText(text: string, max = 96): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return "—";
  const parts = normalized
    .split(/[·\n•]|(?<=[.!?])\s+/)
    .map((s) => s.replace(/^[-–—]\s*/, "").trim())
    .filter(Boolean);
  let result = parts[0] ?? normalized;
  if (parts.length > 1 && result.length < 40) {
    result = `${result} · ${parts[1]}`;
  }
  if (result.length > max) {
    return `${result.slice(0, max - 1).trim()}…`;
  }
  return result;
}

function formatPlace(report: DailyReport): string {
  const station = report.stationName?.trim();
  const facility = report.facilityArea?.trim();
  if (report.facilityArea === OFFICE_WORK_FACILITY) {
    const stations = report.officeWorkVisitedStations?.filter(Boolean) ?? [];
    if (stations.length) return `사무 (${stations.slice(0, 3).join(", ")}${stations.length > 3 ? " 외" : ""})`;
    return "사무실";
  }
  if (report.facilityArea === MANAGEMENT_OFFICE_FACILITY) {
    const visited = report.maintenanceVisitTargets ?? [];
    if (visited.length === 1) {
      return `${visited[0].station} · ${visited[0].facility}`;
    }
    if (visited.length > 1) {
      return `유지보수 ${visited.length}곳`;
    }
    return station ? `${station} · 유지보수` : "유지보수";
  }
  if (station && facility) return `${station} · ${facility}`;
  return station || facility || "—";
}

function compressOutcome(report: DailyReport): string {
  if (report.facilityArea === OFFICE_WORK_FACILITY && report.officeWorkEntries?.length) {
    const parts = report.officeWorkEntries
      .filter((e) => e.done?.trim())
      .slice(0, 2)
      .map((e) => summarizeText(e.done, 72));
    return parts.join(" · ") || summarizeText(report.done, 96);
  }

  if (report.facilityArea === MANAGEMENT_OFFICE_FACILITY) {
    const visited = report.maintenanceVisitTargets ?? [];
    const planned = report.maintenancePlannedTargets ?? [];
    const ratio =
      planned.length > 0
        ? `${visited.length}/${planned.length}곳`
        : visited.length
          ? `${visited.length}곳`
          : "";
    const defs = (report.maintenanceDeficienciesByStation ?? [])
      .filter((d) => d.text?.trim())
      .map((d) => summarizeText(d.text, 48));
    const base = ratio ? `유지보수 점검 ${ratio}` : summarizeText(report.done, 72);
    if (defs.length) return `${base} · 특이 ${defs[0]}`;
    return base || summarizeText(report.done, 96);
  }

  const done = report.done?.trim();
  if (!done) {
    if (report.workMinutes != null) {
      return `작업 ${formatWorkDuration(report.workMinutes)}`;
    }
    return "—";
  }
  return summarizeText(done, 96);
}

function reportSearchText(report: DailyReport): string {
  return [
    report.done,
    report.plan,
    report.issues,
    report.deficiencies,
    report.processingRole,
    report.stationName,
    ...(report.officeWorkEntries ?? []).map((e) => e.done),
    ...(report.maintenanceDeficienciesByStation ?? []).map((d) => d.text),
  ]
    .filter(Boolean)
    .join(" ");
}

function stationsFromReport(report: DailyReport): string[] {
  const set = new Set<string>();
  if (report.stationName?.trim()) {
    report.stationName.split(/[,，]/).forEach((s) => {
      const n = s.trim();
      if (n) set.add(n);
    });
  }
  for (const t of report.maintenanceVisitTargets ?? []) {
    if (t.station?.trim()) set.add(t.station.trim());
  }
  for (const e of report.officeWorkEntries ?? []) {
    if (e.station?.trim()) set.add(e.station.trim());
  }
  return [...set];
}

function buildHighlights(reports: DailyReport[]): ThemeHighlight[] {
  const highlights: ThemeHighlight[] = [];

  for (const theme of WORK_THEMES) {
    const matched = reports.filter((r) => theme.key.test(reportSearchText(r)));
    if (matched.length === 0) continue;

    const stations = [
      ...new Set(matched.flatMap((r) => stationsFromReport(r))),
    ];
    const bestOutcome = matched
      .map((r) => compressOutcome(r))
      .filter((t) => t && t !== "—")
      .sort((a, b) => b.length - a.length)[0];

    highlights.push({
      label: theme.label,
      count: matched.length,
      stations,
      summary: bestOutcome || `${theme.label} 관련 업무 수행`,
    });
  }

  if (highlights.length === 0 && reports.length > 0) {
    highlights.push({
      label: "주간 현장·업무",
      count: reports.length,
      stations: [...new Set(reports.flatMap(stationsFromReport))],
      summary: compressOutcome(reports[reports.length - 1]),
    });
  }

  return highlights.slice(0, 5);
}

function buildIssueRows(reports: DailyReport[]): IssueRow[] {
  const rows: IssueRow[] = [];
  for (const r of reports) {
    if (r.issues?.trim()) {
      rows.push({
        date: `${weekdayLabel(r.date)}`,
        kind: "이슈",
        text: summarizeText(r.issues, 120),
      });
    }
    if (r.deficiencies?.trim()) {
      rows.push({
        date: `${weekdayLabel(r.date)}`,
        kind: "미비",
        text: summarizeText(r.deficiencies, 120),
      });
    }
    for (const d of r.maintenanceDeficienciesByStation ?? []) {
      if (!d.text?.trim()) continue;
      rows.push({
        date: `${weekdayLabel(r.date)}`,
        kind: "유지보수 특이",
        text: `${d.station}: ${summarizeText(d.text, 100)}`,
      });
    }
  }
  return rows;
}

function buildIssueSummaries(rows: IssueRow[]): string[] {
  if (rows.length === 0) return [];
  const byKind = new Map<string, number>();
  for (const row of rows) {
    byKind.set(row.kind, (byKind.get(row.kind) ?? 0) + 1);
  }
  const summaries: string[] = [];
  for (const [kind, count] of byKind) {
    summaries.push(`**${kind} ${count}건** — 차주 클로징·담당·완료일 명시 필요`);
  }
  const top = rows.slice(0, 3);
  for (const row of top) {
    summaries.push(`**${row.date} ${row.kind}**: ${row.text}`);
  }
  return summaries.slice(0, 5);
}

export function buildMemberWeekDigest(
  reports: DailyReport[],
  stats: { submittedDays: number; expectedDays: number; missingDates: string[] }
): MemberWeekDigest {
  const sorted = [...reports].sort((a, b) => a.date.localeCompare(b.date));
  const stations = [...new Set(sorted.flatMap(stationsFromReport))];

  const statsParts = [
    `**${sorted.length}건** 일일 기록`,
    stats.expectedDays > 0
      ? `등록 일정 **${stats.submittedDays}/${stats.expectedDays}일** 제출`
      : null,
    stations.length ? `**${stations.join(", ")}** 현장·역사` : null,
  ].filter(Boolean);

  const activityRows: ActivityRow[] = sorted.map((r) => ({
    date: weekdayLabel(r.date),
    place: formatPlace(r),
    role: r.processingRole?.trim() || "—",
    outcome: compressOutcome(r),
  }));

  const issueRows = buildIssueRows(sorted);
  return {
    statsLine: statsParts.join(" · "),
    activityRows,
    highlights: buildHighlights(sorted),
    issueRows,
    issueSummaries: buildIssueSummaries(issueRows),
  };
}

/** Markdown 표·요약 bullet 생성 */
export function memberDigestToMarkdownPositive(digest: MemberWeekDigest): string[] {
  const lines: string[] = [
    `- ${digest.statsLine}`,
    ``,
    `**주간 활동 요약**`,
    `| 일자 | 역사·장소 | 공종 | 핵심 성과 |`,
    `|------|-----------|------|-----------|`,
  ];
  for (const row of digest.activityRows) {
    lines.push(
      `| ${row.date} | ${row.place} | ${row.role} | ${row.outcome} |`
    );
  }
  lines.push(``, `**핵심 성과 요약**`);
  for (const h of digest.highlights) {
    const stationHint =
      h.stations.length > 0
        ? ` (${h.stations.slice(0, 3).join(", ")}${h.stations.length > 3 ? " 외" : ""})`
        : "";
    lines.push(
      `- **${h.label}** ${h.count}건${stationHint}: ${h.summary}`
    );
  }
  return lines;
}

export function memberDigestToMarkdownNegative(
  digest: MemberWeekDigest,
  missingDates: string[]
): string[] {
  const lines: string[] = [];
  if (missingDates.length > 0) {
    lines.push(`- **일정 등록·미제출:** ${missingDates.join(", ")}`);
  }
  if (digest.issueRows.length > 0) {
    lines.push(``, `**미비·이슈 요약**`);
    lines.push(`| 일자 | 구분 | 내용 |`);
    lines.push(`|------|------|------|`);
    for (const row of digest.issueRows) {
      lines.push(`| ${row.date} | ${row.kind} | ${row.text} |`);
    }
    lines.push(``);
    for (const s of digest.issueSummaries) {
      lines.push(`- ${s}`);
    }
  } else if (missingDates.length === 0) {
    lines.push(`- 특이 미비·이슈 기록 없음 — 차주 계획·역사명 구체화 권장`);
  } else {
    lines.push(`- 제출된 날 기준 미비·이슈는 위 표 참고`);
  }
  return lines;
}
