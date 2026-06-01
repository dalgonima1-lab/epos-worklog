import { NextRequest, NextResponse } from "next/server";
import { formatFirestoreUserError } from "@/lib/firebaseAdmin";
import { getBudgetData, saveBudgetData } from "@/lib/db";
import type { WeddingBudgetData } from "@/lib/types";

function formatApiError(e: unknown): string {
  return formatFirestoreUserError(e);
}

function pinOk(request: NextRequest): boolean {
  const required = process.env.WEDDING_ACCESS_PIN?.trim();
  if (!required) return true;
  const pin =
    request.headers.get("x-wedding-pin")?.trim() ||
    new URL(request.url).searchParams.get("pin")?.trim();
  return pin === required;
}

export async function GET(request: NextRequest) {
  if (!pinOk(request)) {
    return NextResponse.json({ error: "접근 PIN이 올바르지 않습니다." }, { status: 403 });
  }
  try {
    const data = await getBudgetData();
    return NextResponse.json({ data });
  } catch (e) {
    return NextResponse.json({ error: formatApiError(e) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!pinOk(request)) {
    return NextResponse.json({ error: "접근 PIN이 올바르지 않습니다." }, { status: 403 });
  }
  try {
    const body = (await request.json()) as { data?: WeddingBudgetData };
    if (!body?.data) {
      return NextResponse.json({ error: "data 필드가 필요합니다." }, { status: 400 });
    }
    await saveBudgetData(body.data);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: formatApiError(e) }, { status: 500 });
  }
}
