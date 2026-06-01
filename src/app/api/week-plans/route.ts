import { NextRequest, NextResponse } from "next/server";
import { getWeekPlans, saveMemberWeekPlan } from "@/lib/db";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const start = searchParams.get("start");
  const end = searchParams.get("end");
  if (!start || !end) {
    return NextResponse.json({ error: "start, end 필요" }, { status: 400 });
  }
  const plans = await getWeekPlans(start, end);
  return NextResponse.json({ plans, weekLabel: `${start} ~ ${end}` });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { start, end, memberId, text } = body as {
    start?: string;
    end?: string;
    memberId?: string;
    text?: string;
  };
  if (!start || !end || !memberId) {
    return NextResponse.json(
      { error: "start, end, memberId 필요" },
      { status: 400 }
    );
  }
  const saved = await saveMemberWeekPlan(
    String(start),
    String(end),
    String(memberId),
    String(text ?? "")
  );
  return NextResponse.json({ ok: true, plan: saved });
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const start = searchParams.get("start");
  const end = searchParams.get("end");
  const memberId = searchParams.get("memberId");
  if (!start || !end || !memberId) {
    return NextResponse.json(
      { error: "start, end, memberId 필요" },
      { status: 400 }
    );
  }
  await saveMemberWeekPlan(start, end, memberId, "");
  return NextResponse.json({ ok: true });
}
