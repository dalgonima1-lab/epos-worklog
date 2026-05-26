import { PROCESSING_ROLES } from "@/lib/constants";
import { resolveManagementOffice } from "@/lib/eposStationOffices";

/** 역사 내 설비 작업 장소 */
export const STATION_FACILITY_AREAS = ["전기실", "변전소", "역무실"] as const;

/** 유지보수 용역 시 관리소 단위 작업 장소 */
export const MANAGEMENT_OFFICE_FACILITY = "관리소" as const;

export type StationFacilityArea = (typeof STATION_FACILITY_AREAS)[number];

export type WorkFacilityArea =
  | StationFacilityArea
  | typeof MANAGEMENT_OFFICE_FACILITY;

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

/** 관리소(유지보수) 공종 */
export const PROCESSING_ROLES_MAINTENANCE_OFFICE = ["유지보수 용역"] as const;

export function getProcessingRolesForFacility(
  facilityArea: string | undefined
): readonly string[] {
  if (facilityArea === MANAGEMENT_OFFICE_FACILITY) {
    return PROCESSING_ROLES_MAINTENANCE_OFFICE;
  }
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

export function isWorkFacilityArea(value: string): value is WorkFacilityArea {
  return (
    isStationFacilityArea(value) || value === MANAGEMENT_OFFICE_FACILITY
  );
}

export function formatStationVisitLabel(
  stationName: string,
  facilityArea?: string,
  managementOffice?: string
): string {
  const station = stationName.trim();
  const area = facilityArea?.trim();
  if (!station) return area ?? "";
  if (area === MANAGEMENT_OFFICE_FACILITY) {
    const office = managementOffice
      ? resolveManagementOffice(managementOffice)
      : null;
    const label = office?.label ?? managementOffice?.trim();
    return label ? `${station} · ${label}` : `${station} · 관리소`;
  }
  if (!area || !isStationFacilityArea(area)) return station;
  return `${station} · ${area}`;
}
