import { buildMaintenanceScheduleTitleFromTargets } from "@/lib/maintenanceSchedule";
import { buildScheduleTitle } from "@/lib/scheduleTitle";
import {
  deleteAutoSyncedSchedulesForMemberDate,
  deleteAutoSyncedSchedulesForSlots,
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

export type VisitSlot = { station: string; facility: string };

export function visitSlotsFromReport(report: DailyReport): VisitSlot[] {
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

export interface SyncSchedulesOptions {
  /** 지정 시 해당 역·장소 일정만 갱신 (다른 역 일정 유지) */
  syncSlots?: VisitSlot[];
  /** 일정에 묶을 방문 그룹 id (캘린더에서 넘어온 값) */
  visitGroupId?: string;
}

/** 일일 기록 저장 후 외근·유지보수 일정 자동 반영 */
export async function syncSchedulesFromReport(
  memberId: string,
  date: string,
  report: DailyReport,
  options?: SyncSchedulesOptions
): Promise<ScheduleEntry[]> {
  if (isTimeOffFacility(report.facilityArea)) return [];
  if (report.facilityArea === OFFICE_WORK_FACILITY) return [];

  const allSlots = visitSlotsFromReport(report);
  const slotsToSync =
    options?.syncSlots?.length ? options.syncSlots : allSlots;

  const visitGroupId = report.visitGroupId?.trim() || undefined;
  const partialSync = Boolean(options?.syncSlots?.length);

  if (partialSync) {
    await deleteAutoSyncedSchedulesForSlots(memberId, date, slotsToSync);
  } else if (visitGroupId) {
    await deleteSchedulesByVisitGroup(date, visitGroupId);
  } else if (slotsToSync.length) {
    await deleteAutoSyncedSchedulesForSlots(memberId, date, slotsToSync);
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

  if (!slotsToSync.length) return [];

  const created: ScheduleEntry[] = [];
  const gid =
    options?.visitGroupId?.trim() ||
    visitGroupId ||
    (slotsToSync.length > 1 && !partialSync ? createVisitGroupId() : undefined);
  for (const { station, facility } of slotsToSync) {
    const schedule = await upsertSchedule({
      date,
      memberId,
      title: buildScheduleTitle(station, facility, note),
      stationName: station,
      facilityArea: facility,
      note: note || undefined,
      visitGroupId: gid ?? createVisitGroupId(),
    });
    created.push(schedule);
  }
  return created;
}
