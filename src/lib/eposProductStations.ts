import productData from "@/data/epos-product-stations.json";
import {
  normalizeStationName,
  parseMetroStationValue,
  stationMatchKeys,
} from "@/lib/metroStations";
import type { StationFacilityArea } from "@/lib/stationFacility";

export interface EposProductStation {
  line: number;
  stationName: string;
  facilities: StationFacilityArea[];
}

const STATIONS = productData.stations as EposProductStation[];

/** `line|역사명` (정규화) → 설치 기능실 */
const byLineStation = new Map<string, StationFacilityArea[]>();

/** 역사명만으로도 찾을 수 있게 (호선 미지정 시) */
const byStationOnly = new Map<string, StationFacilityArea[]>();

function mergeFacilityLists(
  a: StationFacilityArea[],
  b: StationFacilityArea[]
): StationFacilityArea[] {
  return [...new Set([...a, ...b])];
}

for (const row of STATIONS) {
  const key = `${row.line}|${normalizeStationName(row.stationName)}`;
  byLineStation.set(
    key,
    mergeFacilityLists(byLineStation.get(key) ?? [], row.facilities)
  );

  const only = normalizeStationName(row.stationName);
  byStationOnly.set(
    only,
    mergeFacilityLists(byStationOnly.get(only) ?? [], row.facilities)
  );
}

export function getEposProductFacilities(
  line: number,
  stationName: string
): StationFacilityArea[] {
  const norm = normalizeStationName(stationName);
  const exact = byLineStation.get(`${line}|${norm}`);
  if (exact?.length) return exact;

  const fallback = byStationOnly.get(norm);
  return fallback ?? [];
}

export function hasEposProductAtStation(
  line: number,
  stationName: string
): boolean {
  return getEposProductFacilities(line, stationName).length > 0;
}

/** 저장된 역 표기(`2호선 강남역`)로 제품 설치 여부·기능실 조회 */
export function getEposProductForDisplayName(displayName: string): {
  hasProduct: boolean;
  facilities: StationFacilityArea[];
} {
  const { line, stationName } = parseMetroStationValue(displayName);
  if (line != null && stationName) {
    const facilities = getEposProductFacilities(line, stationName);
    return { hasProduct: facilities.length > 0, facilities };
  }

  const keys = stationMatchKeys(displayName);
  for (const row of STATIONS) {
    const rowKeys = stationMatchKeys(
      row.line ? `${row.line}호선 ${row.stationName}` : row.stationName
    );
    if (keys.some((k) => rowKeys.includes(k))) {
      const facilities = getEposProductFacilities(row.line, row.stationName);
      return { hasProduct: facilities.length > 0, facilities };
    }
  }
  return { hasProduct: false, facilities: [] };
}

export function formatEposFacilitiesLabel(
  facilities: StationFacilityArea[]
): string {
  if (!facilities.length) return "";
  return facilities.join(" · ");
}

export function getEposProductStationCount(): number {
  return STATIONS.length;
}
