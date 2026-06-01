import { PROCESSING_ROLES } from "@/lib/constants";
import { parseMetroStationValue } from "@/lib/metroStations";

/** 역사 방문 없이 사무실에서만 수행한 작업( AI 자동화 등) */
export const OFFICE_GENERAL_STATION = "사무실";

export const OFFICE_AI_AUTOMATION_ROLE = "AI를 통한 자동화";

/** 사무 작업 — 역사별 공종 */
export const OFFICE_STATION_ROLES: readonly string[] = PROCESSING_ROLES;

export interface OfficeWorkEntry {
  station: string;
  processingRole: string;
  done: string;
}

export function officeWorkEntryKey(station: string, role: string): string {
  return `${station.trim()}::${role.trim()}`;
}

export function parseOfficeWorkEntryKey(key: string): {
  station: string;
  role: string;
} | null {
  const i = key.indexOf("::");
  if (i < 0) return null;
  return { station: key.slice(0, i).trim(), role: key.slice(i + 2).trim() };
}

export function officeWorkEntriesToNotesMap(
  entries: OfficeWorkEntry[]
): Record<string, string> {
  const map: Record<string, string> = {};
  for (const e of entries) {
    if (!e.station.trim() || !e.processingRole.trim()) continue;
    map[officeWorkEntryKey(e.station, e.processingRole)] = e.done ?? "";
  }
  return map;
}

export function notesMapToOfficeWorkEntries(
  map: Record<string, string>
): OfficeWorkEntry[] {
  const out: OfficeWorkEntry[] = [];
  for (const [key, done] of Object.entries(map)) {
    const parsed = parseOfficeWorkEntryKey(key);
    if (!parsed) continue;
    out.push({
      station: parsed.station,
      processingRole: parsed.role,
      done: done.trim(),
    });
  }
  return out;
}

export function isOfficeGeneralStation(station: string): boolean {
  return station.trim() === OFFICE_GENERAL_STATION;
}

export function isOfficeAiAutomationRole(role: string): boolean {
  return role.trim() === OFFICE_AI_AUTOMATION_ROLE;
}

export function filledOfficeWorkEntries(
  entries: OfficeWorkEntry[]
): OfficeWorkEntry[] {
  return entries.filter((e) => {
    if (!e.processingRole.trim() || !e.done.trim()) return false;
    if (isOfficeAiAutomationRole(e.processingRole)) {
      return isOfficeGeneralStation(e.station);
    }
    return Boolean(e.station.trim()) && !isOfficeGeneralStation(e.station);
  });
}

/** 저장된 항목에서 오늘 작업한 역사 목록 복원 */
export function officeVisitedStationsFromEntries(
  entries: OfficeWorkEntry[],
  candidateStations: string[]
): string[] {
  const fromEntries = new Set(
    entries
      .filter(
        (e) =>
          e.done.trim() &&
          !isOfficeGeneralStation(e.station) &&
          !isOfficeAiAutomationRole(e.processingRole)
      )
      .map((e) => e.station.trim())
      .filter(Boolean)
  );
  const candidates = candidateStations.map((s) => s.trim()).filter(Boolean);
  if (fromEntries.size) {
    return candidates.filter((s) => fromEntries.has(s));
  }
  return [];
}

/** 일정 제목: `2호선-강남역-사무-전력감시시스템-작업요약` */
export function buildOfficeWorkScheduleTitle(
  stationDisplay: string,
  processingRole: string,
  workContent: string
): string {
  const station = stationDisplay.trim();
  const role = processingRole.trim();
  const work = workContent.trim().replace(/\s+/g, " ").slice(0, 40);
  const parts: string[] = [];
  if (isOfficeGeneralStation(station)) {
    parts.push("사무");
    if (isOfficeAiAutomationRole(role)) {
      parts.push("AI자동화");
    } else if (role) {
      parts.push(role.replace(/\s+/g, ""));
    }
    if (work) parts.push(work);
    return parts.join("-");
  }
  const { line, stationName } = parseMetroStationValue(station);
  if (line != null) parts.push(`${line}호선`);
  const name = (stationName || station).trim();
  if (name) parts.push(name);
  parts.push("사무");
  if (role) parts.push(role.replace(/\s+/g, ""));
  if (work) parts.push(work);
  return parts.join("-");
}

/** 일정 제목에서 공종 복원 (예: `2호선-강남역-사무-전력감시시스템-요약`) */
export function guessOfficeProcessingRoleFromScheduleTitle(
  title: string
): string | null {
  const parts = title.trim().split("-").filter(Boolean);
  const officeIdx = parts.findIndex((p) => p === "사무");
  if (officeIdx < 0 || officeIdx >= parts.length - 1) return null;
  const token = parts[officeIdx + 1]!.trim();
  if (token === "AI자동화") return OFFICE_AI_AUTOMATION_ROLE;
  for (const role of OFFICE_STATION_ROLES) {
    if (token === role.replace(/\s+/g, "")) return role;
  }
  return null;
}

export function summarizeOfficeWorkRoles(entries: OfficeWorkEntry[]): string {
  const roles = [...new Set(entries.map((e) => e.processingRole.trim()).filter(Boolean))];
  if (roles.length === 0) return "사무 작업";
  if (roles.length === 1) return roles[0]!;
  return `사무(${roles.join("·")})`;
}

/** @deprecated 사무 폼에서는 OFFICE_STATION_ROLES / OFFICE_AI_AUTOMATION_ROLE 사용 */
export const OFFICE_WORK_ROLES: readonly string[] = PROCESSING_ROLES;
