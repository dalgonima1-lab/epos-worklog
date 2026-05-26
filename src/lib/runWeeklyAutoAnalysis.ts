import { getWeekRange, shiftWeek } from "./dates";
import {
  getDb,
  getMembers,
  getReportsInRange,
  loadWeeklyAnalysis,
} from "./db";
import { generateAutoWeeklyAnalysis } from "./autoWeeklyAnalysis";
import { buildAnalysisPrompt } from "./analysisPrompt";
import { generateWithGemini } from "./gemini";
import { buildWeeklyReportsContext } from "./reportContext";
import {
  loadPriorWeekAnalysisText,
  saveGeneratedAnalysis,
  weekKey,
} from "./references";
import { buildWeeklySummary } from "./summary";
import { isWeekSubmissionComplete } from "./weeklySubmission";

export interface AutoAnalysisResult {
  ok: boolean;
  skipped?: boolean;
  reason?: string;
  weekKey?: string;
  source?: "auto" | "gemini";
  start?: string;
  end?: string;
}

export async function runWeeklyAutoAnalysis(options?: {
  force?: boolean;
  /** 기본: 오늘. 토요일이면 방금 끝난 월~금 주 */
  anchorDate?: Date;
  /** true면 Gemini 시도(실패 시 자동 분석) */
  tryGemini?: boolean;
}): Promise<AutoAnalysisResult> {
  const anchor = options?.anchorDate ?? new Date();
  const { start, end, label } = getWeekRange(anchor);
  const key = weekKey(start, end);

  const db = await getDb();
  const members = await getMembers();
  const reports = await getReportsInRange(start, end);
  const summary = buildWeeklySummary(
    db.teamName,
    label,
    start,
    end,
    members,
    reports
  );

  const readiness = isWeekSubmissionComplete(summary);
  if (!readiness.complete) {
    return { ok: false, skipped: true, reason: readiness.reason, start, end };
  }

  const existing = await loadWeeklyAnalysis(key);
  if (existing?.markdown && !options?.force) {
    return {
      ok: false,
      skipped: true,
      reason: "이미 저장된 주간 분석이 있습니다.",
      weekKey: key,
      start,
      end,
    };
  }

  const prevAnchor = shiftWeek(anchor, -1);
  const prevWeek = getWeekRange(prevAnchor);
  const prevKey = weekKey(prevWeek.start, prevWeek.end);
  const prevAnalysis = await loadPriorWeekAnalysisText(prevKey);

  let markdown = generateAutoWeeklyAnalysis({
    summary,
    previousWeekLabel: prevWeek.label,
    previousAnalysisMarkdown: prevAnalysis.text,
  });
  let source: "auto" | "gemini" = "auto";

  const tryGemini =
    options?.tryGemini !== false && Boolean(process.env.GEMINI_API_KEY);

  if (tryGemini) {
    try {
      const prevReports = await getReportsInRange(prevWeek.start, prevWeek.end);
      const currentWeekData = buildWeeklyReportsContext(
        db.teamName,
        label,
        members,
        reports
      );
      const previousWeekData = buildWeeklyReportsContext(
        db.teamName,
        prevWeek.label,
        members,
        prevReports
      );
      const month = new Date(end + "T12:00:00").getMonth() + 1;
      const day = new Date(end + "T12:00:00").getDate();
      const weekOfMonth = Math.ceil(day / 7);
      const prompt = buildAnalysisPrompt({
        teamName: db.teamName,
        weekTitle: `${month}월 ${weekOfMonth}주차 ${db.teamName} 업무 분석 및 제언`,
        currentWeekLabel: label,
        previousWeekLabel: prevWeek.label,
        currentWeekData,
        previousWeekData,
        previousAnalysisText: prevAnalysis.text,
        managerNotes:
          "매주 토요일 자동 생성 분석입니다. 일일 기록 전원 제출이 확인된 주입니다.",
        strategicChecklist: "",
      });
      markdown = await generateWithGemini(prompt);
      source = "gemini";
    } catch {
      /* Gemini 실패 시 자동 분석본 유지 */
    }
  }

  await saveGeneratedAnalysis(key, markdown, source);

  return { ok: true, weekKey: key, source, start, end };
}
