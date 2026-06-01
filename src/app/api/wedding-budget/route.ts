import { NextRequest, NextResponse } from "next/server";
import { formatFirestoreUserError } from "@/lib/firebaseAdmin";
import { getWeddingBudgetData, saveWeddingBudgetData } from "@/lib/weddingBudget/db";
import type { WeddingBudgetData } from "@/lib/weddingBudget/types";

function formatApiError(e: unknown): string {
  if (e instanceof Error) return formatFirestoreUserError(e);
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

function pinDenied() {
  return NextResponse.json({ error: "접근 PIN이 올바르지 않습니다." }, { status: 403 });
}

export async function GET(request: NextRequest) {
  if (!pinOk(request)) return pinDenied();
  try {
    const data = await getWeddingBudgetData();
    return NextResponse.json({ data, storage: "cloud" });
  } catch (e) {
    return NextResponse.json({ error: formatApiError(e) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!pinOk(request)) return pinDenied();
  try {
    const body = (await request.json()) as { data?: WeddingBudgetData };
    if (!body?.data || typeof body.data !== "object") {
      return NextResponse.json({ error: "data 필드가 필요합니다." }, { status: 400 });
    }
    await saveWeddingBudgetData(body.data);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: formatApiError(e) }, { status: 500 });
  }
}
