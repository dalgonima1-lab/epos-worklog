import { NextRequest, NextResponse } from "next/server";
import { verifyManagerPin } from "@/lib/db";
import { runWeeklyAutoAnalysis } from "@/lib/runWeeklyAutoAnalysis";
import { getWeekRange } from "@/lib/dates";

export const maxDuration = 120;

/** 팀장: 제출 완료 주차 자동 분석 즉시 실행 */
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { pin, force, start, end, partial } = body as {
    pin?: string;
    force?: boolean;
    start?: string;
    end?: string;
    /** true면 제출된 기록만 부분 분석(일요일 루틴과 동일) */
    partial?: boolean;
  };

  if (!pin) {
    return NextResponse.json({ error: "pin이 필요합니다." }, { status: 400 });
  }

  if (!(await verifyManagerPin(String(pin)))) {
    return NextResponse.json({ error: "관리자 PIN이 올바르지 않습니다." }, { status: 403 });
  }

  let anchorDate: Date | undefined;
  if (start && end) {
    anchorDate = new Date(end + "T12:00:00");
  } else {
    anchorDate = new Date();
  }

  const week = getWeekRange(anchorDate);

  try {
    const result = await runWeeklyAutoAnalysis({
      schedule: partial ? "sunday" : "manual",
      force: Boolean(force),
      anchorDate,
      tryGemini: true,
    });

    if (result.ok) {
      return NextResponse.json({
        ok: true,
        weekKey: result.weekKey,
        source: result.source,
        start: result.start ?? week.start,
        end: result.end ?? week.end,
        message: result.message ?? "주간 분석을 저장했습니다.",
        changeSummary: result.changeSummary,
        updatedAt: result.updatedAt,
        previousUpdatedAt: result.previousUpdatedAt,
      });
    }

    return NextResponse.json({
      ok: false,
      skipped: result.skipped,
      unchanged: result.unchanged,
      reason: result.reason,
      updatedAt: result.updatedAt,
      start: result.start ?? week.start,
      end: result.end ?? week.end,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "자동 분석 실패";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
