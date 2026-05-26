import productData from "@/data/epos-product-stations.json";
import { resolveManagementOffice } from "@/lib/eposStationOffices";
import { formatMetroStationValue, normalizeStationName } from "@/lib/metroStations";
import type { MaintenanceVisitTarget } from "@/lib/maintenanceVisit";
import type { StationFacilityArea } from "@/lib/stationFacility";

export interface MaintenancePlanEntry {
  officeId: string;
  line: number;
  stationName: string;
  facility: StationFacilityArea;
}

const PLAN = (productData.maintenancePlan ?? []) as MaintenancePlanEntry[];

function officeIdsForQuery(officeIdOrShort: string): Set<string> {
  const office = resolveManagementOffice(officeIdOrShort);
  const id = office?.id ?? officeIdOrShort.trim();
  return new Set([id, officeIdOrShort.trim()].filter(Boolean));
}

export function getMaintenancePlanForOffice(
  officeIdOrShort: string
): MaintenancePlanEntry[] {
  const ids = officeIdsForQuery(officeIdOrShort);
  return PLAN.filter((e) => ids.has(e.officeId));
}

/** 정기점검계획서 항목만 (기본 선택 단위) */
export function getDefaultMaintenanceSelections(
  officeIdOrShort: string
): MaintenanceVisitTarget[] {
  return getMaintenancePlanForOffice(officeIdOrShort).map((e) => ({
    station: formatMetroStationValue(e.line, e.stationName),
    facility: e.facility,
    fromPlan: true,
  }));
}

/** 정기점검계획서만 — 유지보수 초기 선택 */
export function buildMaintenanceSelectionsForOffice(
  officeIdOrShort: string
): MaintenanceVisitTarget[] {
  return getDefaultMaintenanceSelections(officeIdOrShort);
}

/** 정기점검계획서 역 목록 (`2호선 강남역` 형식, 중복 제거) */
export function getMaintenancePlanStationDisplaysForOffice(
  officeIdOrShort: string
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const e of getMaintenancePlanForOffice(officeIdOrShort)) {
    const d = formatMetroStationValue(e.line, e.stationName);
    if (seen.has(d)) continue;
    seen.add(d);
    out.push(d);
  }
  return out.sort((a, b) => a.localeCompare(b, "ko"));
}

/** URL·저장 역 목록만 있을 때 역·기능실 단위로 복원 */
export function maintenanceSelectionsFromStationDisplays(
  officeIdOrShort: string,
  stationDisplays: string[]
): MaintenanceVisitTarget[] {
  const all = buildMaintenanceSelectionsForOffice(officeIdOrShort);
  if (!stationDisplays.length) return all;
  const wanted = new Set(stationDisplays.map((s) => s.trim()).filter(Boolean));
  return all.filter((t) => wanted.has(t.station.trim()));
}

export function isStationInMaintenancePlan(
  officeIdOrShort: string,
  line: number,
  stationName: string
): boolean {
  const norm = normalizeStationName(stationName);
  const ids = officeIdsForQuery(officeIdOrShort);
  return PLAN.some(
    (e) =>
      ids.has(e.officeId) &&
      e.line === line &&
      normalizeStationName(e.stationName) === norm
  );
}

export function getMaintenancePlanFacilities(
  officeIdOrShort: string,
  line: number,
  stationName: string
): StationFacilityArea[] {
  const norm = normalizeStationName(stationName);
  const ids = officeIdsForQuery(officeIdOrShort);
  const set = new Set<StationFacilityArea>();
  for (const e of PLAN) {
    if (
      ids.has(e.officeId) &&
      e.line === line &&
      normalizeStationName(e.stationName) === norm
    ) {
      set.add(e.facility);
    }
  }
  return [...set];
}

export function getMaintenancePlanStationCount(
  officeIdOrShort: string
): number {
  const seen = new Set<string>();
  for (const e of getMaintenancePlanForOffice(officeIdOrShort)) {
    seen.add(`${e.line}|${normalizeStationName(e.stationName)}`);
  }
  return seen.size;
}
