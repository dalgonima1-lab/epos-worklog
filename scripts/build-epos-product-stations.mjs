/**
 * EPOS 제품 설치 역 목록 JSON 생성
 * 기본: F:\01. EPOS\서울교통공사 기능실 관리소 현황-2025.xlsx
 *
 * node scripts/build-epos-product-stations.mjs [파일.xlsx ...]
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import XLSX from "xlsx";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "../src/data/epos-product-stations.json");
const METRO_PATH = path.join(__dirname, "../src/data/seoul-metro-1-9.json");

const DEFAULT_FILE =
  "f:/01. EPOS/서울교통공사 기능실 관리소 현황-2025.xlsx";

const DEFAULT_MAINTENANCE_FILE =
  "f:/01. EPOS/00. 25년도 EPOS/0001. 전력감시 용역(유지보수)/00_착수계/02_정기점검계획/정기점검계획서.xlsx";

/** 정기점검계획서·엑셀 관리소명 → 표준 id */
const OFFICE_ID_ALIASES = {
  종합운동: "종합운동장",
  /** 계획서 표기 `동대문(4) 전기관리소` — 동대문2(4호선), plain 동대문 없음 */
  동대문: "동대문2",
  동대문4: "동대문2",
};

const OFFICE_WITH_LINE_RE = /^(.+?)\((\d+)\)\s*전기관리소\s*$/;
const STATION_ROW_RE =
  /^(.+?)\s+(전기실|변전소|역무실|차량기지|기지(?:\s*전기실)?)\s*$/;

const FACILITY_ORDER = ["전기실", "변전소", "역무실"];

const metroData = JSON.parse(fs.readFileSync(METRO_PATH, "utf8"));

/** @type {Map<string, Array<{ line: number, name: string }>>} */
const metroByNorm = new Map();

for (const lineRow of metroData.lines) {
  for (const s of lineRow.stations) {
    const norm = normKey(s.name);
    const list = metroByNorm.get(norm) ?? [];
    list.push({ line: lineRow.line, name: s.name });
    metroByNorm.set(norm, list);
  }
}

function normKey(name) {
  return String(name)
    .trim()
    .replace(/\s+/g, "")
    .replace(/역$/, "")
    .toLowerCase();
}

function normStation(name) {
  let s = String(name ?? "")
    .trim()
    .replace(/\s+/g, "");
  if (!s) return "";
  if (!s.endsWith("역") && !s.includes("관리소")) s += "역";
  return s;
}

function isValidStation(name) {
  if (!name || name.length < 2) return false;
  if (/^\d+$/.test(name.replace(/역$/, ""))) return false;
  if (/^(오토베이스|관리소명|기능실|X)$/i.test(name)) return false;
  return /[가-힣]/.test(name);
}

function parseLineHint(text) {
  const m = String(text).match(/(\d)\s*호선/);
  return m ? Number(m[1]) : null;
}

function findMetroMatch(stationRaw, lineHint) {
  const norm = normKey(stationRaw);
  let candidates = metroByNorm.get(norm);

  if (!candidates?.length) {
    for (const [k, list] of metroByNorm) {
      if (k.startsWith(norm) || norm.startsWith(k)) {
        candidates = list;
        break;
      }
    }
  }

  if (!candidates?.length) return null;

  if (lineHint != null) {
    const onLine = candidates.filter((c) => c.line === lineHint);
    if (onLine.length === 1) return onLine[0];
    if (onLine.length > 1) return onLine[0];
  }

  if (candidates.length === 1) return candidates[0];
  if (lineHint == null && candidates.length > 1) return candidates[0];
  return candidates[0];
}

function parseSingleFacilityLine(line) {
  const raw = String(line).trim();
  if (!raw) return null;
  if (/^오토베이스$/i.test(raw)) return null;
  if (/SJExcute|모니터링|게이트|넷마스크|Nport/i.test(raw)) return null;

  const t = raw.replace(/\s+/g, "");
  const facilities = new Set();

  if (/변전소/.test(t)) facilities.add("변전소");
  if (/전기실/.test(t)) facilities.add("전기실");
  if (/조명제어|조명\/?/.test(t)) facilities.add("역무실");

  if (!facilities.size) return null;

  let station = t
    .replace(/전기실|변전소|조명제어/g, "")
    .replace(/조명\/?\d*/g, "")
    .replace(/\(\d{4}.*?\)/g, "")
    .replace(/\d{4}년?/g, "")
    .replace(/\d+호선/g, "")
    .replace(/지선층|별관|차량기지/g, "");

  station = station.replace(/변전소$/, "");

  const lineHint = parseLineHint(t);

  return { station, facilities: [...facilities], lineHint };
}

function parseFacilityCell(text) {
  const lines = String(text)
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);

  const parsed = [];
  for (const line of lines) {
    const row = parseSingleFacilityLine(line);
    if (row) parsed.push(row);
  }

  if (!parsed.length) {
    const one = parseSingleFacilityLine(String(text).replace(/\r?\n/g, " "));
    if (one) parsed.push(one);
  }

  return parsed;
}

function isLightingColumnYes(value) {
  const v = String(value ?? "").trim().toUpperCase();
  return v === "O" || v === "○" || v === "Y" || v === "YES";
}

function findFacilityHeader(rows) {
  for (let i = 0; i < Math.min(25, rows.length); i++) {
    const cells = rows[i].map((c) => String(c ?? "").trim());
    const facilityCol = cells.findIndex((c) => c === "기능실");
    if (facilityCol < 0) continue;

    const lightingCol = cells.findIndex((c) => c === "조명제어");
    const yearCol = cells.findIndex(
      (c) => c.includes("설치") && c.includes("년도")
    );
    const officeCol = cells.findIndex(
      (c) => c === "관리소 명" || c === "관리소명"
    );

    return { headerIdx: i, facilityCol, lightingCol, yearCol, officeCol };
  }
  return null;
}

/** @type {Map<string, { line: number, stationName: string, facilities: Set<string> }>} */
const byKey = new Map();

/** @type {Map<string, { id: string, shortLabel: string, label: string }>} */
const officesById = new Map();

/** @type {Map<string, { line: number, stationName: string, officeId: string, officeShortLabel: string }>} */
const stationOfficeByKey = new Map();

/** @type {Array<{ officeId: string, line: number, stationName: string, facility: string }>} */
const maintenancePlan = [];

function normalizeMaintenanceFacility(raw) {
  const t = String(raw ?? "").trim();
  if (FACILITY_ORDER.includes(t)) return t;
  if (/역무/.test(t)) return "역무실";
  return null;
}

function addMaintenancePlanEntry(officeShort, lineNum, stationName, facility) {
  const officeId = registerOffice(officeShort, lineNum);
  maintenancePlan.push({
    officeId,
    line: lineNum,
    stationName,
    facility,
  });
  addStationRecord(lineNum, stationName, [facility], false);
  linkStationOffice(lineNum, stationName, officeShort);
}

function parseOfficeHeader(cell) {
  const text = String(cell ?? "").trim();
  if (!text) return null;
  const firstLine = text.split(/\r?\n/)[0]?.trim() ?? "";
  if (!firstLine) return null;
  if (/관리소\s*명|기능실|설치|DB-|metrommi|오토베이스/i.test(firstLine)) {
    return null;
  }
  if (/^\d{4}$/.test(firstLine)) return null;
  const m = firstLine.match(/^([가-힣0-9]+)/);
  return m?.[1] ?? null;
}

function officeIdFromShort(shortLabel) {
  const raw = shortLabel.replace(/\s+/g, "");
  return OFFICE_ID_ALIASES[raw] ?? raw;
}

function registerOffice(shortLabel, lineNum) {
  const id = officeIdFromShort(shortLabel);
  const label =
    lineNum != null
      ? `${id}(${lineNum}) 전기관리소`
      : `${id} 전기관리소`;
  const existing = officesById.get(id);
  if (!existing) {
    officesById.set(id, {
      id,
      shortLabel: id,
      label,
      ...(lineNum != null ? { line: lineNum } : {}),
    });
  } else if (lineNum != null) {
    existing.line = lineNum;
    existing.label = label;
  }
  return id;
}

function linkStationOffice(lineNum, stationName, officeShort) {
  if (!lineNum || !stationName || !officeShort) return;
  const officeId = registerOffice(officeShort, lineNum);
  const office = officesById.get(officeId);
  if (office?.line != null && office.line !== lineNum) return;

  const key = `${lineNum}|${stationName}`;
  stationOfficeByKey.set(key, {
    line: lineNum,
    stationName,
    officeId,
    officeShortLabel: office?.shortLabel ?? officeId,
  });
}

/** plain 동대문·동대문4 제거, 동대문1=2호선·동대문2=4호선 고정 */
function finalizeDongdaemunOffices() {
  for (const row of stationOfficeByKey.values()) {
    if (row.officeId === "동대문" || row.officeId === "동대문4") {
      row.officeId = "동대문2";
      row.officeShortLabel = "동대문2";
    }
  }
  officesById.delete("동대문");
  officesById.delete("동대문4");

  const d1 = officesById.get("동대문1");
  if (d1) {
    d1.line = 2;
    d1.shortLabel = "동대문1";
    d1.label = "동대문1(2) 전기관리소";
  }
  const d2 = officesById.get("동대문2");
  if (d2) {
    d2.line = 4;
    d2.shortLabel = "동대문2";
    d2.label = "동대문2(4) 전기관리소";
  }
}

function inferOfficeLineFromMetro(shortLabel) {
  const norm = normKey(shortLabel);
  if (!norm) return null;
  for (const lineRow of metroData.lines) {
    for (const s of lineRow.stations) {
      const sn = normKey(s.name);
      if (sn === norm) return lineRow.line;
    }
  }
  return null;
}

function filterStationOfficesByOfficeLine() {
  const kept = [];
  for (const row of stationOfficeByKey.values()) {
    const office = officesById.get(row.officeId);
    if (!office) continue;
    let officeLine = office.line ?? null;
    if (officeLine == null) {
      officeLine = inferOfficeLineFromMetro(office.shortLabel);
      if (officeLine != null) {
        office.line = officeLine;
        office.label = `${office.shortLabel}(${officeLine}) 전기관리소`;
      }
    }
    if (officeLine == null || row.line !== officeLine) continue;
    kept.push(row);
  }
  stationOfficeByKey.clear();
  for (const row of kept) {
    stationOfficeByKey.set(`${row.line}|${row.stationName}`, row);
  }
}

function addStationRecord(line, stationName, facilityList, lightingYes) {
  const match = findMetroMatch(stationName, line);
  const lineNum = match?.line ?? line;
  const canonical = normStation(match?.name ?? stationName);

  if (!lineNum || !isValidStation(canonical)) return;

  const key = `${lineNum}|${canonical}`;
  const row = byKey.get(key) ?? {
    line: lineNum,
    stationName: canonical,
    facilities: new Set(),
  };

  for (const f of facilityList) {
    if (FACILITY_ORDER.includes(f)) row.facilities.add(f);
  }
  if (lightingYes) row.facilities.add("역무실");

  if (row.facilities.size === 0) return;
  byKey.set(key, row);
}

function ingestFacilitySheet(rows) {
  const header = findFacilityHeader(rows);
  if (!header) return 0;

  const { headerIdx, facilityCol, lightingCol, officeCol } = header;
  let added = 0;
  let currentOfficeShort = null;

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const r = rows[i];
    if (officeCol >= 0) {
      const officeFromCell = parseOfficeHeader(r[officeCol]);
      if (officeFromCell) currentOfficeShort = officeFromCell;
    }

    const facilityText = String(r[facilityCol] ?? "").trim();
    if (!facilityText) continue;

    const lightingYes =
      lightingCol >= 0 && isLightingColumnYes(r[lightingCol]);

    const parsed = parseFacilityCell(facilityText);
    if (!parsed.length) continue;

    for (const item of parsed) {
      const before = byKey.size;
      addStationRecord(
        item.lineHint,
        item.station,
        item.facilities,
        lightingYes
      );
      if (byKey.size > before) added++;

      const match = findMetroMatch(item.station, item.lineHint);
      const canonical = normStation(match?.name ?? item.station);
      const lineNum = match?.line ?? item.lineHint;
      if (currentOfficeShort && lineNum && canonical) {
        linkStationOffice(lineNum, canonical, currentOfficeShort);
      }
    }

    if (parsed.length && lightingYes) {
      for (const item of parsed) {
        const match = findMetroMatch(item.station, item.lineHint);
        const canonical = normStation(match?.name ?? item.station);
        const lineNum = match?.line ?? item.lineHint;
        if (!lineNum) continue;
        const key = `${lineNum}|${canonical}`;
        const row = byKey.get(key);
        if (row) row.facilities.add("역무실");
      }
    }
  }

  return added;
}

/** 구형 전력감시 시트 (호선·역사명·기능실 열) */
function findLegacyHeader(rows) {
  for (let i = 0; i < Math.min(20, rows.length); i++) {
    const cells = rows[i].map((c) => String(c ?? "").trim());
    const stationIdx = cells.findIndex((c) => c === "역사명");
    const lineIdx = cells.findIndex((c) => c === "호선");
    const facilityIdx = cells.findIndex((c) => c === "기능실");
    if (stationIdx >= 0 && lineIdx >= 0 && facilityIdx >= 0) {
      const lightingIdx = cells.findIndex((c) => c === "조명제어연계");
      return { headerIdx: i, lineIdx, stationIdx, facilityIdx, lightingIdx };
    }
  }
  return null;
}

function ingestLegacySheet(rows) {
  const header = findLegacyHeader(rows);
  if (!header) return 0;

  const { headerIdx, lineIdx, stationIdx, facilityIdx, lightingIdx } = header;
  let added = 0;

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const r = rows[i];
    const line = Number(r[lineIdx]);
    if (!Number.isInteger(line) || line < 1 || line > 9) continue;

    const facility = String(r[facilityIdx] ?? "").trim();
    const lighting = String(r[lightingIdx] ?? "").trim();
    const facilities = [];
    if (facility === "전기실" || facility === "변전소") facilities.push(facility);
    const lightingYes = lighting === "조명제어";

    const before = byKey.size;
    addStationRecord(line, r[stationIdx], facilities, lightingYes);
    if (byKey.size > before) added++;
  }

  return added;
}

/** 유지보수 정기점검계획서 (점검대상 열) */
function ingestMaintenancePlanSheet(rows) {
  let currentOfficeShort = null;
  let currentLine = null;
  let linked = 0;

  for (let i = 0; i < rows.length; i++) {
    const cell = String(rows[i][1] ?? "").trim();
    if (!cell || cell === "점검대상" || cell === "역사명") continue;

    const officeM = cell.match(OFFICE_WITH_LINE_RE);
    if (officeM) {
      currentOfficeShort = officeM[1].trim();
      currentLine = Number(officeM[2]);
      registerOffice(currentOfficeShort, currentLine);
      continue;
    }

    const stationM = cell.match(STATION_ROW_RE);
    if (!stationM || !currentOfficeShort || !currentLine) continue;

    const facility = normalizeMaintenanceFacility(stationM[2]);
    if (!facility) continue;

    let stationRaw = stationM[1].trim();
    stationRaw = stationRaw.replace(/역$/, "") + "역";

    const match = findMetroMatch(stationRaw, currentLine);
    const lineNum = match?.line ?? currentLine;
    const canonical = normStation(match?.name ?? stationRaw);
    if (!lineNum || !isValidStation(canonical)) continue;

    addMaintenancePlanEntry(
      currentOfficeShort,
      lineNum,
      canonical,
      facility
    );
    linked++;
  }

  return linked;
}

function ingestMaintenanceWorkbook(filePath) {
  if (!fs.existsSync(filePath)) {
    console.warn("skip maintenance (not found):", filePath);
    return 0;
  }
  console.log("read maintenance:", filePath);
  const wb = XLSX.readFile(filePath, { cellDates: false });
  const sn = wb.SheetNames[0];
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[sn], {
    header: 1,
    defval: "",
  });
  const n = ingestMaintenancePlanSheet(rows);
  console.log(" ", sn, "(정기점검)", "→", n, "station-office links");
  return n;
}

function ingestWorkbook(filePath) {
  if (!fs.existsSync(filePath)) {
    console.warn("skip (not found):", filePath);
    return;
  }
  if (/정기점검/.test(filePath)) {
    ingestMaintenanceWorkbook(filePath);
    return;
  }
  console.log("read:", filePath);
  const wb = XLSX.readFile(filePath, { cellDates: false });

  for (const sn of wb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[sn], {
      header: 1,
      defval: "",
    });

    if (/^정보/.test(sn)) {
      const n = ingestFacilitySheet(rows);
      console.log(" ", sn, "(기능실)", "→", n);
      continue;
    }

    if (/전력감시/.test(sn)) {
      const n = ingestLegacySheet(rows);
      console.log(" ", sn, "(전력감시)", "→", n);
    }
  }
}

const inputs = process.argv.slice(2).length
  ? process.argv.slice(2)
  : [DEFAULT_MAINTENANCE_FILE, DEFAULT_FILE];

for (const fp of inputs) ingestWorkbook(fp);

finalizeDongdaemunOffices();
filterStationOfficesByOfficeLine();

if (
  !process.argv.slice(2).some((p) => /정기점검/.test(p)) &&
  fs.existsSync(DEFAULT_MAINTENANCE_FILE) &&
  !inputs.includes(DEFAULT_MAINTENANCE_FILE)
) {
  ingestMaintenanceWorkbook(DEFAULT_MAINTENANCE_FILE);
}

const stations = [...byKey.values()]
  .map(({ line, stationName, facilities }) => ({
    line,
    stationName,
    facilities: FACILITY_ORDER.filter((f) => facilities.has(f)),
  }))
  .sort((a, b) => {
    if (a.line !== b.line) return a.line - b.line;
    return a.stationName.localeCompare(b.stationName, "ko");
  });

const offices = [...officesById.values()].sort((a, b) =>
  a.shortLabel.localeCompare(b.shortLabel, "ko")
);
const stationOffices = [...stationOfficeByKey.values()].sort((a, b) => {
  if (a.line !== b.line) return a.line - b.line;
  return a.stationName.localeCompare(b.stationName, "ko");
});

const out = {
  source: inputs,
  generatedAt: new Date().toISOString().slice(0, 10),
  note:
    "정기점검계획서(1차)·기능실 관리소 현황 2025(2차). 조명제어·조명제어연계는 역무실로 매핑.",
  maintenancePlan: maintenancePlan.sort((a, b) => {
    if (a.officeId !== b.officeId) {
      return a.officeId.localeCompare(b.officeId, "ko");
    }
    if (a.line !== b.line) return a.line - b.line;
    const bySt = a.stationName.localeCompare(b.stationName, "ko");
    if (bySt !== 0) return bySt;
    return FACILITY_ORDER.indexOf(a.facility) - FACILITY_ORDER.indexOf(b.facility);
  }),
  stations,
  offices,
  stationOffices,
};

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(out, null, 2), "utf8");
console.log(
  "wrote",
  OUT,
  "stations",
  stations.length,
  "offices",
  offices.length,
  "stationOffices",
  stationOffices.length,
  "maintenancePlan",
  maintenancePlan.length
);
