import { PROCESSING_ROLES } from "@/lib/constants";
import { resolveManagementOffice } from "@/lib/eposStationOffices";

/** 역사 내 설비 작업 장소 */
export const STATION_FACILITY_AREAS = ["전기실", "변전소", "역무실"] as const;

/** 유지보수 용역 시 관리소 단위 작업 장소 */
export const MANAGEMENT_OFFICE_FACILITY = "관리소" as const;

/** 사무실 내 역사·공종별 작업 */
export const OFFICE_WORK_FACILITY = "사무" as const;

export type StationFacilityArea = (typeof STATION_FACILITY_AREAS)[number];

export type WorkFacilityArea =
  | StationFacilityArea
  | typeof MANAGEMENT_OFFICE_FACILITY
  | typeof OFFICE_WORK_FACILITY;

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
  if (facilityArea === OFFICE_WORK_FACILITY) {
    return PROCESSING_ROLES;
  }
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

/** 여러 역·여러 작업 장소일 때 공통으로 선택 가능한 공종 */
export function getProcessingRolesForFacilities(
  facilityAreas: string[]
): readonly string[] {
  const valid = facilityAreas.map((f) => f.trim()).filter(Boolean);
  if (!valid.length) return PROCESSING_ROLES;
  let roles = [...getProcessingRolesForFacility(valid[0])];
  for (let i = 1; i < valid.length; i++) {
    const next = getProcessingRolesForFacility(valid[i]);
    roles = roles.filter((r) => next.includes(r));
  }
  return roles;
}

export function isProcessingRoleAllowedForFacilities(
  role: string,
  facilityAreas: string[]
): boolean {
  const trimmed = role.trim();
  if (!trimmed) return false;
  const valid = facilityAreas.map((f) => f.trim()).filter(isWorkFacilityArea);
  if (!valid.length) return false;
  return valid.every((f) => isProcessingRoleAllowedForFacility(trimmed, f));
}

export function isStationFacilityArea(
  value: string
): value is StationFacilityArea {
  return (STATION_FACILITY_AREAS as readonly string[]).includes(value);
}

/** primary + additionalFacilityAreas를 중복 없이 배열로 */
export function parseStationFacilityAreas(
  primary?: string,
  additional?: string[]
): StationFacilityArea[] {
  const out: StationFacilityArea[] = [];
  for (const raw of [primary, ...(additional ?? [])]) {
    const area = raw?.trim() ?? "";
    if (isStationFacilityArea(area) && !out.includes(area)) {
      out.push(area);
    }
  }
  return out;
}

export function formatStationFacilityAreasLabel(
  areas: readonly StationFacilityArea[]
): string {
  return areas.join(" · ");
}

export function isWorkFacilityArea(value: string): value is WorkFacilityArea {
  return (
    isStationFacilityArea(value) ||
    value === MANAGEMENT_OFFICE_FACILITY ||
    value === OFFICE_WORK_FACILITY
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
  if (area === "연차" || area === "공휴일") {
    return area;
  }
  if (area === OFFICE_WORK_FACILITY) {
    return `${station} · 사무`;
  }
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
