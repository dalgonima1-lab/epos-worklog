/**
 * CC0 gist → 서울 1~9호선 역 목록 JSON 생성
 * node scripts/build-seoul-metro-data.mjs
 */
import { readFileSync, writeFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const inputPath = path.join(root, "data", "korean-subway-station-list.json5");
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

function ensureStationSuffix(name) {
  const t = name.trim();
  if (!t) return t;
  return t.endsWith("역") ? t : `${t}역`;
}

const raw = readFileSync(inputPath, "utf-8");
const all = parseJson5Array(raw);

const byLine = new Map();

for (let n = 1; n <= 9; n++) {
  byLine.set(n, new Map());
}

for (const row of all) {
  if (row.city !== "서울" || !Array.isArray(row.lines)) continue;
  const name = ensureStationSuffix(String(row.name ?? "").trim());
  if (!name) continue;

  for (const lineLabel of row.lines) {
    const m = String(lineLabel).match(/^(\d)호선$/);
    if (!m) continue;
    const num = Number(m[1]);
    if (num < 1 || num > 9) continue;
    const map = byLine.get(num);
    if (!map.has(name)) {
      map.set(name, { name, areas: row.areas ?? [] });
    }
  }
}

const lines = [];
for (let n = 1; n <= 9; n++) {
  const stations = [...byLine.get(n).values()].sort((a, b) =>
    a.name.localeCompare(b.name, "ko")
  );
  lines.push({
    line: n,
    label: `${n}호선`,
    color: LINE_COLORS[n],
    stationCount: stations.length,
    stations,
  });
}

const out = {
  source:
    "nemorize/korean-subway-station-list (CC0-1.0) — 서울·1~9호선 필터",
  generatedAt: new Date().toISOString().slice(0, 10),
  lines,
};

writeFileSync(outputPath, JSON.stringify(out, null, 2), "utf-8");
console.log(`✓ ${outputPath}`);
for (const l of lines) {
  console.log(`  ${l.label}: ${l.stationCount}개 역`);
}
