"use client";

import { useMemo } from "react";
import type { DailyReport, Member, ScheduleEntry } from "@/lib/types";
import { weekdayLabel } from "@/lib/dates";
import { formatCalendarHolidayDisplay } from "@/lib/koreanHolidays";
import { isTimeOffFacility } from "@/lib/scheduleKinds";
import {
  MANAGEMENT_OFFICE_FACILITY,
  OFFICE_WORK_FACILITY,
  formatStationVisitLabel,
} from "@/lib/stationFacility";
import {
  cohortMemberIdsForVisit,
  findCohortCoverage,
  formatCohortMemberLabel,
  isScheduleDayComplete,
} from "@/lib/visitCohort";
import { shortStationLabel } from "@/lib/visitGroup";

export type CellStatus = "empty" | "timeoff" | "done" | "peer" | "pending";

export interface WeekTeamRosterProps {
  members: Member[];
  days: string[];
  schedules: ScheduleEntry[];
  reports: DailyReport[];
  memberNameById: Map<string, string>;
  holidaysByDate: Map<string, string>;
  today: string;
  onAdd: (date: string, memberId: string) => void;
  onScheduleClick: (schedule: ScheduleEntry) => void;
  onEdit: (schedule: ScheduleEntry) => void;
  onDelete: (id: string) => void;
}

function reportHasContent(r: DailyReport): boolean {
  return Boolean(
    r.stationName?.trim() ||
      r.processingRole?.trim() ||
      r.done?.trim() ||
      r.plan?.trim() ||
      r.hasBeforePhoto ||
      r.hasAfterPhoto
  );
}

function scheduleKind(
  s: ScheduleEntry
): "timeoff" | "maintenance" | "office" | "field" {
  if (isTimeOffFacility(s.facilityArea)) return "timeoff";
  if (s.facilityArea === MANAGEMENT_OFFICE_FACILITY) return "maintenance";
  if (s.facilityArea === OFFICE_WORK_FACILITY) return "office";
  return "field";
}

function compactLabel(s: ScheduleEntry): string {
  const kind = scheduleKind(s);
  if (kind === "timeoff") {
    return s.facilityArea?.trim() ?? "휴무";
  }
  if (kind === "maintenance") {
    const office = s.managementOffice?.trim();
    if (office) return `유지보수·${office}`;
    const st = s.stationName ? shortStationLabel(s.stationName) : "";
    return st ? `유지보수·${st}` : "유지보수";
  }
  if (kind === "office") {
    const st = s.stationName ? shortStationLabel(s.stationName) : "";
    return st ? `사무·${st}` : "사무";
  }
  if (s.stationName?.trim()) {
    return formatStationVisitLabel(s.stationName, s.facilityArea);
  }
  const parts = s.title?.split("-").filter(Boolean) ?? [];
  if (parts.length >= 2) {
    return `${parts[parts.length - 2] ?? ""}·${parts[parts.length - 1] ?? ""}`;
  }
  return s.title?.trim() || "현장";
}

function kindClass(kind: ReturnType<typeof scheduleKind>): string {
  switch (kind) {
    case "timeoff":
      return "week-roster-chip--timeoff";
    case "maintenance":
      return "week-roster-chip--maintenance";
    case "office":
      return "week-roster-chip--office";
    default:
      return "week-roster-chip--field";
  }
}

function statusForSchedule(
  s: ScheduleEntry,
  schedules: ScheduleEntry[],
  reports: DailyReport[],
  memberNameById: Map<string, string>
): CellStatus {
  if (isTimeOffFacility(s.facilityArea)) return "timeoff";
  const report = reports.find(
    (r) => r.memberId === s.memberId && r.date === s.date
  );
  const complete = isScheduleDayComplete(
    s.memberId,
    s.date,
    report,
    schedules,
    reports,
    memberNameById,
    s
  );
  if (!complete) return "pending";
  if (
    report &&
    !reportHasContent(report) &&
    findCohortCoverage(s.memberId, s.date, schedules, reports, memberNameById)
  ) {
    return "peer";
  }
  return "done";
}

function statusDotClass(status: CellStatus): string {
  switch (status) {
    case "done":
      return "bg-emerald-500";
    case "peer":
      return "bg-violet-500";
    case "pending":
      return "bg-amber-400";
    case "timeoff":
      return "bg-rose-400";
    default:
      return "bg-transparent";
  }
}

function statusLabel(status: CellStatus): string {
  switch (status) {
    case "done":
      return "기록";
    case "peer":
      return "동행";
    case "pending":
      return "미작성";
    case "timeoff":
      return "휴무";
    default:
      return "";
  }
}

export function WeekTeamRoster({
  members,
  days,
  schedules,
  reports,
  memberNameById,
  holidaysByDate,
  today,
  onAdd,
  onScheduleClick,
  onEdit,
  onDelete,
}: WeekTeamRosterProps) {
  const schedulesByKey = useMemo(() => {
    const m = new Map<string, ScheduleEntry[]>();
    for (const s of schedules) {
      const key = `${s.memberId}:${s.date}`;
      const list = m.get(key) ?? [];
      list.push(s);
      m.set(key, list);
    }
    return m;
  }, [schedules]);

  return (
    <div className="week-roster overflow-x-auto">
      <table className="week-roster-table w-full min-w-[640px] border-collapse text-left">
        <thead>
          <tr>
            <th className="week-roster-corner sticky left-0 z-20 w-[5.5rem] min-w-[5.5rem] bg-slate-50 px-2 py-2 text-xs font-semibold text-slate-500">
              팀원
            </th>
            {days.map((date) => {
              const isToday = date === today;
              const holidayName = holidaysByDate.get(date);
              const holidayDisplay = holidayName
                ? formatCalendarHolidayDisplay(holidayName)
                : null;
              return (
                <th
                  key={date}
                  className={`week-roster-day min-w-[7.5rem] px-1.5 py-2 text-center align-bottom ${
                    holidayName
                      ? "bg-rose-50/80"
                      : isToday
                        ? "bg-indigo-50/90"
                        : "bg-slate-50/60"
                  }`}
                >
                  <p
                    className={`text-[11px] font-bold ${
                      holidayName ? "text-rose-700" : "text-indigo-600"
                    }`}
                  >
                    {weekdayLabel(date)}
                  </p>
                  <p className="text-sm font-semibold text-slate-900">
                    {date.slice(5).replace("-", "/")}
                  </p>
                  {holidayDisplay ? (
                    <p
                      className="mx-auto mt-0.5 max-w-[6.5rem] truncate text-[10px] font-medium text-rose-800"
                      title={holidayDisplay.fullName}
                    >
                      {holidayDisplay.shortLabel}
                    </p>
                  ) : (
                    <span className="block h-3" aria-hidden />
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {members.map((member) => (
            <tr key={member.id} className="week-roster-row border-t border-slate-100">
              <th
                scope="row"
                className="week-roster-member sticky left-0 z-10 bg-white px-2 py-2 text-left align-top"
              >
                <span className="text-sm font-semibold text-slate-900">
                  {member.name.replace(/\s+(과장|대리|사원)$/, "")}
                </span>
              </th>
              {days.map((date) => {
                const key = `${member.id}:${date}`;
                const cellSchedules = schedulesByKey.get(key) ?? [];
                const isToday = date === today;

                if (cellSchedules.length === 0) {
                  return (
                    <td
                      key={key}
                      className={`week-roster-cell week-roster-cell--empty p-1 align-top ${
                        isToday ? "bg-indigo-50/30" : ""
                      }`}
                    >
                      <button
                        type="button"
                        className="flex h-full min-h-[3.25rem] w-full items-center justify-center rounded-lg border border-dashed border-slate-200 text-[11px] text-slate-400 hover:border-indigo-300 hover:bg-indigo-50/50 hover:text-indigo-600"
                        onClick={() => onAdd(date, member.id)}
                      >
                        +
                      </button>
                    </td>
                  );
                }

                return (
                  <td
                    key={key}
                    className={`week-roster-cell p-1 align-top ${
                      isToday ? "bg-indigo-50/30" : ""
                    }`}
                  >
                    <div className="flex min-h-[3.25rem] flex-col gap-1">
                      {cellSchedules.map((s) => {
                        const kind = scheduleKind(s);
                        const status = statusForSchedule(
                          s,
                          schedules,
                          reports,
                          memberNameById
                        );
                        const cohortIds =
                          s.visitGroupId && s.date
                            ? cohortMemberIdsForVisit(
                                schedules,
                                s.date,
                                s.visitGroupId
                              )
                            : [];
                        const cohortLabel =
                          cohortIds.length > 1
                            ? formatCohortMemberLabel(
                                cohortIds,
                                memberNameById
                              )
                            : "";

                        return (
                          <div
                            key={s.id}
                            className={`week-roster-chip group ${kindClass(kind)}`}
                          >
                            <button
                              type="button"
                              className="flex w-full items-start gap-1.5 px-2 py-1.5 text-left"
                              onClick={() => onScheduleClick(s)}
                            >
                              <span
                                className={`mt-1 h-2 w-2 shrink-0 rounded-full ${statusDotClass(status)}`}
                                title={statusLabel(status)}
                              />
                              <span className="min-w-0 flex-1">
                                <span className="line-clamp-2 text-[11px] font-semibold leading-snug text-slate-900">
                                  {compactLabel(s)}
                                </span>
                                {cohortLabel ? (
                                  <span className="mt-0.5 block text-[10px] text-violet-700">
                                    동행 {cohortLabel}
                                  </span>
                                ) : null}
                              </span>
                            </button>
                            <div className="flex gap-2 border-t border-slate-100/80 px-2 py-0.5 opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100">
                              <button
                                type="button"
                                className="text-[10px] text-slate-500 hover:text-indigo-600"
                                onClick={() => onEdit(s)}
                              >
                                수정
                              </button>
                              <button
                                type="button"
                                className="text-[10px] text-red-600 hover:text-red-700"
                                onClick={() => void onDelete(s.id)}
                              >
                                삭제
                              </button>
                            </div>
                          </div>
                        );
                      })}
                      <button
                        type="button"
                        className="rounded-md py-0.5 text-center text-[10px] font-medium text-indigo-600 hover:bg-indigo-50"
                        onClick={() => onAdd(date, member.id)}
                      >
                        + 추가
                      </button>
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
