import { NextRequest, NextResponse } from "next/server";
import {
  resolveWeeklyAnalysis,
  saveWeeklyAnalysisDirective,
  verifyManagerPin,
} from "@/lib/db";
import { weekKey } from "@/lib/references";
import type { ManagerDirective } from "@/lib/types";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const start = searchParams.get("start");
  const end = searchParams.get("end");
  const pin = searchParams.get("pin");

  if (!start || !end || !pin) {
    return NextResponse.json({ error: "start, end, pin 필요" }, { status: 400 });
  }

  if (!(await verifyManagerPin(pin))) {
    return NextResponse.json({ error: "관리자 PIN이 올바르지 않습니다." }, { status: 403 });
  }

  const resolved = await resolveWeeklyAnalysis(start, end);
  return NextResponse.json({
    managerDirective: resolved?.record.managerDirective ?? null,
  });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { pin, start, end, author, text } = body as {
    pin?: string;
    start?: string;
    end?: string;
    author?: string;
    text?: string;
  };

  if (!pin || !start || !end) {
    return NextResponse.json({ error: "pin, start, end 필요" }, { status: 400 });
  }

  if (!(await verifyManagerPin(String(pin)))) {
    return NextResponse.json({ error: "관리자 PIN이 올바르지 않습니다." }, { status: 403 });
  }

  const trimmed = String(text ?? "").trim();
  if (!trimmed) {
    return NextResponse.json({ error: "첨언·지시 내용을 입력해 주세요." }, { status: 400 });
  }

  const authorLabel = String(author ?? "팀장").trim() || "팀장";
  const directive: ManagerDirective = {
    author: authorLabel,
    text: trimmed,
    updatedAt: new Date().toISOString(),
  };

  try {
    await saveWeeklyAnalysisDirective(weekKey(start, end), directive);
    return NextResponse.json({ ok: true, managerDirective: directive });
  } catch (e) {
    const message = e instanceof Error ? e.message : "저장 실패";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
