import type { StationFacilityArea } from "@/lib/stationFacility";

/** 역사·기능실 단위 유지보수 방문 (정기점검계획서 1건) */
export interface MaintenanceVisitTarget {
  /** `2호선 강남역` 형식 */
  station: string;
  facility: StationFacilityArea;
  /** 정기점검계획서 포함 여부 (false = 기능실 현황 서브만) */
  fromPlan: boolean;
}

export function maintenanceTargetKey(
  station: string,
  facility: string
): string {
  return `${station.trim()}::${facility.trim()}`;
}

export function parseMaintenanceTargetKey(key: string): {
  station: string;
  facility: string;
} | null {
  const i = key.indexOf("::");
  if (i < 0) return null;
  return {
    station: key.slice(0, i).trim(),
    facility: key.slice(i + 2).trim(),
  };
}

export function encodeMaintenanceVisitTargets(
  targets: MaintenanceVisitTarget[]
): string {
  return targets
    .map((t) =>
      encodeURIComponent(
        `${t.station}::${t.facility}::${t.fromPlan ? "1" : "0"}`
      )
    )
    .join("|");
}

export function decodeMaintenanceVisitTargets(
  raw: string
): MaintenanceVisitTarget[] {
  if (!raw.trim()) return [];
  const out: MaintenanceVisitTarget[] = [];
  for (const part of raw.split("|")) {
    const decoded = decodeURIComponent(part.trim());
    const bits = decoded.split("::");
    if (bits.length < 2) continue;
    const station = bits[0]!.trim();
    const facility = bits[1]!.trim() as StationFacilityArea;
    const fromPlan = bits[2] !== "0";
    if (!station || !facility) continue;
    out.push({ station, facility, fromPlan });
  }
  return out;
}

export function uniqueStationsFromTargets(
  targets: MaintenanceVisitTarget[]
): string[] {
  const seen = new Set<string>();
  const names: string[] = [];
  for (const t of targets) {
    const s = t.station.trim();
    if (!s || seen.has(s)) continue;
    seen.add(s);
    names.push(s);
  }
  return names;
}

/** 방문 대상 집계 (유지보수 시 관리소=기능실 1건 포함) */
export function countMaintenanceVisitTargets(
  targets: MaintenanceVisitTarget[],
  options?: { includeManagementOffice?: boolean }
): { stationCount: number; facilityCount: number } {
  return {
    stationCount: uniqueStationsFromTargets(targets).length,
    facilityCount:
      targets.length + (options?.includeManagementOffice ? 1 : 0),
  };
}

/** 예: `5역 · 12기능실 (관리소 포함)` */
export function formatMaintenanceVisitSummary(
  targets: MaintenanceVisitTarget[],
  includeManagementOffice = false
): string {
  const { stationCount, facilityCount } = countMaintenanceVisitTargets(
    targets,
    { includeManagementOffice }
  );
  if (stationCount === 0 && facilityCount === 0) return "";
  const officeNote = includeManagementOffice ? " (관리소 포함)" : "";
  return `${stationCount}역 · ${facilityCount}기능실${officeNote}`;
}
