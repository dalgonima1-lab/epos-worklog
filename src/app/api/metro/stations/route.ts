import { NextRequest, NextResponse } from "next/server";
import {
  filterMetroStations,
  getMetroStationsForLine,
} from "@/lib/metroStations";

export const dynamic = "force-static";

export async function GET(request: NextRequest) {
  const lineParam = request.nextUrl.searchParams.get("line");
  const q = request.nextUrl.searchParams.get("q") ?? "";

  const line = Number(lineParam);
  if (!lineParam || Number.isNaN(line) || line < 1 || line > 9) {
    return NextResponse.json(
      { error: "line 파라미터(1~9)가 필요합니다." },
      { status: 400 }
    );
  }

  const stations = q.trim()
    ? filterMetroStations(line, q)
    : getMetroStationsForLine(line);

  return NextResponse.json({ line, stations, count: stations.length });
}
