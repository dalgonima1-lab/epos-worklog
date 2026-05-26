/**
 * 주간업무보고서(xlsx) → Firestore/로컬 DB 일일 기록 + AI 팀장 주간 분석
 * 실행: npx tsx scripts/import-and-analyze.ts
 */
import { config } from "dotenv";
import path from "path";
import { createRequire } from "module";
import { upsertReport, getDb, getMembers, getReportsInRange } from "../src/lib/db";
import { generateWithGemini } from "../src/lib/gemini";
import { buildWeeklyReportsContext } from "../src/lib/reportContext";
import {
  loadPriorWeekAnalysisText,
  saveGeneratedAnalysis,
  weekKey,
} from "../src/lib/references";
import { getCompareWeekForTarget } from "../src/lib/analysisWeekScope";
import { getWeekRange } from "../src/lib/dates";
import { promises as fs } from "fs";
import { isFirebaseConfigured } from "../src/lib/firebaseAdmin";

config({ path: path.join(process.cwd(), ".env.local") });

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

const FOLDER =
  process.argv[2] ||
  "f:\\01. EPOS\\000000. 진행상황 정리\\26년도 5월3째주";

const FILES = [
  "20260522_유영준_주간업무보고서(EPOS 관리팀).xlsx",
  "주간업무보고_05월3주차_이준명.xlsx",
  "주간업무보고서(EPOS 관리팀)2026년5월18일 ~ 2026년5월22일.xlsx",
];

type ParsedEntry = {
  memberId: string;
  date: string;
  stationName: string;
  processingRole: string;
  done: string;
  plan: string;
  issues: string;
  deficiencies: string;
};

async function importReports() {
  const merged = new Map<string, ParsedEntry>();

  for (const name of FILES) {
    const fp = path.join(FOLDER, name);
    const blocks = parseWorkbook(fp);
    for (const block of blocks) {
      console.log(`📄 ${block.reporter}: ${block.entries.length}일`);
      for (const e of block.entries) {
        const key = `${e.memberId}_${e.date}`;
        merged.set(key, e);
        const report = await upsertReport(e.memberId, e.date, {
          stationName: e.stationName,
          processingRole: e.processingRole,
          done: e.done,
          plan: e.plan,
          issues: e.issues,
          deficiencies: e.deficiencies,
        });
        console.log(`  ✓ ${e.date} ${report.stationName}`);
      }
    }
  }

  return merged.size;
}

async function generateWeeklyAnalysis() {
  const anchor = new Date("2026-05-22T12:00:00");
  const { start, end, label } = getWeekRange(anchor);
  const compareWeek = getCompareWeekForTarget(end);
  const compareKey = weekKey(compareWeek.start, compareWeek.end);
  const prior = await loadPriorWeekAnalysisText(compareKey);
  const key = weekKey(start, end);
  const fallbackPath = path.join(
    process.cwd(),
    "data",
    "analyses",
    `${key}.md`
  );

  try {
    const db = await getDb();
    const members = await getMembers();
    const currentReports = await getReportsInRange(start, end);
    const compareReports = await getReportsInRange(
      compareWeek.start,
      compareWeek.end
    );
    const currentContext = buildWeeklyReportsContext(
      db.teamName,
      label,
      members,
      currentReports
    );
    const compareContext = buildWeeklyReportsContext(
      db.teamName,
      compareWeek.label,
      members,
      compareReports
    );

    console.log(
      `비교 기준: ${compareWeek.label} (보고서 ${prior.text ? prior.source : "없음"})`
    );

    const { buildAnalysisPrompt } = await import("../src/lib/analysisPrompt");
    const prompt = buildAnalysisPrompt({
      teamName: db.teamName,
      weekTitle: `EPOS 관리팀 주간 분석 (${label})`,
      currentWeekLabel: label,
      previousWeekLabel: compareWeek.label,
      currentWeekData: currentContext,
      previousWeekData: compareContext,
      previousAnalysisText: prior.text,
      managerNotes:
        "5월 3주차 주간업무보고서 엑셀 반영분. 조명제어 관제·DB·A/S 중심.",
      strategicChecklist: "",
    });

    console.log("\n🤖 Gemini 주간 분석 생성 중…");
    const markdown = await generateWithGemini(prompt);
    const filePath = await saveGeneratedAnalysis(key, markdown);
    console.log(`✓ AI 보고서 저장: ${filePath}`);
    return { start, end, key, source: "gemini" as const };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn(`\n⚠ Gemini 실패: ${msg.slice(0, 120)}…`);
    try {
      const markdown = await fs.readFile(fallbackPath, "utf-8");
      await saveGeneratedAnalysis(key, markdown, "cursor");
      console.log(`✓ 정리본 보고서 사용: ${fallbackPath}`);
      return { start, end, key, source: "fallback" as const };
    } catch {
      console.warn("정리본 파일도 없습니다. data/analyses/ 에 md를 추가하세요.");
      return { start, end, key, source: "none" as const };
    }
  }
}

async function main() {
  console.log(
    "저장소:",
    isFirebaseConfigured() ? "Firebase Firestore" : "로컬 data/store.json"
  );

  const count = await importReports();
  console.log(`\n총 ${count}건 일일 기록 반영 완료`);

  if (!process.env.GEMINI_API_KEY) {
    console.warn("GEMINI_API_KEY 없음 — AI 보고서는 건너뜁니다.");
    return;
  }

  const analysis = await generateWeeklyAnalysis();
  console.log(
    `\n완료. 팀장 화면 → AI 주간 분석 (${analysis.start} ~ ${analysis.end})`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
