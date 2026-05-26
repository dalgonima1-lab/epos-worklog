/**
 * 지난주(또는 지정 주) 일일 기록 + 지지난주(직전 주) 저장 분석을 바탕으로
 * Cursor 형식 주간 분석 Markdown 생성·저장
 *
 * npx tsx scripts/generate-cursor-analysis.ts
 * npx tsx scripts/generate-cursor-analysis.ts 2026-05-18 2026-05-22
 */
import { config } from "dotenv";
import path from "path";
import { getDb, getMembers, getReportsInRange } from "../src/lib/db";
import { getWeekRange, shiftWeek } from "../src/lib/dates";
import {
  getCompareWeekForTarget,
  formatScopeSummary,
} from "../src/lib/analysisWeekScope";
import { buildWeeklySummary } from "../src/lib/summary";
import { generateAutoWeeklyAnalysis } from "../src/lib/autoWeeklyAnalysis";
import {
  loadPriorWeekAnalysisText,
  saveGeneratedAnalysis,
  weekKey,
} from "../src/lib/references";

config({ path: path.join(process.cwd(), ".env.local") });

async function main() {
  const [startArg, endArg] = process.argv.slice(2);
  let start: string;
  let end: string;
  let label: string;

  if (startArg && endArg) {
    start = startArg;
    end = endArg;
    label = `${start} ~ ${end}`;
  } else {
    const lastWeekAnchor = shiftWeek(new Date(), -1);
    ({ start, end, label } = getWeekRange(lastWeekAnchor));
  }

  const compareWeek = getCompareWeekForTarget(end);
  const compareKey = weekKey(compareWeek.start, compareWeek.end);
  const prior = await loadPriorWeekAnalysisText(compareKey);

  const scope = {
    targetWeek: { start, end, label },
    compareWeek,
  };
  const summary = formatScopeSummary(scope);
  console.log(summary.oneLiner);

  if (!prior.text.trim()) {
    console.warn(
      `\n⚠ 비교 기준 보고서 없음 (${compareWeek.label}).\n` +
        `  references/ 또는 weeklyAnalyses에 ${compareKey} 를 먼저 저장하세요.\n`
    );
  } else {
    console.log(`✓ 비교 기준 로드 (${prior.source}): ${compareWeek.label}`);
  }

  const db = await getDb();
  const members = await getMembers();
  const reports = await getReportsInRange(start, end);
  const weeklySummary = buildWeeklySummary(
    db.teamName,
    label,
    start,
    end,
    members,
    reports
  );

  const markdown = generateAutoWeeklyAnalysis({
    summary: weeklySummary,
    previousWeekLabel: compareWeek.label,
    previousAnalysisMarkdown: prior.text,
  });

  const key = weekKey(start, end);
  const saved = await saveGeneratedAnalysis(key, markdown, "cursor");
  console.log(`\n✓ Cursor 분석 저장: ${saved}`);
  console.log(`  앱: /manager/analysis (주차 ${label})`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
