import { NextRequest, NextResponse } from "next/server";
import {
  getMembers,
  getReport,
  getReportsInRange,
  getScheduleById,
  getSchedulesInRange,
  syncSchedulesFromOfficeWork,
  upsertReport,
  visitGroupIdFromSchedules,
} from "@/lib/db";
import { mergeFieldVisitSave } from "@/lib/reportVisitMerge";
import {
  syncSchedulesFromReport,
  type VisitSlot,
} from "@/lib/syncSchedulesFromReport";
import {
  filledOfficeWorkEntries,
  summarizeOfficeWorkRoles,
  type OfficeWorkEntry,
} from "@/lib/officeWork";
import {
  findCohortCoverage,
  reportHasMeaningfulContent,
} from "@/lib/visitCohort";
import { createVisitGroupId } from "@/lib/visitGroup";
import {
  isProcessingRoleAllowedForFacilities,
  isProcessingRoleAllowedForFacility,
  isWorkFacilityArea,
  MANAGEMENT_OFFICE_FACILITY,
  OFFICE_WORK_FACILITY,
  parseStationFacilityAreas,
} from "@/lib/stationFacility";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const start = searchParams.get("start");
  const end = searchParams.get("end");
  const memberId = searchParams.get("memberId");
  const date = searchParams.get("date");

  if (date && memberId) {
    const report = await getReport(memberId, date);
    const schedules = await getSchedulesInRange(date, date);
    const reports = await getReportsInRange(date, date);
    const memberNameById = new Map<string, string>();
    const members = await getMembers();
    for (const m of members) memberNameById.set(m.id, m.name);
    const cohortCoverage = findCohortCoverage(
      memberId,
      date,
      schedules,
      reports,
      memberNameById
    );
    const visitGroupId =
      report?.visitGroupId?.trim() ??
      visitGroupIdFromSchedules(schedules, memberId, date);
    return NextResponse.json({
      report,
      visitGroupId,
      cohortCoverage,
      ownReportComplete: report ? reportHasMeaningfulContent(report) : false,
    });
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
    scheduleId,
    facilityArea,
    additionalFacilityAreas,
    maintenanceVisitTargets,
    maintenancePlannedTargets,
    maintenanceDeficienciesByStation,
    officeWorkEntries,
    officeWorkVisitedStations,
    managementOffice,
    processingRole,
    done,
    plan,
    nextWeekPlan,
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

  let facility = String(facilityArea).trim();
  const rawOfficeEntries = Array.isArray(officeWorkEntries)
    ? (officeWorkEntries as OfficeWorkEntry[])
    : [];
  const officeEntries = filledOfficeWorkEntries(rawOfficeEntries);
  const isOfficeWork =
    facility === OFFICE_WORK_FACILITY || officeEntries.length > 0;

  if (isOfficeWork) {
    facility = OFFICE_WORK_FACILITY;
    if (!officeEntries.length) {
      const hasVisited = Array.isArray(officeWorkVisitedStations)
        ? officeWorkVisitedStations.some((s) => String(s).trim())
        : false;
      return NextResponse.json(
        {
          error: hasVisited
            ? "체크한 역사·공종별로 작업 내용을 최소 1건 입력해 주세요."
            : "역 작업이 없을 때는 AI를 통한 자동화 작업 내용을 입력해 주세요.",
        },
        { status: 400 }
      );
    }
    const bodyStation = String(stationName ?? "").trim();
    const bodyStationNames = Array.isArray(stationNames)
      ? stationNames.map((s: string) => String(s).trim()).filter(Boolean)
      : [];
    const primaryStation =
      bodyStation ||
      bodyStationNames[0] ||
      officeEntries.find((e) => e.station.trim())?.station ||
      "";
    const visitedList = Array.isArray(officeWorkVisitedStations)
      ? officeWorkVisitedStations.map((s) => String(s).trim()).filter(Boolean)
      : [];
    const summaryDone = officeEntries
      .map((e) => `【${e.station} · ${e.processingRole}】\n${e.done.trim()}`)
      .join("\n\n");
    const existing = await getReport(memberId, date);
    const report = await upsertReport(memberId, date, {
      stationName: primaryStation,
      stationNames:
        bodyStationNames.length > 1
          ? bodyStationNames
          : visitedList.length > 1
            ? visitedList
            : undefined,
      facilityArea: OFFICE_WORK_FACILITY,
      officeWorkEntries: officeEntries,
      officeWorkVisitedStations: visitedList.length ? visitedList : undefined,
      processingRole: summarizeOfficeWorkRoles(officeEntries),
      done: summaryDone,
      plan: plan ?? "",
      nextWeekPlan: nextWeekPlan?.trim()
        ? String(nextWeekPlan).trim()
        : undefined,
      issues: issues ?? "",
      deficiencies: deficiencies ?? "",
      beforePhotoAt: beforePhotoAt ?? existing?.beforePhotoAt,
      afterPhotoAt: afterPhotoAt ?? existing?.afterPhotoAt,
    });
    const schedules = await syncSchedulesFromOfficeWork(
      memberId,
      date,
      officeEntries
    );
    return NextResponse.json({ report, schedules });
  }

  if (!facility || !isWorkFacilityArea(facility)) {
    return NextResponse.json(
      { error: "작업 장소를 선택해 주세요." },
      { status: 400 }
    );
  }

  const visitTargets = Array.isArray(maintenanceVisitTargets)
    ? maintenanceVisitTargets
    : [];
  const isMaintenance = facility === MANAGEMENT_OFFICE_FACILITY;
  const visitedStationNames = visitTargets
    .map((t: { station?: string }) => String(t.station ?? "").trim())
    .filter(Boolean);
  const uniqueVisited = [...new Set(visitedStationNames)];
  const primaryStation =
    (isMaintenance && uniqueVisited[0]) ||
    namesList[0] ||
    String(stationName ?? "").trim();

  if (!primaryStation) {
    return NextResponse.json(
      { error: "역사명을 선택하거나 입력해 주세요." },
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
  const extraFacilities = Array.isArray(additionalFacilityAreas)
    ? additionalFacilityAreas.map((a: string) => String(a).trim())
    : [];
  const allFacilities =
    visitTargets.length > 0
      ? visitTargets.map((t: { facility: string }) => String(t.facility).trim())
      : namesList.length > 1
        ? (() => {
            const list = parseStationFacilityAreas(facility, extraFacilities);
            return namesList.map((_, i) => list[i] ?? "").filter(Boolean);
          })()
        : parseStationFacilityAreas(facility, extraFacilities);
  if (visitTargets.length === 0 && namesList.length > 1) {
    for (let i = 0; i < namesList.length; i++) {
      const f = allFacilities[i] ?? "";
      if (!f || !isWorkFacilityArea(f)) {
        return NextResponse.json(
          { error: "각 역사마다 작업 장소를 1곳 이상 선택해 주세요." },
          { status: 400 }
        );
      }
    }
  } else if (
    visitTargets.length === 0 &&
    !allFacilities.length &&
    !isOfficeWork
  ) {
    return NextResponse.json(
      { error: "작업 장소를 1곳 이상 선택해 주세요." },
      { status: 400 }
    );
  }
  if (
    visitTargets.length > 0 || allFacilities.length > 1 || namesList.length > 1
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
  const linkedSchedule = String(scheduleId ?? "").trim()
    ? await getScheduleById(String(scheduleId).trim())
    : undefined;

  const daySchedules = await getSchedulesInRange(date, date);
  const scheduleGroupId = visitGroupIdFromSchedules(daySchedules, memberId, date);
  const isSingleFieldVisit =
    !isMaintenance && visitTargets.length === 0 && namesList.length <= 1;
  const groupId =
    (visitGroupId as string | undefined)?.trim() ||
    linkedSchedule?.visitGroupId?.trim() ||
    scheduleGroupId ||
    (namesList.length > 1 ? createVisitGroupId() : undefined) ||
    (isSingleFieldVisit ? createVisitGroupId() : undefined);

  let upsertPayload = {
    stationName: primaryStation,
    stationNames: namesList.length > 1 ? namesList : undefined,
    visitGroupId: groupId,
    facilityArea: facility,
    additionalFacilityAreas:
      namesList.length > 1
        ? allFacilities.slice(1).filter(Boolean)
        : allFacilities.length > 1
          ? allFacilities.slice(1)
          : undefined,
    maintenanceVisitTargets: visitTargets.length ? visitTargets : undefined,
    maintenancePlannedTargets: Array.isArray(maintenancePlannedTargets)
      ? maintenancePlannedTargets
      : undefined,
    maintenanceDeficienciesByStation: Array.isArray(
      maintenanceDeficienciesByStation
    )
      ? maintenanceDeficienciesByStation
      : undefined,
    managementOffice: String(managementOffice ?? "").trim() || undefined,
    processingRole: role,
    done: done ?? "",
    plan: plan ?? "",
    nextWeekPlan: nextWeekPlan?.trim() ? String(nextWeekPlan).trim() : undefined,
    issues: issues ?? "",
    deficiencies: deficiencies ?? "",
    beforePhotoAt: isMaintenance
      ? undefined
      : (beforePhotoAt ?? existing?.beforePhotoAt),
    afterPhotoAt: isMaintenance
      ? undefined
      : (afterPhotoAt ?? existing?.afterPhotoAt),
  };

  if (existing && isSingleFieldVisit && primaryStation) {
    const merged = mergeFieldVisitSave(existing, {
      stationName: primaryStation,
      facilityArea: facility,
      processingRole: role,
      done: done ?? "",
      plan: plan ?? "",
      nextWeekPlan: nextWeekPlan?.trim()
        ? String(nextWeekPlan).trim()
        : undefined,
      issues: issues ?? "",
      deficiencies: deficiencies ?? "",
      beforePhotoAt: upsertPayload.beforePhotoAt,
      afterPhotoAt: upsertPayload.afterPhotoAt,
      visitGroupId: groupId,
    });
    upsertPayload = {
      ...upsertPayload,
      stationName: merged.stationName,
      stationNames: undefined,
      facilityArea: merged.facilityArea as typeof facility,
      additionalFacilityAreas: merged.additionalFacilityAreas as
        | typeof upsertPayload.additionalFacilityAreas
        | undefined,
      done: merged.done,
      plan: merged.plan ?? "",
      nextWeekPlan: merged.nextWeekPlan,
      issues: merged.issues ?? "",
      deficiencies: merged.deficiencies ?? "",
      beforePhotoAt: merged.beforePhotoAt,
      afterPhotoAt: merged.afterPhotoAt,
      visitGroupId: merged.visitGroupId,
    };
  }

  const report = await upsertReport(memberId, date, upsertPayload);

  const syncSlots: VisitSlot[] | undefined =
    isSingleFieldVisit && primaryStation
      ? [
          {
            station: primaryStation,
            facility: allFacilities[0] ?? facility,
          },
        ]
      : undefined;

  const syncedSchedules = await syncSchedulesFromReport(memberId, date, report, {
    syncSlots,
    visitGroupId: linkedSchedule?.visitGroupId?.trim() || groupId,
  });

  return NextResponse.json({ report, schedules: syncedSchedules });
}
