import { NextRequest, NextResponse } from "next/server";
import {
  loadReferenceAnalysis,
  saveReferenceAnalysis,
  weekKey,
} from "@/lib/references";
import { verifyManagerPin } from "@/lib/db";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const start = searchParams.get("start");
  const end = searchParams.get("end");
  const pin = searchParams.get("pin");

  if (!start || !end || !pin) {
    return NextResponse.json({ error: "start, end, pin 필요" }, { status: 400 });
  }

  if (!(await verifyManagerPin(pin))) {
    return NextResponse.json({ error: "PIN 오류" }, { status: 403 });
  }

  const text = await loadReferenceAnalysis(weekKey(start, end));
  return NextResponse.json({ text: text ?? "" });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { pin, start, end, text } = body;

  if (!pin || !start || !end) {
    return NextResponse.json({ error: "pin, start, end 필요" }, { status: 400 });
  }

  if (!(await verifyManagerPin(String(pin)))) {
    return NextResponse.json({ error: "PIN 오류" }, { status: 403 });
  }

  await saveReferenceAnalysis(weekKey(start, end), String(text ?? ""));
  return NextResponse.json({ ok: true });
}
