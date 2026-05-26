import { NextRequest, NextResponse } from "next/server";
import { koreanHolidaysInRange } from "@/lib/koreanHolidays";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const start = searchParams.get("start")?.trim() ?? "";
  const end = searchParams.get("end")?.trim() ?? "";
  if (!start || !end) {
    return NextResponse.json(
      { error: "start, end 파라미터가 필요합니다." },
      { status: 400 }
    );
  }
  const holidays = koreanHolidaysInRange(start, end);
  return NextResponse.json({ holidays });
}
