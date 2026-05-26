import { NextRequest, NextResponse } from "next/server";
import { runWeeklyAutoAnalysis } from "@/lib/runWeeklyAutoAnalysis";

export const maxDuration = 120;
export const dynamic = "force-dynamic";

function authorizeCron(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

/** Vercel Cron: 매주 토요일 09:00(KST) — 전원 일일 기록 제출 시 주간 분석 자동 저장 */
export async function GET(request: NextRequest) {
  if (!authorizeCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const force = request.nextUrl.searchParams.get("force") === "true";

  try {
    const result = await runWeeklyAutoAnalysis({ force, tryGemini: true });

    return NextResponse.json({
      ...result,
      message: result.ok
        ? `주간 분석 저장 완료 (${result.source})`
        : result.skipped
          ? result.reason
          : "처리 실패",
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "자동 분석 실패";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
