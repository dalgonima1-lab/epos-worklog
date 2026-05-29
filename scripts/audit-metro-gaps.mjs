/**
 * 빌드된 seoul-metro-1-9.json 필수 역 누락 검사
 * node scripts/audit-metro-gaps.mjs
 */
import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const builtPath = path.join(root, "src", "data", "seoul-metro-1-9.json");

function ensureSuffix(name) {
  const t = String(name ?? "").trim().replace(/\s+/g, "");
  if (!t) return "";
  return t.endsWith("역") ? t : `${t}역`;
}

const MUST = {
  1: ["서울역", "청량리", "종로3가", "종로5가", "동대문", "신도림", "인천"],
  2: [
    "시청",
    "을지로입구",
    "강남",
    "역삼",
    "잠실",
    "건대입구",
    "홍대입구",
    "당산",
    "사당",
    "영등포구청",
    "신도림",
    "교대",
  ],
  3: ["대화", "오금", "경복궁", "종로3가", "고속터미널", "양재", "수서", "경마공원"],
  4: [
    "불암산",
    "노원",
    "혜화",
    "명동",
    "서울역",
    "삼각지",
    "총신대입구",
    "이수",
    "사당",
    "남태령",
    "오이도",
  ],
  5: ["방화", "김포공항", "강동", "마천", "하남검단산"],
  6: [
    "응암",
    "봉화산",
    "신내",
    "돌곶이",
    "삼각지",
    "청계산입구",
    "신금호",
    "행당",
    "왕십리",
    "응봉",
    "금호",
  ],
  7: ["장암", "노원", "사가정", "건대입구", "뚝섬유원지", "강남구청", "총신대입구", "광명"],
  8: ["암사", "잠실", "가락시장", "모란"],
  9: ["김포공항", "당산", "동작", "고속터미널", "종합운동장", "올림픽공원", "중앙보훈병원"],
};

const built = JSON.parse(readFileSync(builtPath, "utf-8"));
const byLine = new Map();
for (const row of built.lines) {
  byLine.set(
    row.line,
    new Set(row.stations.map((s) => ensureSuffix(s.name)))
  );
}

let anyMissing = false;
for (const [lineStr, names] of Object.entries(MUST)) {
  const line = Number(lineStr);
  const have = byLine.get(line);
  const missing = [];
  for (const rawName of names) {
    const name = ensureSuffix(rawName);
    if (!have.has(name)) missing.push(name);
  }
  if (missing.length) {
    anyMissing = true;
    console.log(`\n${line}호선 누락 (${missing.length}):`);
    console.log(missing.join(", "));
  }
}

if (!anyMissing) {
  console.log(`✓ ${builtPath}`);
  console.log("필수 역 모두 빌드 결과에 포함됨");
}
process.exit(anyMissing ? 1 : 0);
