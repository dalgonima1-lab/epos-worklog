import metroData from "@/data/seoul-metro-1-9.json";

export function normalizeStationName(name: string): string {
  return name.trim().replace(/\s+/g, "");
}

export interface MetroLineInfo {
  line: number;
  label: string;
  color: string;
  stationCount: number;
}

export interface MetroStationInfo {
  name: string;
  areas: string[];
}

const LINES = metroData.lines as Array<{
  line: number;
  label: string;
  color: string;
  stationCount: number;
  stations: MetroStationInfo[];
}>;

export function getMetroLines(): MetroLineInfo[] {
  return LINES.map(({ line, label, color, stationCount }) => ({
    line,
    label,
    color,
    stationCount,
  }));
}

const LINE_COLOR_MAP = new Map(
  LINES.map((l) => [l.line, l.color] as const)
);

/** 서울교통공사 호선 공식 색 (테두리·강조용) */
export function getMetroLineColor(line: number): string {
  return LINE_COLOR_MAP.get(line) ?? "#64748b";
}

export function getMetroStationsForLine(line: number): MetroStationInfo[] {
  const row = LINES.find((l) => l.line === line);
  return row?.stations ?? [];
}

/** DB·화면에 저장할 표기 (예: `2호선 강남역`) */
export function canonicalStationDisplayName(raw: string): string {
  const t = raw.trim().replace(/\s+/g, " ");
  if (!t) return "";
  const parsed = parseMetroStationValue(t);
  if (parsed.line != null && parsed.stationName) {
    return formatMetroStationValue(parsed.line, parsed.stationName);
  }
  return t;
}

/** 저장·표시용: `2호선 강남역` */
export function formatMetroStationValue(
  line: number,
  stationName: string
): string {
  const name = stationName.trim();
  if (!name) return "";
  return `${line}호선 ${name}`;
}

export function parseMetroStationValue(value: string): {
  line: number | null;
  stationName: string;
} {
  const trimmed = value.trim();
  const m = trimmed.match(/^(\d)호선\s+(.+)$/);
  if (m) {
    return { line: Number(m[1]), stationName: m[2].trim() };
  }
  return { line: null, stationName: trimmed };
}

/** 역사 히스토리·일일기록 매칭용 동등 키 */
export function stationMatchKeys(displayName: string): string[] {
  const keys = new Set<string>();
  const full = normalizeStationName(displayName).toLowerCase();
  if (full) keys.add(full);

  const { line, stationName } = parseMetroStationValue(displayName);
  const stationOnly = normalizeStationName(stationName).toLowerCase();
  if (stationOnly) keys.add(stationOnly);

  if (line != null && stationOnly) {
    keys.add(normalizeStationName(formatMetroStationValue(line, stationName)).toLowerCase());
  }

  return [...keys];
}

export function stationsMatch(a: string, b: string): boolean {
  const ka = stationMatchKeys(a);
  const kb = stationMatchKeys(b);
  return ka.some((x) => kb.includes(x));
}

/** 서울 1~9호선 전체 역 (DB 카탈로그용) */
export function buildMetroStationCatalogNames(): string[] {
  const names: string[] = [];
  for (const line of LINES) {
    for (const s of line.stations) {
      names.push(formatMetroStationValue(line.line, s.name));
    }
  }
  return names.sort((a, b) => {
    const pa = parseMetroStationValue(a);
    const pb = parseMetroStationValue(b);
    if (pa.line !== pb.line) return (pa.line ?? 0) - (pb.line ?? 0);
    return a.localeCompare(b, "ko");
  });
}

export function filterMetroStations(
  line: number,
  query: string
): MetroStationInfo[] {
  const q = query.trim().toLowerCase().replace(/\s+/g, "");
  const list = getMetroStationsForLine(line);
  if (!q) return list;
  return list.filter((s) => {
    const n = s.name.toLowerCase().replace(/\s+/g, "");
    return n.includes(q);
  });
}
