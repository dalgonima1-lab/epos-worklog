import type { DailyReport, StationRecord } from "./types";
import {
  buildMetroStationCatalogNames,
  canonicalStationDisplayName,
  formatMetroStationValue,
  normalizeStationName,
  parseMetroStationValue,
} from "./metroStations";

function sortStations(records: StationRecord[]): StationRecord[] {
  return [...records].sort((a, b) => {
    const t = b.lastUsedAt.localeCompare(a.lastUsedAt);
    if (t !== 0) return t;
    return b.useCount - a.useCount;
  });
}

export const STATION_CATALOG_VERSION = 2;

/** 쉼표·슬래시 등으로 여러 역이 한 줄에 적힌 경우 */
export function isBundledStationName(name: string): boolean {
  const t = name.trim();
  if (!t) return true;
  if (/[,，、/·]/.test(t)) return true;
  if (/\s+및\s+/.test(t)) return true;
  const 역Count = (t.match(/역/g) || []).length;
  if (역Count > 1 && !/^\d호선\s+.+역$/.test(t.replace(/\s+/g, ""))) {
    return true;
  }
  return false;
}

/** 묶인 역사명에서 대표 1곳만 추출 (일일기록 정리용) */
export function extractPrimaryStationName(raw: string): string {
  const t = raw.trim();
  if (!t) return "";
  if (!isBundledStationName(t)) {
    return canonicalStationDisplayName(t);
  }

  const parts = t
    .split(/[,，、/·]+|\s+및\s+/)
    .map((p) => p.trim())
    .filter(Boolean);

  const with역 = parts.find((p) => p.endsWith("역"));
  if (with역) {
    return canonicalStationDisplayName(with역);
  }

  const first = parts[0] ?? t;
  const withSuffix = first.endsWith("역") ? first : `${first}역`;
  return canonicalStationDisplayName(withSuffix);
}

function catalogIndex(
  catalog: Map<string, StationRecord>,
  displayName: string
): string | null {
  const canonical = canonicalStationDisplayName(displayName);
  const norm = normalizeStationName(canonical).toLowerCase();
  if (catalog.has(norm)) return norm;

  const { line, stationName } = parseMetroStationValue(canonical);
  if (line != null && stationName) {
    const formatted = formatMetroStationValue(line, stationName);
    const fn = normalizeStationName(formatted).toLowerCase();
    if (catalog.has(fn)) return fn;
  }

  const stationOnly = normalizeStationName(stationName || canonical).toLowerCase();
  for (const [key, rec] of catalog) {
    const parsed = parseMetroStationValue(rec.name);
    if (
      normalizeStationName(parsed.stationName || rec.name).toLowerCase() ===
      stationOnly
    ) {
      return key;
    }
  }

  return null;
}

function touchUsage(
  catalog: Map<string, StationRecord>,
  displayName: string,
  at: string
) {
  const key = catalogIndex(catalog, displayName);
  if (!key) return;
  const rec = catalog.get(key)!;
  rec.useCount += 1;
  if (at > rec.lastUsedAt) rec.lastUsedAt = at;
}

/** 1~9호선 전체 역 + 기존 일일기록 사용 이력 반영 */
export function buildMetroStationCatalog(
  reports: DailyReport[] = [],
  _previous: StationRecord[] = []
): StationRecord[] {
  const baseTime = new Date(0).toISOString();
  const catalog = new Map<string, StationRecord>();

  for (const name of buildMetroStationCatalogNames()) {
    const canonical = canonicalStationDisplayName(name);
    const key = normalizeStationName(canonical).toLowerCase();
    catalog.set(key, {
      name: canonical,
      lastUsedAt: baseTime,
      useCount: 0,
    });
  }

  for (const r of reports) {
    const raw = r.stationName?.trim();
    if (!raw || isBundledStationName(raw)) continue;
    const canonical = canonicalStationDisplayName(raw);
    touchUsage(catalog, canonical, r.updatedAt || r.date || baseTime);
  }

  return sortStations([...catalog.values()]);
}

export function sanitizeReportStationNames(reports: DailyReport[]): number {
  let changed = 0;
  for (const r of reports) {
    const raw = r.stationName?.trim();
    if (!raw || !isBundledStationName(raw)) continue;
    const fixed = extractPrimaryStationName(raw);
    if (fixed && fixed !== r.stationName) {
      r.stationName = fixed;
      changed += 1;
    }
  }
  return changed;
}
