import type { DailyReport, Database, StationRecord } from "./types";

/** 보안 점검·자동화 테스트용 placeholder (예: [보안테스트-삭제됨]) */
export function isSecurityTestPlaceholder(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  if (/보안\s*테스/i.test(t) && /삭제\s*됨/i.test(t)) return true;
  if (/^\[.*보안.*\]/i.test(t) && /삭제\s*됨/i.test(t)) return true;
  return false;
}

function reportHasMeaningfulContent(r: DailyReport): boolean {
  return Boolean(
    r.done?.trim() ||
      r.plan?.trim() ||
      r.issues?.trim() ||
      r.deficiencies?.trim() ||
      r.hasBeforePhoto ||
      r.hasAfterPhoto ||
      (r.processingRole?.trim() && r.processingRole.trim() !== "-")
  );
}

export function isRemovableSecurityTestReport(r: DailyReport): boolean {
  if (!isSecurityTestPlaceholder(r.stationName ?? "")) return false;
  return !reportHasMeaningfulContent(r);
}

export function sanitizeDatabaseTestArtifacts(db: Database): {
  removedReports: number;
  cleanedStations: number;
  cleanedSchedules: number;
} {
  let removedReports = 0;
  let cleanedStations = 0;
  let cleanedSchedules = 0;

  const beforeReports = db.reports.length;
  db.reports = db.reports.filter((r) => {
    if (isRemovableSecurityTestReport(r)) {
      return false;
    }
    if (isSecurityTestPlaceholder(r.stationName ?? "")) {
      r.stationName = "";
    }
    return true;
  });
  removedReports = beforeReports - db.reports.length;

  if (Array.isArray(db.stationHistory)) {
    const before = db.stationHistory.length;
    db.stationHistory = db.stationHistory.filter(
      (s) => !isSecurityTestPlaceholder(s.name)
    );
    cleanedStations = before - db.stationHistory.length;
  }

  if (Array.isArray(db.schedules)) {
    for (const s of db.schedules) {
      if (s.stationName && isSecurityTestPlaceholder(s.stationName)) {
        s.stationName = undefined;
        cleanedSchedules += 1;
      }
      if (s.title && isSecurityTestPlaceholder(s.title)) {
        s.title = "일정";
        cleanedSchedules += 1;
      }
    }
  }

  return { removedReports, cleanedStations, cleanedSchedules };
}

export function filterStationRecordsForDisplay(
  records: StationRecord[]
): StationRecord[] {
  return records.filter((s) => !isSecurityTestPlaceholder(s.name));
}
