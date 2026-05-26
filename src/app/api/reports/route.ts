import { NextRequest, NextResponse } from "next/server";
import { getReport, getReportsInRange, upsertReport } from "@/lib/db";
import { createVisitGroupId } from "@/lib/visitGroup";
import {
  isProcessingRoleAllowedForFacilities,
  isProcessingRoleAllowedForFacility,
  isWorkFacilityArea,
  MANAGEMENT_OFFICE_FACILITY,
} from "@/lib/stationFacility";

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
    stationNames,
    visitGroupId,
    facilityArea,
    additionalFacilityAreas,
    maintenanceVisitTargets,
    managementOffice,
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

  const namesList = Array.isArray(stationNames)
    ? stationNames.map((s: string) => String(s).trim()).filter(Boolean)
    : [];
  const primaryStation =
    namesList[0] ?? String(stationName ?? "").trim();

  if (!primaryStation) {
    return NextResponse.json(
      { error: "역사명을 선택하거나 입력해 주세요." },
      { status: 400 }
    );
  }

  const facility = String(facilityArea).trim();
  if (!facility || !isWorkFacilityArea(facility)) {
    return NextResponse.json(
      { error: "작업 장소를 선택해 주세요." },
      { status: 400 }
    );
  }

  if (
    facility === MANAGEMENT_OFFICE_FACILITY &&
    !String(managementOffice ?? "").trim()
  ) {
    return NextResponse.json(
      { error: "유지보수 용역 시 전기관리소를 선택해 주세요." },
      { status: 400 }
    );
  }

  if (!processingRole?.trim()) {
    return NextResponse.json(
      { error: "공종을 선택해 주세요." },
      { status: 400 }
    );
  }

  const role = String(processingRole).trim();
  const visitTargets = Array.isArray(maintenanceVisitTargets)
    ? maintenanceVisitTargets
    : [];
  const extraFacilities = Array.isArray(additionalFacilityAreas)
    ? additionalFacilityAreas.map((a: string) => String(a).trim())
    : [];
  const allFacilities =
    visitTargets.length > 0
      ? visitTargets.map((t: { facility: string }) => String(t.facility).trim())
      : namesList.length > 1
        ? [facility, ...extraFacilities.slice(0, namesList.length - 1)]
        : [facility];
  if (visitTargets.length === 0 && namesList.length > 1) {
    for (let i = 0; i < namesList.length; i++) {
      const f = allFacilities[i] ?? "";
      if (!f || !isWorkFacilityArea(f)) {
        return NextResponse.json(
          { error: "각 역사마다 작업 장소를 선택해 주세요." },
          { status: 400 }
        );
      }
    }
  }
  if (
    visitTargets.length > 0 || namesList.length > 1
      ? !isProcessingRoleAllowedForFacilities(role, allFacilities)
      : !isProcessingRoleAllowedForFacility(role, facility)
  ) {
    return NextResponse.json(
      {
        error:
          namesList.length > 1
            ? "선택한 모든 역사의 작업 장소에 맞는 공종을 선택해 주세요."
            : `${facility}에 맞지 않는 공종입니다. 작업 장소별 공종 목록에서 선택해 주세요.`,
      },
      { status: 400 }
    );
  }

  const existing = await getReport(memberId, date);

  const groupId =
    namesList.length > 1
      ? (visitGroupId as string | undefined) ?? createVisitGroupId()
      : (visitGroupId as string | undefined);

  const report = await upsertReport(memberId, date, {
    stationName: primaryStation,
    stationNames: namesList.length > 1 ? namesList : undefined,
    visitGroupId: groupId,
    facilityArea: facility,
    additionalFacilityAreas:
      namesList.length > 1
        ? allFacilities.slice(1)
        : undefined,
    maintenanceVisitTargets: Array.isArray(maintenanceVisitTargets)
      ? maintenanceVisitTargets
      : undefined,
    managementOffice: String(managementOffice ?? "").trim() || undefined,
    processingRole: role,
    done: done ?? "",
    plan: plan ?? "",
    issues: issues ?? "",
    deficiencies: deficiencies ?? "",
    beforePhotoAt: beforePhotoAt ?? existing?.beforePhotoAt,
    afterPhotoAt: afterPhotoAt ?? existing?.afterPhotoAt,
  });

  return NextResponse.json({ report });
}
