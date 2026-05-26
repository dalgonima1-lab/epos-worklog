import type { StationRecord } from "./types";
import {
  buildMetroStationCatalog,
  isBundledStationName,
} from "./stationCatalog";
import {
  canonicalStationDisplayName,
  normalizeStationName,
} from "./metroStations";

export { canonicalStationDisplayName, normalizeStationName } from "./metroStations";

export function sortStations(records: StationRecord[]): StationRecord[] {
  return [...records].sort((a, b) => {
    const t = b.lastUsedAt.localeCompare(a.lastUsedAt);
    if (t !== 0) return t;
    return b.useCount - a.useCount;
  });
}

export function registerStationInHistory(
  history: StationRecord[],
  rawName: string
): StationRecord[] {
  if (isBundledStationName(rawName)) return history;
  const name = canonicalStationDisplayName(rawName);
  if (!name) return history;

  const now = new Date().toISOString();
  const norm = normalizeStationName(name).toLowerCase();
  const idx = history.findIndex(
    (s) => normalizeStationName(s.name).toLowerCase() === norm
  );

  if (idx >= 0) {
    const updated = { ...history[idx], name };
    updated.lastUsedAt = now;
    updated.useCount += 1;
    const rest = history.filter((_, i) => i !== idx);
    return sortStations([updated, ...rest]);
  }

  return sortStations([{ name, lastUsedAt: now, useCount: 1 }, ...history]);
}

export function seedStationHistory(): StationRecord[] {
  return buildMetroStationCatalog();
}
