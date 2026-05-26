import type { DailyReport } from "@/lib/types";

export function createVisitGroupId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `vg_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

/** 역 표기에서 짧은 이름만 (길음역, 2호선 길음역 등) */
export function shortStationLabel(display: string): string {
  const t = display.trim();
  if (!t) return "";
  const m = t.match(/^\d+호선\s+(.+)$/);
  return (m ? m[1] : t).trim();
}

export function formatCohortLabel(stationNames: string[]): string {
  const labels = stationNames.map(shortStationLabel).filter(Boolean);
  if (labels.length <= 1) return labels[0] ?? "";
  if (labels.length === 2) return `${labels[0]}·${labels[1]} 함께 방문`;
  return `${labels[0]} 외 ${labels.length - 1}역 함께 방문`;
}

export function splitStationNames(all: string[]): {
  primary: string;
  additional: string[];
} {
  const names = all.map((s) => s.trim()).filter(Boolean);
  if (!names.length) return { primary: "", additional: [] };
  const [primary, ...rest] = names;
  return { primary: primary!, additional: rest };
}

export function allStationNamesForReport(report: DailyReport): string[] {
  const names: string[] = [];
  if (report.stationName?.trim()) names.push(report.stationName.trim());
  for (const s of report.additionalStationNames ?? []) {
    if (s?.trim()) names.push(s.trim());
  }
  return names;
}
