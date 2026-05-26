import { resolveManagementOffice } from "@/lib/eposStationOffices";
import {
  getEposProductFacilities,
  getEposProductForDisplayName,
} from "@/lib/eposProductStations";
import { parseMetroStationValue } from "@/lib/metroStations";

/** 일정 제목용: `수서관리소` */
export function getMaintenanceOfficeScheduleLabel(officeId: string): string {
  const office = resolveManagementOffice(officeId);
  if (!office) return officeId.trim();
  return `${office.shortLabel}관리소`;
}

/** 역사별 `강남역 전기실` 형태 */
export function formatStationFacilitySegment(display: string): string {
  const trimmed = display.trim();
  if (!trimmed) return "";
  const { line, stationName } = parseMetroStationValue(trimmed);
  const name = (stationName || trimmed.replace(/^\d+호선\s+/, "")).trim();
  const facilities =
    line != null && stationName
      ? getEposProductFacilities(line, stationName)
      : getEposProductForDisplayName(trimmed).facilities;

  if (facilities.length === 1) return `${name} ${facilities[0]}`;
  if (facilities.length > 1) return `${name} ${facilities.join("·")}`;
  return name;
}

/**
 * 유지보수 용역 일정 제목 (역별 일정 대신 1건)
 * 예: `수서관리소 산하 강남역 전기실, 역삼역 변전소 - 정기점검`
 */
export function buildMaintenanceScheduleTitle(
  officeId: string,
  stationDisplays: string[],
  workContent: string
): string {
  const officeLabel = getMaintenanceOfficeScheduleLabel(officeId);
  const segments = stationDisplays
    .map(formatStationFacilitySegment)
    .filter(Boolean);
  const work = workContent.trim() || "정기점검";
  if (!segments.length) return `${officeLabel} 산하 - ${work}`;
  return `${officeLabel} 산하 ${segments.join(", ")} - ${work}`;
}

/** URL·API용 역 목록 직렬화 */
export function encodeMaintenanceStationNames(names: string[]): string {
  return names.map((n) => encodeURIComponent(n.trim())).join("|");
}

export function decodeMaintenanceStationNames(raw: string): string[] {
  if (!raw.trim()) return [];
  return raw
    .split("|")
    .map((s) => {
      try {
        return decodeURIComponent(s.trim());
      } catch {
        return s.trim();
      }
    })
    .filter(Boolean);
}
