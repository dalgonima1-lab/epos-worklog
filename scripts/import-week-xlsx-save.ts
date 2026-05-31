/**
 * 주간업무보고서(xlsx) → 로컬 DB + AI 주간 분석 저장
 *
 * npx tsx scripts/import-week-xlsx-save.ts [폴더경로] [시작] [끝]
 * 예: npx tsx scripts/import-week-xlsx-save.ts "f:\01. EPOS\...\26년도 5월3째주" 2026-05-18 2026-05-22
 */
import { config } from "dotenv";
import path from "path";
import { createRequire } from "module";
import { promises as fs } from "fs";
import type { DailyReport, Database } from "../src/lib/types";
import { generateWithGemini } from "../src/lib/gemini";
import { buildWeeklyReportsContext } from "../src/lib/reportContext";
import { buildAnalysisPrompt } from "../src/lib/analysisPrompt";
import { generateAutoWeeklyAnalysis } from "../src/lib/autoWeeklyAnalysis";
import { buildWeeklySummary } from "../src/lib/summary";
import { getCompareWeekForTarget } from "../src/lib/analysisWeekScope";
import { weekKey } from "../src/lib/references";
import { calcWorkMinutes } from "../src/lib/workTime";

config({ path: path.join(process.cwd(), ".env.local") });

/** Firestore 장애 시 로컬 store.json만 사용 */
process.env.FIREBASE_PROJECT_ID = "";
process.env.FIREBASE_CLIENT_EMAIL = "";
process.env.FIREBASE_PRIVATE_KEY = "";

const require = createRequire(import.meta.url);
const { parseWorkbook } = require("./parse-epos-sheet.mjs") as {
  parseWorkbook: (fp: string) => Array<{
    memberId: string;
    weekStart: string;
    weekEnd: string;
    reporter: string;
    entries: Array<{
      memberId: string;
      date: string;
      stationName: string;
      processingRole: string;
      done: string;
      plan: string;
      issues: string;
      deficiencies: string;
    }>;
  }>;
};

const DEFAULT_FOLDER =
  "f:\\01. EPOS\\000000. 진행상황 정리\\26년도 5월3째주";

const XLSX_FILES = [
  "20260522_유영준_주간업무보고서(EPOS 관리팀).xlsx",
  "주간업무보고_05월3주차_이준명.xlsx",
  "주간업무보고서(EPOS 관리팀)2026년5월18일 ~ 2026년5월22일.xlsx",
];

const STORE_PATH = path.join(process.cwd(), "data", "store.json");
const ANALYSIS_DIR = path.join(process.cwd(), "data", "analyses");

async function loadStore(): Promise<Database> {
  const raw = await fs.readFile(STORE_PATH, "utf-8");
  return JSON.parse(raw) as Database;
}

async function saveStore(db: Database): Promise<void> {
  await fs.writeFile(STORE_PATH, JSON.stringify(db, null, 2), "utf-8");
}

function upsertLocalReport(
  db: Database,
  memberId: string,
  date: string,
  payload: {
    stationName: string;
    processingRole: string;
    done: string;
    plan: string;
    issues: string;
    deficiencies: string;
  }
): DailyReport {
  const id = `${memberId}_${date}`;
  const idx = db.reports.findIndex((r) => r.id === id);
  const base: DailyReport = {
    id,
    memberId,
    date,
    stationName: payload.stationName,
    processingRole: payload.processingRole,
    done: payload.done,
    plan: payload.plan,
    issues: payload.issues,
    deficiencies: payload.deficiencies,
    updatedAt: new Date().toISOString(),
  };
  const workMinutes = calcWorkMinutes(base.beforePhotoAt, base.afterPhotoAt);
  const report = { ...base, ...(workMinutes != null ? { workMinutes } : {}) };
  if (idx >= 0) db.reports[idx] = { ...db.reports[idx], ...report };
  else db.reports.push(report);
  return report;
}

async function importFromFolder(folder: string, start: string, end: string) {
  const merged = new Map<string, ReturnType<typeof parseWorkbook>[0]["entries"][0]>();

  for (const name of XLSX_FILES) {
    const fp = path.join(folder, name);
    try {
      await fs.access(fp);
    } catch {
      console.warn(`⚠ 파일 없음: ${name}`);
      continue;
    }
    const blocks = parseWorkbook(fp);
    for (const block of blocks) {
      console.log(`📄 ${block.reporter} (${name}): ${block.entries.length}일`);
      for (const e of block.entries) {
        if (e.date < start || e.date > end) continue;
        merged.set(`${e.memberId}_${e.date}`, e);
      }
    }
  }

  const db = await loadStore();
  for (const e of merged.values()) {
    upsertLocalReport(db, e.memberId, e.date, e);
    console.log(`  ✓ ${e.date} ${e.stationName}`);
  }
  await saveStore(db);
  console.log(`\n총 ${merged.size}건 일일 기록 → data/store.json`);
  return db;
}

async function generateAnalysis(
  db: Database,
  start: string,
  end: string,
  label: string
) {
  const compareWeek = getCompareWeekForTarget(end);
  const compareKey = weekKey(compareWeek.start, compareWeek.end);
  const key = weekKey(start, end);

  let priorText = "";
  try {
    priorText = await fs.readFile(
      path.join(ANALYSIS_DIR, `${compareKey}.md`),
      "utf-8"
    );
  } catch {
    try {
      priorText = await fs.readFile(
        path.join(process.cwd(), "data", "references", `${compareKey}.txt`),
        "utf-8"
      );
    } catch {
      /* no prior */
    }
  }

  const members = db.members.filter((m) => m.role === "member");
  const reports = db.reports.filter(
    (r) => r.date >= start && r.date <= end && r.done?.trim()
  );

  const weeklySummary = buildWeeklySummary(
    db.teamName,
    label,
    start,
    end,
    members,
    reports
  );

  let markdown = "";
  let source: "gemini" | "auto" = "auto";

  if (process.env.GEMINI_API_KEY) {
    try {
      const currentContext = buildWeeklyReportsContext(
        db.teamName,
        label,
        members,
        reports
      );
      const compareReports = db.reports.filter(
        (r) =>
          r.date >= compareWeek.start &&
          r.date <= compareWeek.end &&
          r.done?.trim()
      );
      const compareContext = buildWeeklyReportsContext(
        db.teamName,
        compareWeek.label,
        members,
        compareReports
      );
      const prompt = buildAnalysisPrompt({
        teamName: db.teamName,
        weekTitle: `${db.teamName} 업무 분석 및 제언 보고서`,
        currentWeekLabel: label,
        previousWeekLabel: compareWeek.label,
        currentWeekData: currentContext,
        previousWeekData: compareContext,
        previousAnalysisText: priorText,
        generationNotes:
          "5월 3주차(2026-05-18~22) 주간업무보고서 엑셀(팀 통합·개인별) 반영분. 조명제어 관제·DB·현장 A/S 중심.",
        strategicChecklist: "",
      });
      console.log("\n🤖 Gemini 주간 분석 생성 중…");
      markdown = await generateWithGemini(prompt);
      source = "gemini";
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.warn(`⚠ Gemini 실패: ${msg.slice(0, 160)}`);
    }
  }

  if (!markdown.trim()) {
    console.log("📋 자동 요약 분석 생성…");
    markdown = generateAutoWeeklyAnalysis({
      summary: weeklySummary,
      previousWeekLabel: compareWeek.label,
      previousAnalysisMarkdown: priorText,
      partialSubmission: true,
    });
    source = "auto";
  }

  await fs.mkdir(ANALYSIS_DIR, { recursive: true });
  const filePath = path.join(ANALYSIS_DIR, `${key}.md`);
  await fs.writeFile(filePath, markdown, "utf-8");

  db.weeklyAnalyses = db.weeklyAnalyses ?? {};
  db.weeklyAnalyses[key] = {
    markdown,
    source,
    updatedAt: new Date().toISOString(),
  };
  await saveStore(db);

  console.log(`\n✓ AI 보고서 저장 (${source})`);
  console.log(`  파일: ${filePath}`);
  console.log(`  키: ${key}`);
  console.log(`  앱: /manager/analysis (${start} ~ ${end})`);
  return { key, filePath, source };
}

async function tryFirebaseUpload(key: string, filePath: string, source: "gemini" | "auto") {
  config({ path: path.join(process.cwd(), ".env.local"), override: true });
  const { isFirebaseConfigured } = await import("../src/lib/firebaseAdmin");
  if (!isFirebaseConfigured()) {
    console.log("\n(Firebase 미설정 — 로컬 저장만 완료)");
    return;
  }
  try {
    const markdown = await fs.readFile(filePath, "utf-8");
    const { saveGeneratedAnalysis } = await import("../src/lib/references");
    await saveGeneratedAnalysis(key, markdown, source === "gemini" ? "gemini" : "auto");
    console.log("\n✓ Firestore에도 업로드 완료");
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn(`\n⚠ Firestore 업로드 실패 (로컬 파일은 저장됨): ${msg.slice(0, 120)}`);
  }
}

async function main() {
  const folder = process.argv[2] || DEFAULT_FOLDER;
  const start = process.argv[3] || "2026-05-18";
  const end = process.argv[4] || "2026-05-22";
  const label = `${start} ~ ${end}`;

  console.log(`폴더: ${folder}`);
  console.log(`주차: ${label}\n`);

  const db = await importFromFolder(folder, start, end);
  const { key, filePath, source } = await generateAnalysis(db, start, end, label);
  await tryFirebaseUpload(key, filePath, source);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
