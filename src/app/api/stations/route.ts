import { NextRequest, NextResponse } from "next/server";
import { getStationHistory, registerStation } from "@/lib/db";

export async function GET() {
  const records = await getStationHistory();
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
  const records = await registerStation(String(name));
  return NextResponse.json({
    stations: records.map((s) => s.name),
    records,
  });
}
