import { NextRequest, NextResponse } from "next/server";
import { verifyManagerPin } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as { pin?: unknown };
    const pin = String(body.pin ?? "").trim();
    const ok = await verifyManagerPin(pin);
    if (ok) {
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({
      ok: false,
      error: "PIN이 올바르지 않습니다.",
    });
  } catch (error) {
    console.error("manager auth:", error);
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      {
        ok: false,
        error: `저장소 연결 오류: ${msg}`,
      },
      { status: 200 }
    );
  }
}
