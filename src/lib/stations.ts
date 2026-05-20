import type { StationRecord } from "./types";

export function normalizeStationName(name: string): string {
  return name.trim().replace(/\s+/g, "");
}

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
  const name = normalizeStationName(rawName);
  if (!name) return history;

  const now = new Date().toISOString();
  const idx = history.findIndex(
    (s) => s.name.toLowerCase() === name.toLowerCase()
  );

  if (idx >= 0) {
    const updated = { ...history[idx] };
    updated.lastUsedAt = now;
    updated.useCount += 1;
    const rest = history.filter((_, i) => i !== idx);
    return sortStations([updated, ...rest]);
  }

  return sortStations([
    { name, lastUsedAt: now, useCount: 1 },
    ...history,
  ]);
}

export const SEED_STATIONS = [
  "명동역",
  "회현역",
  "경찰병원역",
  "봉천역",
  "을지로4가역",
  "신대방역",
  "종합운동장역",
  "서울역",
];

export function seedStationHistory(): StationRecord[] {
  const now = new Date().toISOString();
  return SEED_STATIONS.map((name, i) => ({
    name,
    lastUsedAt: new Date(Date.now() - i * 86_400_000).toISOString(),
    useCount: 1,
  }));
}
