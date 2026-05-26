import { resolveManagementOffice } from "@/lib/eposStationOffices";
import { parseMetroStationValue } from "@/lib/metroStations";
import { MANAGEMENT_OFFICE_FACILITY } from "@/lib/stationFacility";

/** 주간 일정 제목: `2호선-강남역-전기실-작업내용` 또는 `2호선-강남역-신답전기관리소-작업내용` */
export function buildScheduleTitle(
  stationDisplay: string,
  facilityArea: string,
  workContent: string,
  managementOffice?: string
): string {
  const station = stationDisplay.trim();
  const facility = facilityArea.trim();
  const work = workContent.trim();
  const { line, stationName } = parseMetroStationValue(station);

  const parts: string[] = [];
  if (line != null) parts.push(`${line}호선`);
  const name = (stationName || station).trim();
  if (name) parts.push(name);

  if (facility === MANAGEMENT_OFFICE_FACILITY) {
    const office = managementOffice
      ? resolveManagementOffice(managementOffice)
      : null;
    const label = office?.label?.replace(/\s+/g, "") ?? managementOffice;
    if (label) parts.push(label);
  } else if (facility) {
    parts.push(facility);
  }

  if (work) parts.push(work);

  return parts.join("-");
}
