import { PROCESSING_ROLES } from "@/lib/constants";

/** 역사 방문 시 작업 장소 (3종) */
export const STATION_FACILITY_AREAS = ["전기실", "변전소", "역무실"] as const;

export type StationFacilityArea = (typeof STATION_FACILITY_AREAS)[number];

/** 전기실·변전소 공종 */
export const PROCESSING_ROLES_POWER = [
  "전력감시시스템",
  "유지보수 용역",
  "A/S",
] as const;

/** 역무실 공종 */
export const PROCESSING_ROLES_LIGHTING = [
  "조명제어시스템",
  "유지보수 용역",
  "A/S",
] as const;

export function getProcessingRolesForFacility(
  facilityArea: string | undefined
): readonly string[] {
  if (facilityArea === "전기실" || facilityArea === "변전소") {
    return PROCESSING_ROLES_POWER;
  }
  if (facilityArea === "역무실") {
    return PROCESSING_ROLES_LIGHTING;
  }
  return PROCESSING_ROLES;
}

export function isProcessingRoleAllowedForFacility(
  role: string,
  facilityArea: string
): boolean {
  const trimmed = role.trim();
  if (!trimmed) return false;
  return getProcessingRolesForFacility(facilityArea).includes(trimmed);
}

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
