import { NextRequest, NextResponse } from "next/server";
import { getReport, getReportsInRange, upsertReport } from "@/lib/db";
import { isStationFacilityArea } from "@/lib/stationFacility";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const start = searchParams.get("start");
  const end = searchParams.get("end");
  const memberId = searchParams.get("memberId");
  const date = searchParams.get("date");

  if (date && memberId) {
    const report = await getReport(memberId, date);
    return NextResponse.json({ report });
  }

  if (!start || !end) {
    return NextResponse.json(
      { error: "start, end 파라미터가 필요합니다." },
      { status: 400 }
    );
  }

  let reports = await getReportsInRange(start, end);
  if (memberId) {
    reports = reports.filter((r) => r.memberId === memberId);
  }
  return NextResponse.json({ reports });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const {
    memberId,
    date,
    stationName,
    facilityArea,
    processingRole,
    done,
    plan,
    issues,
    deficiencies,
    beforePhotoAt,
    afterPhotoAt,
  } = body;

  if (!memberId || !date) {
    return NextResponse.json(
      { error: "memberId, date는 필수입니다." },
      { status: 400 }
    );
  }

  if (!stationName?.trim()) {
    return NextResponse.json(
      { error: "역사명을 선택하거나 입력해 주세요." },
      { status: 400 }
    );
  }

  if (!facilityArea?.trim() || !isStationFacilityArea(String(facilityArea).trim())) {
    return NextResponse.json(
      { error: "작업 장소(전기실·변전소·역무실)를 선택해 주세요." },
      { status: 400 }
    );
  }

  if (!processingRole?.trim()) {
    return NextResponse.json(
      { error: "공종을 선택해 주세요." },
      { status: 400 }
    );
  }

  const existing = await getReport(memberId, date);

  const report = await upsertReport(memberId, date, {
    stationName: String(stationName).trim(),
    facilityArea: String(facilityArea).trim(),
    processingRole: String(processingRole).trim(),
    done: done ?? "",
    plan: plan ?? "",
    issues: issues ?? "",
    deficiencies: deficiencies ?? "",
    beforePhotoAt: beforePhotoAt ?? existing?.beforePhotoAt,
    afterPhotoAt: afterPhotoAt ?? existing?.afterPhotoAt,
  });

  return NextResponse.json({ report });
}
