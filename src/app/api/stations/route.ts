import { NextRequest, NextResponse } from "next/server";
import { getStationHistory, registerStation } from "@/lib/db";
import { filterStationRecordsForDisplay } from "@/lib/sanitizeTestData";

export async function GET() {
  const records = filterStationRecordsForDisplay(await getStationHistory());
  const recent = records
    .filter((s) => s.useCount > 0)
    .sort((a, b) => b.lastUsedAt.localeCompare(a.lastUsedAt))
    .slice(0, 40);
  return NextResponse.json({
    stations: records.map((s) => s.name),
    records,
    recent: recent.map((s) => s.name),
    catalogCount: records.length,
  });
}

export async function POST(request: NextRequest) {
  const { name } = await request.json();
  if (!name?.trim()) {
    return NextResponse.json({ error: "역사명이 필요합니다." }, { status: 400 });
  }
  const { isSecurityTestPlaceholder } = await import("@/lib/sanitizeTestData");
  if (isSecurityTestPlaceholder(String(name))) {
    return NextResponse.json(
      { error: "테스트용 역사명은 등록할 수 없습니다." },
      { status: 400 }
    );
  }
  const records = await registerStation(String(name));
  return NextResponse.json({
    stations: records.map((s) => s.name),
    records,
  });
}
