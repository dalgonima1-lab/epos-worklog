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

export type AutoAnalysisSchedule = "saturday" | "sunday" | "manual";

export interface AutoAnalysisResult {
  ok: boolean;
  skipped?: boolean;
  reason?: string;
  weekKey?: string;
  source?: "auto" | "gemini";
  start?: string;
  end?: string;
  partial?: boolean;
}

export async function runWeeklyAutoAnalysis(options?: {
  /** saturday=전원 제출 시만, sunday=제출분만 부분 분석 */
  schedule?: AutoAnalysisSchedule;
  force?: boolean;
  anchorDate?: Date;
  tryGemini?: boolean;
}): Promise<AutoAnalysisResult> {
  const schedule = options?.schedule ?? "manual";
  const allowPartial = schedule === "sunday";
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

  const totalReports = summary.members.reduce((n, m) => n + m.reports.length, 0);
  const readiness = isWeekSubmissionComplete(summary);

  if (totalReports === 0) {
    return {
      ok: false,
      skipped: true,
      reason: "이번 주 제출된 일일 기록이 없습니다.",
      start,
      end,
    };
  }

  if (!allowPartial && !readiness.complete) {
    return {
      ok: false,
      skipped: true,
      reason: readiness.reason,
      start,
      end,
      partial: false,
    };
  }

  const existing = await loadWeeklyAnalysis(key);

  if (schedule === "saturday") {
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
  }

  if (schedule === "sunday") {
    if (existing?.markdown && readiness.complete && !options?.force) {
      return {
        ok: false,
        skipped: true,
        reason:
          "토요일에 전원 제출 기준 분석이 이미 저장되어 있습니다. 추가 제출이 없으면 생략합니다.",
        weekKey: key,
        start,
        end,
        partial: false,
      };
    }
  } else if (existing?.markdown && !options?.force && !allowPartial) {
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

  const partialSubmission = allowPartial && !readiness.complete;

  let markdown = generateAutoWeeklyAnalysis({
    summary,
    previousWeekLabel: prevWeek.label,
    previousAnalysisMarkdown: prevAnalysis.text,
    partialSubmission,
    submissionStatus: readiness,
  });
  let source: "auto" | "gemini" = "auto";

  const tryGemini =
    options?.tryGemini !== false && Boolean(process.env.GEMINI_API_KEY);

  if (tryGemini) {
    try {
      const prevReports = await getReportsInRange(prevWeek.start, prevWeek.end);
      const submittedReports = summary.members.flatMap((m) => m.reports);
      const currentWeekData = buildWeeklyReportsContext(
        db.teamName,
        label,
        members,
        submittedReports
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

      const managerNotes = partialSubmission
        ? `일요일 부분 제출 분석입니다. 제출된 ${totalReports}건만 반영하고, 미제출 일자는 보고서에 명시하세요. 미제출: ${readiness.reason}`
        : "매주 토요일 자동 생성 분석입니다. 일일 기록 전원 제출이 확인된 주입니다.";

      const prompt = buildAnalysisPrompt({
        teamName: db.teamName,
        weekTitle: `${month}월 ${weekOfMonth}주차 ${db.teamName} 업무 분석 및 제언`,
        currentWeekLabel: label,
        previousWeekLabel: prevWeek.label,
        currentWeekData,
        previousWeekData,
        previousAnalysisText: prevAnalysis.text,
        managerNotes,
        strategicChecklist: "",
      });
      markdown = await generateWithGemini(prompt);
      source = "gemini";
    } catch {
      /* 자동 분석본 유지 */
    }
  }

  await saveGeneratedAnalysis(key, markdown, source);

  return {
    ok: true,
    weekKey: key,
    source,
    start,
    end,
    partial: partialSubmission,
  };
}
