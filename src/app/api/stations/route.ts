import { NextRequest, NextResponse } from "next/server";
import { getStationHistory, registerStation } from "@/lib/db";
import { filterStationRecordsForDisplay } from "@/lib/sanitizeTestData";
import {
  isStationFacilityArea,
  type StationFacilityArea,
} from "@/lib/stationFacility";
import { listCustomRegisteredStations } from "@/lib/stationFacilities";

function parseFacilities(raw: unknown): StationFacilityArea[] {
  if (!Array.isArray(raw)) return [];
  const out: StationFacilityArea[] = [];
  for (const item of raw) {
    const area = String(item ?? "").trim();
    if (isStationFacilityArea(area) && !out.includes(area)) {
      out.push(area);
    }
  }
  return out;
}

export async function GET() {
  const records = filterStationRecordsForDisplay(await getStationHistory());
  const recent = records
    .filter((s) => s.useCount > 0)
    .sort((a, b) => b.lastUsedAt.localeCompare(a.lastUsedAt))
    .slice(0, 5);
  const customStations = listCustomRegisteredStations(records);
  return NextResponse.json({
    stations: records.map((s) => s.name),
    records,
    recent: recent.map((s) => s.name),
    customStations,
    catalogCount: records.length,
  });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { name, facilities: rawFacilities, custom } = body ?? {};
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
  const facilities = parseFacilities(rawFacilities);
  if (custom && facilities.length === 0) {
    return NextResponse.json(
      { error: "기능실을 1곳 이상 선택해 주세요." },
      { status: 400 }
    );
  }
  const records = await registerStation(String(name), {
    facilities: facilities.length ? facilities : undefined,
    custom: Boolean(custom) || facilities.length > 0,
  });
  return NextResponse.json({
    stations: records.map((s) => s.name),
    records: filterStationRecordsForDisplay(records),
    customStations: listCustomRegisteredStations(records),
  });
}
