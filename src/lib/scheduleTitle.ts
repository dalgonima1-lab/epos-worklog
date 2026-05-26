import { parseMetroStationValue } from "@/lib/metroStations";

/** 주간 일정 제목: `2호선-강남역-전기실-작업내용` */
export function buildScheduleTitle(
  stationDisplay: string,
  facilityArea: string,
  workContent: string
): string {
  const station = stationDisplay.trim();
  const facility = facilityArea.trim();
  const work = workContent.trim();
  const { line, stationName } = parseMetroStationValue(station);

  const parts: string[] = [];
  if (line != null) parts.push(`${line}호선`);
  const name = (stationName || station).trim();
  if (name) parts.push(name);
  if (facility) parts.push(facility);
  if (work) parts.push(work);

  return parts.join("-");
}
