import productData from "@/data/epos-product-stations.json";
import { normalizeStationName } from "@/lib/metroStations";

export interface ManagementOffice {
  id: string;
  shortLabel: string;
  label: string;
}

export interface StationOfficeLink {
  line: number;
  stationName: string;
  officeId: string;
  officeShortLabel: string;
}

const OFFICES = (productData.offices ?? []) as ManagementOffice[];
const STATION_OFFICES = (productData.stationOffices ??
  []) as StationOfficeLink[];

const officeById = new Map(OFFICES.map((o) => [o.id, o]));
const officeByShort = new Map(OFFICES.map((o) => [o.shortLabel, o]));

const officeByLineStation = new Map<string, StationOfficeLink>();
for (const row of STATION_OFFICES) {
  const key = `${row.line}|${normalizeStationName(row.stationName)}`;
  officeByLineStation.set(key, row);
}

export function getManagementOffices(): ManagementOffice[] {
  return OFFICES;
}

export function getStationOfficeShortLabel(
  line: number,
  stationName: string
): string | null {
  const key = `${line}|${normalizeStationName(stationName)}`;
  return officeByLineStation.get(key)?.officeShortLabel ?? null;
}

export function getStationOfficeLabel(
  line: number,
  stationName: string
): string | null {
  const short = getStationOfficeShortLabel(line, stationName);
  if (!short) return null;
  return officeByShort.get(short)?.label ?? `${short} 전기관리소`;
}

export function formatStationNameWithOffice(
  line: number,
  stationName: string
): string {
  const office = getStationOfficeShortLabel(line, stationName);
  if (!office) return stationName;
  return `${stationName} (${office})`;
}

export function getStationsForOffice(officeIdOrShort: string): Set<string> {
  const keys = new Set<string>();
  const office =
    officeById.get(officeIdOrShort) ?? officeByShort.get(officeIdOrShort);
  if (!office) return keys;

  for (const row of STATION_OFFICES) {
    if (row.officeId === office.id || row.officeShortLabel === office.shortLabel) {
      keys.add(`${row.line}|${normalizeStationName(row.stationName)}`);
    }
  }
  return keys;
}

export function resolveManagementOffice(
  value: string
): ManagementOffice | null {
  const t = value.trim();
  if (!t) return null;
  return officeById.get(t) ?? officeByShort.get(t) ?? null;
}
