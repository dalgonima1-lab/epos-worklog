/** 역사 방문 시 작업 장소 (3종) */
export const STATION_FACILITY_AREAS = ["전기실", "변전소", "역무실"] as const;

export type StationFacilityArea = (typeof STATION_FACILITY_AREAS)[number];

export function isStationFacilityArea(
  value: string
): value is StationFacilityArea {
  return (STATION_FACILITY_AREAS as readonly string[]).includes(value);
}

export function formatStationVisitLabel(
  stationName: string,
  facilityArea?: string
): string {
  const station = stationName.trim();
  const area = facilityArea?.trim();
  if (!station) return area ?? "";
  if (!area || !isStationFacilityArea(area)) return station;
  return `${station} · ${area}`;
}
