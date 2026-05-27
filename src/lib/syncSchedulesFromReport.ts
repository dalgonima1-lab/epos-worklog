import { buildMaintenanceScheduleTitleFromTargets } from "@/lib/maintenanceSchedule";
import { buildScheduleTitle } from "@/lib/scheduleTitle";
import {
  deleteAutoSyncedSchedulesForMemberDate,
  deleteSchedulesByVisitGroup,
  upsertSchedule,
} from "@/lib/db";
import { uniqueStationsFromTargets } from "@/lib/maintenanceVisit";
import { isTimeOffFacility } from "@/lib/scheduleKinds";
import {
  MANAGEMENT_OFFICE_FACILITY,
  OFFICE_WORK_FACILITY,
  parseStationFacilityAreas,
  type StationFacilityArea,
} from "@/lib/stationFacility";
import type { MaintenanceVisitTarget } from "@/lib/maintenanceVisit";
import { createVisitGroupId } from "@/lib/visitGroup";
import type { DailyReport, ScheduleEntry } from "@/lib/types";

function visitSlotsFromReport(report: DailyReport): {
  station: string;
  facility: string;
}[] {
  const primary = report.stationName?.trim() ?? "";
  if (!primary) return [];

  const additional = report.additionalStationNames ?? [];
  const facilities = parseStationFacilityAreas(
    report.facilityArea,
    report.additionalFacilityAreas
  );
  if (!facilities.length) return [];

  const stations =
    additional.length > 0 ? [primary, ...additional] : [primary];

  if (stations.length === 1) {
    return facilities.map((facility) => ({ station: primary, facility }));
  }

  return stations
    .map((station, i) => ({
      station,
      facility: facilities[i] ?? facilities[0]!,
    }))
    .filter((s) => s.facility);
}

/** 일일 기록 저장 후 외근·유지보수 일정 자동 반영 */
export async function syncSchedulesFromReport(
  memberId: string,
  date: string,
  report: DailyReport
): Promise<ScheduleEntry[]> {
  if (isTimeOffFacility(report.facilityArea)) return [];
  if (report.facilityArea === OFFICE_WORK_FACILITY) return [];

  const visitGroupId = report.visitGroupId?.trim() || undefined;
  if (visitGroupId) {
    await deleteSchedulesByVisitGroup(date, visitGroupId);
  } else {
    await deleteAutoSyncedSchedulesForMemberDate(memberId, date);
  }

  const note = report.done?.trim() || report.plan?.trim() || "";

  if (report.facilityArea === MANAGEMENT_OFFICE_FACILITY) {
    const office = report.managementOffice?.trim() ?? "";
    const targets = (report.maintenanceVisitTargets ?? []) as MaintenanceVisitTarget[];
    const stations = uniqueStationsFromTargets(targets);
    const title = buildMaintenanceScheduleTitleFromTargets(
      office,
      targets,
      note || "정기점검"
    );
    const schedule = await upsertSchedule({
      date,
      memberId,
      title,
      stationName: stations[0],
      maintenanceStationNames: stations.length ? stations : undefined,
      maintenanceVisitTargets: targets.length ? targets : undefined,
      facilityArea: MANAGEMENT_OFFICE_FACILITY,
      managementOffice: office || undefined,
      note: note || undefined,
      visitGroupId,
    });
    return [schedule];
  }

  const slots = visitSlotsFromReport(report);
  if (!slots.length) return [];

  const created: ScheduleEntry[] = [];
  const gid =
    visitGroupId || (slots.length > 1 ? createVisitGroupId() : undefined);
  for (const { station, facility } of slots) {
    const schedule = await upsertSchedule({
      date,
      memberId,
      title: buildScheduleTitle(station, facility, note),
      stationName: station,
      facilityArea: facility,
      note: note || undefined,
      visitGroupId: gid,
    });
    created.push(schedule);
  }
  return created;
}
