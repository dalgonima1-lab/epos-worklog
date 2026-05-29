import { getEposProductForDisplayName } from "@/lib/eposProductStations";
import {
  canonicalStationDisplayName,
  normalizeStationName,
} from "@/lib/metroStations";
import {
  isStationFacilityArea,
  type StationFacilityArea,
} from "@/lib/stationFacility";
import type { StationRecord } from "@/lib/types";

export function mergeStationFacilityAreas(
  ...lists: (readonly StationFacilityArea[] | readonly string[])[]
): StationFacilityArea[] {
  const out: StationFacilityArea[] = [];
  for (const list of lists) {
    for (const raw of list) {
      const area = String(raw).trim();
      if (isStationFacilityArea(area) && !out.includes(area)) {
        out.push(area);
      }
    }
  }
  return out;
}

export function findStationRecord(
  displayName: string,
  records: readonly StationRecord[] = []
): StationRecord | undefined {
  const canonical = canonicalStationDisplayName(displayName);
  const norm = normalizeStationName(canonical).toLowerCase();
  return records.find(
    (rec) => normalizeStationName(rec.name).toLowerCase() === norm
  );
}

/** EPOS 납품·현황표 + 사용자 등록 기능실 병합 */
export function getStationFacilitiesForDisplayName(
  displayName: string,
  records: readonly StationRecord[] = []
): StationFacilityArea[] {
  const epos = getEposProductForDisplayName(displayName).facilities;
  const custom = findStationRecord(displayName, records);
  const customFacilities = mergeStationFacilityAreas(custom?.facilities ?? []);
  return mergeStationFacilityAreas(epos, customFacilities);
}

export function isCustomRegisteredStation(
  displayName: string,
  records: readonly StationRecord[] = []
): boolean {
  const rec = findStationRecord(displayName, records);
  return Boolean(rec?.custom || rec?.facilities?.length);
}

export function listCustomRegisteredStations(
  records: readonly StationRecord[] = []
): StationRecord[] {
  return records.filter((rec) => rec.custom || (rec.facilities?.length ?? 0) > 0);
}
