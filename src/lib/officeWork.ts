import { PROCESSING_ROLES } from "@/lib/constants";
import { parseMetroStationValue } from "@/lib/metroStations";

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

export function filledOfficeWorkEntries(
  entries: OfficeWorkEntry[]
): OfficeWorkEntry[] {
  return entries.filter(
    (e) =>
      e.station.trim() &&
      e.processingRole.trim() &&
      e.done.trim()
  );
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
  const { line, stationName } = parseMetroStationValue(station);
  const parts: string[] = [];
  if (line != null) parts.push(`${line}호선`);
  const name = (stationName || station).trim();
  if (name) parts.push(name);
  parts.push("사무");
  if (role) parts.push(role.replace(/\s+/g, ""));
  if (work) parts.push(work);
  return parts.join("-");
}

export function summarizeOfficeWorkRoles(entries: OfficeWorkEntry[]): string {
  const roles = [...new Set(entries.map((e) => e.processingRole.trim()).filter(Boolean))];
  if (roles.length === 0) return "사무 작업";
  if (roles.length === 1) return roles[0]!;
  return `사무(${roles.join("·")})`;
}

export const OFFICE_WORK_ROLES: readonly string[] = PROCESSING_ROLES;
