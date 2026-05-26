import { NextRequest, NextResponse } from "next/server";
import { authorizeCron } from "@/lib/cronAuth";
import { runWeeklyAutoAnalysis } from "@/lib/runWeeklyAutoAnalysis";

export const maxDuration = 120;
export const dynamic = "force-dynamic";

/** Vercel Cron: 매주 일요일 09:00(KST) — 제출된 일일 기록만 부분 분석·저장 */
export async function GET(request: NextRequest) {
  if (!authorizeCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const force = request.nextUrl.searchParams.get("force") === "true";

  try {
    const result = await runWeeklyAutoAnalysis({
      schedule: "sunday",
      force,
      tryGemini: true,
    });

    return NextResponse.json({
      ...result,
      message: result.ok
        ? result.partial
          ? `부분 주간 분석 저장 완료 (${result.source})`
          : `주간 분석 저장 완료 (${result.source})`
        : result.skipped
          ? result.reason
          : "처리 실패",
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "자동 분석 실패";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
