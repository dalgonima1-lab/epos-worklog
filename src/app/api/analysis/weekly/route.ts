import { NextRequest, NextResponse } from "next/server";
import { buildAnalysisPrompt } from "@/lib/analysisPrompt";
import { generateWithGemini } from "@/lib/gemini";
import { getDb, getMembers, getReportsInRange, verifyManagerPin } from "@/lib/db";
import { getWeekRange, shiftWeek } from "@/lib/dates";
import { buildWeeklyReportsContext } from "@/lib/reportContext";
import {
  loadGeneratedAnalysis,
  saveGeneratedAnalysis,
  weekKey,
} from "@/lib/references";

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const body = await request.json();
  const {
    pin,
    start,
    end,
    anchorDate,
    previousAnalysisText,
    managerNotes,
    strategicChecklist,
  } = body;

  if (!pin || !start || !end) {
    return NextResponse.json(
      { error: "pin, start, end가 필요합니다." },
      { status: 400 }
    );
  }

  const ok = await verifyManagerPin(String(pin));
  if (!ok) {
    return NextResponse.json({ error: "팀장 PIN이 올바르지 않습니다." }, { status: 403 });
  }

  const key = weekKey(start, end);
  if (!process.env.GEMINI_API_KEY) {
    const cached = await loadGeneratedAnalysis(key);
    if (cached?.markdown) {
      return NextResponse.json({
        markdown: cached.markdown,
        weekKey: key,
        source: cached.source,
        fromCache: true,
        notice:
          "GEMINI_API_KEY가 없어 Gemini 생성은 건너뛰었습니다. 저장된 주간 분석을 표시합니다.",
      });
    }
    return NextResponse.json(
      {
        error:
          "GEMINI_API_KEY가 설정되지 않았습니다. 저장된 분석도 없습니다.",
      },
      { status: 503 }
    );
  }

  const anchor = anchorDate
    ? new Date(anchorDate + "T12:00:00")
    : new Date(end + "T12:00:00");
  const prevWeek = getWeekRange(shiftWeek(anchor, -1));
  const currentLabel = `${start} ~ ${end}`;
  const prevLabel = prevWeek.label;
  let currentReports: Awaited<ReturnType<typeof getReportsInRange>> = [];
  let previousReports: Awaited<ReturnType<typeof getReportsInRange>> = [];

  try {
    const db = await getDb();
    const members = await getMembers();

    currentReports = await getReportsInRange(start, end);
    previousReports = await getReportsInRange(prevWeek.start, prevWeek.end);

    const currentWeekData = buildWeeklyReportsContext(
      db.teamName,
      currentLabel,
      members,
      currentReports
    );
    const previousWeekData = buildWeeklyReportsContext(
      db.teamName,
      prevLabel,
      members,
      previousReports
    );

    const prevAnalysis =
      String(previousAnalysisText ?? "").trim() ||
      (await loadReferenceForWeek(prevWeek.start, prevWeek.end)) ||
      "";

    const weekTitle = formatWeekTitle(anchor, db.teamName);
    const prompt = buildAnalysisPrompt({
      teamName: db.teamName,
      weekTitle,
      currentWeekLabel: currentLabel,
      previousWeekLabel: prevLabel,
      currentWeekData,
      previousWeekData,
      previousAnalysisText: prevAnalysis,
      managerNotes: String(managerNotes ?? ""),
      strategicChecklist: String(strategicChecklist ?? ""),
    });

    const markdown = await generateWithGemini(prompt);
    const key = weekKey(start, end);
    await saveGeneratedAnalysis(key, markdown, "gemini");

    return NextResponse.json({
      markdown,
      weekKey: key,
      source: "gemini",
      meta: {
        currentWeek: currentLabel,
        previousWeek: prevLabel,
        reportCount: currentReports.length,
        previousReportCount: previousReports.length,
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "분석 생성 실패";
    const key = weekKey(start, end);
    const cached = await loadGeneratedAnalysis(key);
    if (cached?.markdown) {
      const sourceLabel =
        cached.source === "cursor"
          ? "Cursor"
          : cached.source === "gemini"
            ? "Gemini"
            : "저장본";
      return NextResponse.json({
        markdown: cached.markdown,
        weekKey: key,
        source: cached.source,
        fromCache: true,
        notice: `Gemini API 오류로 새로 생성하지 못했습니다. 대신 ${sourceLabel}에서 저장해 둔 주간 분석을 표시합니다.`,
        geminiError: message,
        meta: {
          currentWeek: currentLabel,
          previousWeek: prevLabel,
          reportCount: currentReports.length,
          previousReportCount: previousReports.length,
        },
      });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const start = searchParams.get("start");
  const end = searchParams.get("end");
  const pin = searchParams.get("pin");

  if (!start || !end || !pin) {
    return NextResponse.json({ error: "start, end, pin 필요" }, { status: 400 });
  }

  const ok = await verifyManagerPin(pin);
  if (!ok) {
    return NextResponse.json({ error: "PIN 오류" }, { status: 403 });
  }

  const saved = await loadGeneratedAnalysis(weekKey(start, end));
  if (!saved) {
    return NextResponse.json({ markdown: null });
  }
  return NextResponse.json({
    markdown: saved.markdown,
    source: saved.source,
  });
}

function formatWeekTitle(anchor: Date, teamName: string): string {
  const month = anchor.getMonth() + 1;
  const day = anchor.getDate();
  const weekOfMonth = Math.ceil(day / 7);
  return `${month}월 ${weekOfMonth}주차 ${teamName} 업무 분석 및 제언`;
}

async function loadReferenceForWeek(
  start: string,
  end: string
): Promise<string | null> {
  const { loadPriorWeekAnalysisText } = await import("@/lib/references");
  const { text } = await loadPriorWeekAnalysisText(weekKey(start, end));
  return text || null;
}
