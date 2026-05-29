import type { StationRecord } from "./types";
import {
  buildMetroStationCatalog,
  isBundledStationName,
} from "./stationCatalog";
import { isSecurityTestPlaceholder } from "./sanitizeTestData";
import {
  canonicalStationDisplayName,
  normalizeStationName,
} from "./metroStations";
import type { StationFacilityArea } from "./stationFacility";
import { mergeStationFacilityAreas } from "./stationFacilities";

export interface RegisterStationOptions {
  facilities?: StationFacilityArea[];
  custom?: boolean;
}

export { canonicalStationDisplayName, normalizeStationName } from "./metroStations";

export function sortStations(records: StationRecord[]): StationRecord[] {
  return [...records].sort((a, b) => {
    const t = b.lastUsedAt.localeCompare(a.lastUsedAt);
    if (t !== 0) return t;
    return b.useCount - a.useCount;
  });
}

function normalizeRegisterFacilities(
  facilities?: StationFacilityArea[]
): StationFacilityArea[] {
  return mergeStationFacilityAreas(facilities ?? []);
}

export function registerStationInHistory(
  history: StationRecord[],
  rawName: string,
  options?: RegisterStationOptions
): StationRecord[] {
  if (isBundledStationName(rawName) || isSecurityTestPlaceholder(rawName)) {
    return history;
  }
  const name = canonicalStationDisplayName(rawName);
  if (!name) return history;

  const facilities = normalizeRegisterFacilities(options?.facilities);
  const markCustom =
    options?.custom ?? (facilities.length > 0 ? true : undefined);

  const now = new Date().toISOString();
  const norm = normalizeStationName(name).toLowerCase();
  const idx = history.findIndex(
    (s) => normalizeStationName(s.name).toLowerCase() === norm
  );

  if (idx >= 0) {
    const prev = history[idx]!;
    const updated: StationRecord = {
      ...prev,
      name,
      lastUsedAt: now,
      useCount: prev.useCount + 1,
    };
    if (facilities.length) {
      updated.facilities = mergeStationFacilityAreas(
        prev.facilities ?? [],
        facilities
      );
      updated.custom = true;
    } else if (markCustom) {
      updated.custom = true;
    }
    const rest = history.filter((_, i) => i !== idx);
    return sortStations([updated, ...rest]);
  }

  const created: StationRecord = { name, lastUsedAt: now, useCount: 1 };
  if (facilities.length) {
    created.facilities = facilities;
    created.custom = true;
  } else if (markCustom) {
    created.custom = true;
  }
  return sortStations([created, ...history]);
}

export function seedStationHistory(): StationRecord[] {
  return buildMetroStationCatalog();
}
