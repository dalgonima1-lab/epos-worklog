/**
 * CC0 gist + 보정(supplements) + 노선 순서 → 서울 1~9호선 JSON
 * node scripts/build-seoul-metro-data.mjs
 */
import { readFileSync, writeFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const inputPath = path.join(root, "data", "korean-subway-station-list.json5");
const supplementPath = path.join(root, "data", "seoul-metro-supplements.json");
const orderPath = path.join(root, "data", "seoul-metro-line-order.json");
const outputPath = path.join(root, "src", "data", "seoul-metro-1-9.json");

const LINE_COLORS = {
  1: "#0052A4",
  2: "#00A84D",
  3: "#EF7C1C",
  4: "#00A5DE",
  5: "#996CAC",
  6: "#CD7C2F",
  7: "#747F00",
  8: "#E6186C",
  9: "#BDB092",
};

function parseJson5Array(raw) {
  const noComments = raw.replace(/^\s*\/\/.*$/gm, "");
  const jsonLike = noComments.replace(/'/g, '"').replace(/,\s*([\]}])/g, "$1");
  return JSON.parse(jsonLike);
}

/** 역명 공백·역 접미사 정규화 */
function normalizeStationDisplayName(name) {
  let t = String(name ?? "").trim().replace(/\s+/g, "");
  if (!t) return "";
  if (!t.endsWith("역")) t = `${t}역`;
  return t;
}

function mergeAreas(a, b) {
  const set = new Set([...(a ?? []), ...(b ?? [])]);
  return [...set];
}

function ingestRow(byLine, row) {
  const name = normalizeStationDisplayName(row.name);
  if (!name) return;
  const areas = row.areas ?? [];
  for (const lineLabel of row.lines ?? []) {
    const m = String(lineLabel).match(/^(\d)호선$/);
    if (!m) continue;
    const num = Number(m[1]);
    if (num < 1 || num > 9) continue;
    const map = byLine.get(num);
    const prev = map.get(name);
    if (prev) {
      prev.areas = mergeAreas(prev.areas, areas);
    } else {
      map.set(name, { name, areas: [...areas] });
    }
  }
}

const raw = readFileSync(inputPath, "utf-8");
const all = parseJson5Array(raw);
const supplements = JSON.parse(readFileSync(supplementPath, "utf-8"));
const lineOrderConfig = JSON.parse(readFileSync(orderPath, "utf-8"));

const byLine = new Map();
for (let n = 1; n <= 9; n++) {
  byLine.set(n, new Map());
}

for (const row of all) {
  if (row.city !== "서울" || !Array.isArray(row.lines)) continue;
  ingestRow(byLine, {
    name: row.name,
    lines: row.lines,
    areas: row.areas,
  });
}

for (const row of supplements.stations ?? []) {
  const lines = (row.lines ?? []).map((n) => `${n}호선`);
  ingestRow(byLine, { name: row.name, lines, areas: row.areas });
}

for (const { from, to } of supplements.normalizeNames ?? []) {
  const fromNorm = normalizeStationDisplayName(from);
  const toNorm = normalizeStationDisplayName(to);
  if (!fromNorm || !toNorm || fromNorm === toNorm) continue;
  for (let n = 1; n <= 9; n++) {
    const map = byLine.get(n);
    const prev = map.get(fromNorm);
    if (!prev) continue;
    map.delete(fromNorm);
    const existing = map.get(toNorm);
    if (existing) {
      existing.areas = mergeAreas(existing.areas, prev.areas);
    } else {
      map.set(toNorm, { name: toNorm, areas: prev.areas });
    }
  }
}

function sortStationsForLine(lineNum, stationMap) {
  const orderList = (lineOrderConfig[String(lineNum)] ?? []).map(
    normalizeStationDisplayName
  );
  const orderIndex = new Map(orderList.map((name, i) => [name, i]));
  const stations = [...stationMap.values()];
  stations.sort((a, b) => {
    const ia = orderIndex.get(a.name);
    const ib = orderIndex.get(b.name);
    if (ia != null && ib != null) return ia - ib;
    if (ia != null) return -1;
    if (ib != null) return 1;
    return a.name.localeCompare(b.name, "ko");
  });
  return stations;
}

const lines = [];
for (let n = 1; n <= 9; n++) {
  const stations = sortStationsForLine(n, byLine.get(n));
  lines.push({
    line: n,
    label: `${n}호선`,
    color: LINE_COLORS[n],
    stationCount: stations.length,
    stations,
  });
}

const out = {
  source: [
    "nemorize/korean-subway-station-list (CC0-1.0)",
    "data/seoul-metro-supplements.json",
    "data/seoul-metro-line-order.json",
  ],
  generatedAt: new Date().toISOString().slice(0, 10),
  lines,
};

writeFileSync(outputPath, JSON.stringify(out, null, 2), "utf-8");
console.log(`✓ ${outputPath}`);
for (const l of lines) {
  const orderN = (lineOrderConfig[String(l.line)] ?? []).length;
  console.log(`  ${l.label}: ${l.stationCount}개 역 (순서표 ${orderN}개)`);
}

const must4 = ["남태령역", "사당역", "불암산역"];
const l4 = lines.find((l) => l.line === 4);
const missing = must4.filter(
  (n) => !l4.stations.some((s) => s.name === n)
);
if (missing.length) {
  console.error("4호선 필수 역 누락:", missing.join(", "));
  process.exit(1);
}
