import XLSX from "xlsx";
import fs from "fs";
import path from "path";

const DAY_MAP = {
  월: 0,
  화: 1,
  수: 2,
  목: 3,
  금: 4,
  토: 5,
  일: 6,
};

const MEMBER_BY_NAME = [
  { keys: ["노희찬"], id: "m1" },
  { keys: ["이준명"], id: "m2" },
  { keys: ["유영준"], id: "m3" },
];

function cellStr(v) {
  if (v == null) return "";
  return String(v).replace(/\r\n/g, "\n").trim();
}

function parseDateRange(text) {
  const m = text.match(
    /(\d{4})\s*년?\s*(\d{1,2})\s*월?\s*(\d{1,2})\s*일?\s*[~\-]\s*(\d{4})?\s*년?\s*(\d{1,2})\s*월?\s*(\d{1,2})\s*일?/
  );
  if (!m) return null;
  const y1 = Number(m[1]);
  const mo1 = Number(m[2]);
  const d1 = Number(m[3]);
  const y2 = m[4] ? Number(m[4]) : y1;
  const mo2 = Number(m[5]);
  const d2 = Number(m[6]);
  const start = new Date(y1, mo1 - 1, d1);
  const end = new Date(y2, mo2 - 1, d2);
  return { start, end, startIso: fmt(start), endIso: fmt(end) };
}

function fmt(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDays(iso, n) {
  const d = new Date(iso + "T12:00:00");
  d.setDate(d.getDate() + n);
  return fmt(d);
}

function resolveMemberId(reporter) {
  const t = reporter.replace(/\s/g, "");
  for (const m of MEMBER_BY_NAME) {
    if (m.keys.some((k) => t.includes(k.replace(/\s/g, "")))) return m.id;
  }
  return null;
}

function mapProcessingRole(workType) {
  const t = workType.replace(/\s/g, "");
  if (/전력감시/.test(t)) return "전력감시시스템";
  if (/조명제어|조명/.test(t)) return "조명제어시스템";
  if (/유지보수/.test(t)) return "유지보수 용역";
  if (/A\/S|AS/i.test(t)) return "A/S";
  return "조명제어시스템";
}

function extractStation(workType, content) {
  const bracket = content.match(/\[([^\]]+)\]/) || workType.match(/\[([^\]]+)\]/);
  if (bracket) {
    const name = bracket[1].trim();
    if (name !== "주간") return name;
  }
  const stations = (content + "\n" + workType).match(/([가-힣0-9]+역)/g);
  if (stations?.length) return [...new Set(stations)].slice(0, 2).join(", ");
  const station = (content + workType).match(
    /([가-힣A-Za-z0-9]+역)/
  );
  if (station) return station[1];
  const line = content.split("\n").find((l) => /역|현장|관리소/.test(l));
  if (line) {
    const s = line.match(/([가-힣0-9]+(?:역|관리소))/);
    if (s) return s[1];
  }
  const first = workType.split("\n")[0].replace(/[\[\]]/g, "").trim();
  if (first && first.length < 30) return first.slice(0, 20);
  return "현장";
}

function splitSections(content) {
  let done = content;
  let deficiencies = "";
  let issues = "";
  const defM = done.match(/미비\s*사항\s*[:：]([\s\S]*?)(?=특이\s*사항|$)/i);
  if (defM) {
    deficiencies = defM[1].trim();
    done = done.replace(defM[0], "").trim();
  }
  const issM = done.match(/특이\s*사항\s*[:：]([\s\S]*?)$/i);
  if (issM) {
    issues = issM[1].trim();
    done = done.replace(issM[0], "").trim();
  }
  return { done: done.trim(), deficiencies, issues };
}

function findReporterRow(rows) {
  for (let i = 0; i < Math.min(10, rows.length); i++) {
    const line = rows[i].map(cellStr).join("|");
    if (/보고자/.test(line)) {
      for (let c = rows[i].length - 1; c >= 0; c--) {
        const v = cellStr(rows[i][c]);
        if (v && !/보고자/.test(v) && v.length <= 12) return { row: i, reporter: v };
      }
    }
  }
  return { row: -1, reporter: "" };
}

function findDateRow(rows) {
  for (let i = 0; i < Math.min(10, rows.length); i++) {
    const joined = rows[i].map(cellStr).join(" ");
    if (/\d{4}.*\d{1,2}.*\d{1,2}.*~/.test(joined) || /2026/.test(joined)) {
      const range = parseDateRange(joined);
      if (range) return range;
    }
  }
  return null;
}

function pushDayEntry(entries, r, weekStart, memberId) {
  const dayCell = r.find((c) => DAY_MAP[c] !== undefined);
  if (!dayCell || DAY_MAP[dayCell] === undefined) return false;

  const dayOffset = DAY_MAP[dayCell];
  const date = addDays(weekStart, dayOffset);
  const nonDay = r.filter((c) => c && c !== dayCell && !/금주|실적|업무요약/.test(c));
  let workType = "";
  let content = "";
  if (nonDay.length >= 2) {
    workType = nonDay[0];
    content = nonDay.slice(1).join("\n");
  } else if (nonDay.length === 1) {
    content = nonDay[0];
    workType = content.split("\n")[0] || "조명제어시스템";
  }
  if (!content && !workType) return false;

  const { done, deficiencies, issues } = splitSections(content);
  entries.push({
    memberId,
    date,
    stationName: extractStation(workType, content || workType),
    processingRole: mapProcessingRole(workType),
    done: done || content,
    plan: "",
    issues,
    deficiencies,
    workType,
  });
  return true;
}

function parseStandardSheet(rows, memberId, weekStart) {
  const entries = [];
  let nextWeekPlan = "";
  let section = "";

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i].map(cellStr);
    const joined = r.join("|");

    if (/다음\s*주|차주/.test(joined) && /계획/.test(joined)) {
      section = "plan";
      nextWeekPlan = r.slice(2).filter(Boolean).join("\n");
      continue;
    }
    if (/금주/.test(joined) && /실적|업무/.test(joined)) {
      section = "work";
      pushDayEntry(entries, r, weekStart, memberId);
      continue;
    }

    const dayCell = r.find((c) => DAY_MAP[c] !== undefined);
    if (section === "work" && dayCell && DAY_MAP[dayCell] !== undefined) {
      pushDayEntry(entries, r, weekStart, memberId);
    }
  }

  if (nextWeekPlan && entries.length) {
    const fri = entries.find((e) => e.date.endsWith("-22")) || entries[entries.length - 1];
    fri.plan = nextWeekPlan;
  }

  return entries;
}

function parseLeejunSheet(rows, memberId, weekStart) {
  const entries = [];
  let nextWeekPlan = "";
  let inWork = false;

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i].map(cellStr);
    const c3 = r[2] || r[1];
    const c4 = r[3] || r[2];
    const c6 = r[5] || r[4] || r[3];

    if (/다음\s*주|차주/.test(r.join("")) && /계획/.test(r.join(""))) {
      nextWeekPlan = r.slice(2).filter(Boolean).join("\n");
      continue;
    }

    if (/금주/.test(r.join("")) && /실적|요약/.test(r.join(""))) {
      inWork = true;
      continue;
    }

    if (inWork && DAY_MAP[c3] !== undefined) {
      const date = addDays(weekStart, DAY_MAP[c3]);
      const workType = c4;
      const content = c6 || c4;
      if (!content) continue;
      const { done, deficiencies, issues } = splitSections(content);
      entries.push({
        memberId,
        date,
        stationName: extractStation(workType, content),
        processingRole: mapProcessingRole(workType),
        done,
        plan: "",
        issues,
        deficiencies,
        workType,
      });
    }
  }

  if (nextWeekPlan && entries.length) {
    entries[entries.length - 1].plan = nextWeekPlan;
  }
  return entries;
}

export function parseWorkbook(filePath) {
  const wb = XLSX.readFile(filePath, { cellDates: true });
  const all = [];

  for (const sn of wb.SheetNames) {
    if (!/양식/.test(sn)) continue;
    if (/예시|양시/.test(sn)) continue;

    const ws = wb.Sheets[sn];
    const rows = XLSX.utils.sheet_to_json(ws, {
      header: 1,
      defval: "",
      raw: false,
    });

    const { reporter } = findReporterRow(rows);
    const memberId = resolveMemberId(reporter);
    if (!memberId) continue;

    const range =
      findDateRow(rows) ||
      parseDateRange("2026년05월18일 ~ 2026년05월22일");
    if (!range) continue;

    const weekStart = range.startIso;
    const isLee =
      memberId === "m2" && rows.some((r) => cellStr(r[2]) === "금주\n업무요약");

    const entries = isLee
      ? parseLeejunSheet(rows, memberId, weekStart)
      : parseStandardSheet(rows, memberId, weekStart);

    all.push({
      file: path.basename(filePath),
      sheet: sn,
      reporter,
      memberId,
      weekStart,
      weekEnd: range.endIso,
      entries,
    });
  }

  return all;
}

if (process.argv[1]?.includes("parse-epos-sheet")) {
  const folder =
    process.argv[2] ||
    "f:\\01. EPOS\\000000. 진행상황 정리\\26년도 5월3째주";
  const files = process.argv[3]
    ? [process.argv[3]]
    : [
        "20260522_유영준_주간업무보고서(EPOS 관리팀).xlsx",
        "주간업무보고_05월3주차_이준명.xlsx",
        "주간업무보고서(EPOS 관리팀)2026년5월18일 ~ 2026년5월22일.xlsx",
      ].map((f) => path.join(folder, f));

  const out = [];
  for (const fp of files) {
    if (!fs.existsSync(fp)) {
      console.error("Missing:", fp);
      continue;
    }
    out.push(...parseWorkbook(fp));
  }
  fs.writeFileSync(
    path.join(process.cwd(), "scripts", "parsed-week.json"),
    JSON.stringify(out, null, 2),
    "utf8"
  );
  console.log(JSON.stringify(out, null, 2));
}
