import { NextRequest, NextResponse } from "next/server";
import { getReportsByStationName } from "@/lib/db";

export async function GET(request: NextRequest) {
  const station = request.nextUrl.searchParams.get("station")?.trim();
  if (!station) {
    return NextResponse.json(
      { error: "station 파라미터가 필요합니다." },
      { status: 400 }
    );
  }

  const limitRaw = request.nextUrl.searchParams.get("limit");
  let limit = 300;
  if (limitRaw != null) {
    const n = parseInt(limitRaw, 10);
    if (!Number.isNaN(n)) {
      limit = Math.min(500, Math.max(1, n));
    }
  }

  const reports = await getReportsByStationName(station, limit);
  return NextResponse.json({ reports, station });
}
