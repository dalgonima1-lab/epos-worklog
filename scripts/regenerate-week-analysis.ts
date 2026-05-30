/**
 * 지정 주차 자동 분석 생성·저장 (Firestore 또는 로컬)
 *
 * npx tsx scripts/regenerate-week-analysis.ts 2026-05-26 2026-05-30
 */
import { config } from "dotenv";
import path from "path";
import { getDb, getMembers, getReportsInRange, getSchedulesInRange } from "../src/lib/db";
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
import { isWeekSubmissionComplete } from "../src/lib/weeklySubmission";

config({ path: path.join(process.cwd(), ".env.local") });

async function main() {
  const [start, end] = process.argv.slice(2);
  if (!start || !end) {
    console.error("사용법: npx tsx scripts/regenerate-week-analysis.ts <start> <end>");
    process.exit(1);
  }

  const label = `${start} ~ ${end}`;
  const compareWeek = getCompareWeekForTarget(end);
  const scope = formatScopeSummary({
    targetWeek: { start, end, label },
    compareWeek,
  });
  console.log(scope.oneLiner);

  let priorText = "";
  try {
    const prior = await loadPriorWeekAnalysisText(
      weekKey(compareWeek.start, compareWeek.end),
      compareWeek.start,
      compareWeek.end
    );
    priorText = prior.text;
    if (priorText.trim()) {
      console.log(`✓ 비교 기준 (${prior.source}): ${compareWeek.label}`);
    }
  } catch (e) {
    console.warn("⚠ 비교 기준 불러오기 실패 — 일일 기록만으로 생성:", e);
  }

  const db = await getDb();
  const members = await getMembers();
  const [reports, schedules] = await Promise.all([
    getReportsInRange(start, end),
    getSchedulesInRange(start, end),
  ]);

  console.log(`일일 기록 ${reports.length}건 · 팀원 ${members.length}명`);

  const summary = buildWeeklySummary(
    db.teamName,
    label,
    start,
    end,
    members,
    reports,
    schedules
  );

  for (const m of summary.members) {
    console.log(`  - ${m.member.name}: 기록 ${m.reports.length}건`);
  }

  const readiness = isWeekSubmissionComplete(summary);
  const partialSubmission = !readiness.complete;

  const markdown = generateAutoWeeklyAnalysis({
    summary,
    previousWeekLabel: compareWeek.label,
    previousAnalysisMarkdown: priorText,
    partialSubmission,
    submissionStatus: readiness,
  });

  const key = weekKey(start, end);
  const saved = await saveGeneratedAnalysis(key, markdown, "auto");
  console.log(`\n✓ 저장 완료 (${saved})`);
  console.log(`  섹션2 미리보기:\n`);
  const sec2 = markdown.match(/## 2[\s\S]*?(?=\n## 3\.|$)/);
  console.log(sec2 ? sec2[0].slice(0, 1200) : "(섹션2 없음)");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
