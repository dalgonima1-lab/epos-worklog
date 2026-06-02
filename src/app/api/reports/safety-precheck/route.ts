import { NextRequest, NextResponse } from "next/server";
import { updateSafetyPrecheck } from "@/lib/db";
import { normalizeSafetyPrecheck } from "@/lib/safetyPrecheck";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const memberId = String(body.memberId ?? "").trim();
  const date = String(body.date ?? "").trim();
  if (!memberId || !date) {
    return NextResponse.json(
      { error: "memberId, date는 필수입니다." },
      { status: 400 }
    );
  }
  const precheck = normalizeSafetyPrecheck(body.safetyPrecheck);
  if (!precheck) {
    return NextResponse.json(
      { error: "안전서류 데이터가 비어 있습니다." },
      { status: 400 }
    );
  }
  const report = await updateSafetyPrecheck(memberId, date, precheck);
  return NextResponse.json({ ok: true, report });
}
