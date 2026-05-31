import { getWeekRange, shiftWeek } from "./dates";
import {
  getDb,
  getMembers,
  getReportsInRange,
  getSchedulesInRange,
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
import {
  buildWeekDataSignature,
  describeWeekDataChange,
  formatRefreshedAnalysisMessage,
  formatUnchangedAnalysisMessage,
} from "./analysisWeekFingerprint";

export type AutoAnalysisSchedule = "saturday" | "sunday" | "manual";

export interface AutoAnalysisResult {
  ok: boolean;
  skipped?: boolean;
  unchanged?: boolean;
  reason?: string;
  message?: string;
  changeSummary?: string;
  updatedAt?: string;
  previousUpdatedAt?: string;
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
  const allowPartial = schedule === "sunday" || schedule === "manual";
  const anchor = options?.anchorDate ?? new Date();
  const { start, end, label } = getWeekRange(anchor);
  const key = weekKey(start, end);

  const db = await getDb();
  const members = await getMembers();
  const [reports, schedules] = await Promise.all([
    getReportsInRange(start, end),
    getSchedulesInRange(start, end),
  ]);
  const summary = buildWeeklySummary(
    db.teamName,
    label,
    start,
    end,
    members,
    reports,
    schedules
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
  const currentSig = buildWeekDataSignature(reports, schedules);
  const partialSubmission = allowPartial || !readiness.complete;

  if (existing?.markdown && !options?.force) {
    const prevSig = existing.dataSignature;
    if (prevSig?.fingerprint === currentSig.fingerprint) {
      return {
        ok: false,
        skipped: true,
        unchanged: true,
        reason: formatUnchangedAnalysisMessage(existing.updatedAt, prevSig),
        weekKey: key,
        start,
        end,
        updatedAt: existing.updatedAt,
        partial: partialSubmission,
      };
    }
  }

  const prevAnchor = shiftWeek(anchor, -1);
  const prevWeek = getWeekRange(prevAnchor);
  const prevKey = weekKey(prevWeek.start, prevWeek.end);
  const prevAnalysis = await loadPriorWeekAnalysisText(
    prevKey,
    prevWeek.start,
    prevWeek.end
  );

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

      const generationNotes = partialSubmission
        ? `등록된 일일 기록 ${totalReports}건만 반영하는 부분 분석입니다. 법정 공휴일·일정 미등록일·연차는 제출 의무에서 제외하세요. 일정 등록 후 미제출: ${readiness.reason}`
        : "매주 토요일 자동 생성 분석입니다. 등록 일정 기준 전원 제출이 확인된 주입니다.";

      const prompt = buildAnalysisPrompt({
        teamName: db.teamName,
        weekTitle: `${month}월 ${weekOfMonth}주차 ${db.teamName} 업무 분석 및 제언`,
        currentWeekLabel: label,
        previousWeekLabel: prevWeek.label,
        currentWeekData,
        previousWeekData,
        previousAnalysisText: prevAnalysis.text,
        generationNotes,
        strategicChecklist: "",
      });
      markdown = await generateWithGemini(prompt);
      source = "gemini";
    } catch {
      /* 자동 분석본 유지 */
    }
  }

  const changeSummary = options?.force
    ? "등록분 전체 재분석"
    : describeWeekDataChange(existing?.dataSignature, currentSig);
  const updatedAt = new Date().toISOString();

  await saveGeneratedAnalysis(key, markdown, source, {
    dataSignature: currentSig,
    updatedAt,
  });

  return {
    ok: true,
    weekKey: key,
    source,
    start,
    end,
    partial: partialSubmission,
    changeSummary,
    updatedAt,
    previousUpdatedAt: existing?.updatedAt,
    message: formatRefreshedAnalysisMessage(changeSummary, updatedAt, source),
  };
}
