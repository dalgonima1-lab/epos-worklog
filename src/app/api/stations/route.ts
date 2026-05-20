import { NextRequest, NextResponse } from "next/server";
import { getStationHistory, registerStation } from "@/lib/db";

export async function GET() {
  const stations = await getStationHistory();
  return NextResponse.json({
    stations: stations.map((s) => s.name),
    records: stations,
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
