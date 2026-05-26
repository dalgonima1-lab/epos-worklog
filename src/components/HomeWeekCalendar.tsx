"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  formatDate,
  getWeekRange,
  shiftWeek,
  weekdayLabel,
  weekdaysBetween,
} from "@/lib/dates";
import { StationPicker } from "@/components/StationPicker";
import { isSecurityTestPlaceholder } from "@/lib/sanitizeTestData";
import {
  buildMaintenanceSelectionsForOffice,
  getMaintenancePlanStationDisplaysForOffice,
  maintenanceSelectionsFromStationDisplays,
} from "@/lib/maintenancePlan";
import {
  buildMaintenanceScheduleTitleFromTargets,
  encodeMaintenanceStationNames,
  encodeMaintenanceVisitTargets,
} from "@/lib/maintenanceSchedule";
import {
  uniqueStationsFromTargets,
  type MaintenanceVisitTarget,
} from "@/lib/maintenanceVisit";
import { getKoreanHolidayName, type KoreanHoliday } from "@/lib/koreanHolidays";
import { buildScheduleTitle } from "@/lib/scheduleTitle";
import {
  ANNUAL_LEAVE_FACILITY,
  defaultTimeOffTitle,
  isTimeOffFacility,
  PUBLIC_HOLIDAY_FACILITY,
  scheduleFormKindFromFacility,
  type ScheduleFormKind,
} from "@/lib/scheduleKinds";
import { createVisitGroupId } from "@/lib/visitGroup";
import {
  cohortMemberIdsForVisit,
  fieldMembers,
  findCohortCoverage,
  formatCohortMemberLabel,
  isScheduleDayComplete,
} from "@/lib/visitCohort";
import {
  formatStationVisitLabel,
  isStationFacilityArea,
  MANAGEMENT_OFFICE_FACILITY,
  type StationFacilityArea,
} from "@/lib/stationFacility";
import type { DailyReport, Member, ScheduleEntry } from "@/lib/types";

type WeekTab = -1 | 0 | 1;

const WEEK_TABS: { offset: WeekTab; label: string }[] = [
  { offset: -1, label: "저번주" },
  { offset: 0, label: "이번주" },
  { offset: 1, label: "다음주" },
];

interface HomeWeekCalendarProps {
  teamName: string;
}

function reportHasContent(r: DailyReport): boolean {
  if (isSecurityTestPlaceholder(r.stationName ?? "")) {
    return Boolean(
      r.processingRole?.trim() ||
        r.done?.trim() ||
        r.plan?.trim() ||
        r.hasBeforePhoto ||
        r.hasAfterPhoto
    );
  }
  return Boolean(
    r.stationName?.trim() ||
      r.processingRole?.trim() ||
      r.done?.trim() ||
      r.plan?.trim() ||
      r.hasBeforePhoto ||
      r.hasAfterPhoto
  );
}

export function HomeWeekCalendar({ teamName }: HomeWeekCalendarProps) {
  const router = useRouter();
  const [weekTab, setWeekTab] = useState<WeekTab>(0);
  const [anchor] = useState(() => new Date());
  const [members, setMembers] = useState<Member[]>([]);
  const [schedules, setSchedules] = useState<ScheduleEntry[]>([]);
  const [reports, setReports] = useState<DailyReport[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ScheduleEntry | null>(null);
  const [formDate, setFormDate] = useState(formatDate(new Date()));
  const [formMemberId, setFormMemberId] = useState("");
  const [formStation, setFormStation] = useState("");
  const [formFacilityArea, setFormFacilityArea] = useState<
    StationFacilityArea | typeof MANAGEMENT_OFFICE_FACILITY | ""
  >("");
  const [formWorkContent, setFormWorkContent] = useState("");
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [managementOffice, setManagementOffice] = useState("");
  const [multiStationMode, setMultiStationMode] = useState(false);
  const [selectedStations, setSelectedStations] = useState<string[]>([]);
  const [stationFacilityByStation, setStationFacilityByStation] = useState<
    Record<string, StationFacilityArea | "">
  >({});
  const [maintenanceSelections, setMaintenanceSelections] = useState<
    MaintenanceVisitTarget[]
  >([]);
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [weekHolidays, setWeekHolidays] = useState<KoreanHoliday[]>([]);
  const [formScheduleKind, setFormScheduleKind] =
    useState<ScheduleFormKind>("field");

  const holidaysByDate = useMemo(() => {
    const m = new Map<string, string>();
    for (const h of weekHolidays) m.set(h.date, h.name);
    return m;
  }, [weekHolidays]);

  const formDateHolidayName = useMemo(
    () => getKoreanHolidayName(formDate),
    [formDate]
  );

  const writers = useMemo(() => fieldMembers(members), [members]);

  const weekAnchor = useMemo(
    () => shiftWeek(anchor, weekTab),
    [anchor, weekTab]
  );
  const week = useMemo(() => getWeekRange(weekAnchor), [weekAnchor]);
  const days = useMemo(
    () => weekdaysBetween(week.start, week.end),
    [week.start, week.end]
  );

  const memberNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const mem of members) m.set(mem.id, mem.name);
    return m;
  }, [members]);

  const scheduleTitlePreview = useMemo(() => {
    if (formScheduleKind === "annual_leave") {
      return ANNUAL_LEAVE_FACILITY;
    }
    if (formScheduleKind === "public_holiday") {
      return defaultTimeOffTitle(
        "public_holiday",
        formDateHolidayName ?? formWorkContent
      );
    }
    const stations =
      (maintenanceMode || multiStationMode) && selectedStations.length > 0
        ? selectedStations
        : formStation.trim()
          ? [formStation.trim()]
          : [];
    if (!stations.length) return "";

    const facilityFor = (st: string) =>
      stations.length >= 2
        ? (stationFacilityByStation[st] ?? "")
        : formFacilityArea;

    if (maintenanceMode && managementOffice) {
      return buildMaintenanceScheduleTitleFromTargets(
        managementOffice,
        maintenanceSelections,
        formWorkContent
      );
    }

    const titles = stations
      .map((st) => {
        const area = facilityFor(st);
        if (!area) return "";
        return buildScheduleTitle(st, area, formWorkContent);
      })
      .filter(Boolean);
    return titles.join(" · ");
  }, [
    formStation,
    formFacilityArea,
    formWorkContent,
    maintenanceMode,
    managementOffice,
    maintenanceSelections,
    multiStationMode,
    selectedStations,
    stationFacilityByStation,
    formScheduleKind,
    formDateHolidayName,
  ]);

  const reportByKey = useMemo(() => {
    const m = new Map<string, DailyReport>();
    for (const r of reports) {
      m.set(`${r.memberId}:${r.date}`, r);
    }
    return m;
  }, [reports]);

  const loadWeek = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [schedRes, repRes, holRes] = await Promise.all([
        fetch(
          `/api/schedules?start=${encodeURIComponent(week.start)}&end=${encodeURIComponent(week.end)}`
        ),
        fetch(
          `/api/reports?start=${encodeURIComponent(week.start)}&end=${encodeURIComponent(week.end)}`
        ),
        fetch(
          `/api/holidays?start=${encodeURIComponent(week.start)}&end=${encodeURIComponent(week.end)}`
        ),
      ]);
      const schedData = await schedRes.json();
      const repData = await repRes.json();
      const holData = await holRes.json();
      if (!schedRes.ok) {
        setError(schedData.error ?? "일정을 불러오지 못했습니다.");
        return;
      }
      setSchedules(schedData.schedules ?? []);
      setReports(repData.reports ?? []);
      setWeekHolidays(holRes.ok ? (holData.holidays ?? []) : []);
    } catch {
      setError("네트워크 오류입니다.");
    } finally {
      setLoading(false);
    }
  }, [week.start, week.end]);

  useEffect(() => {
    fetch("/api/members")
      .then((r) => r.json())
      .then((d) => {
        const list = (d.members ?? []) as Member[];
        setMembers(list);
        if (!formMemberId && list.length) {
          setFormMemberId(list[0].id);
        }
      })
      .catch(() => {});
  }, [formMemberId]);

  useEffect(() => {
    void loadWeek();
  }, [loadWeek]);

  function openAdd(date: string) {
    setEditing(null);
    setFormDate(date);
    const holidayName = getKoreanHolidayName(date);
    setFormScheduleKind(holidayName ? "public_holiday" : "field");
    setFormStation("");
    setFormFacilityArea("");
    setFormWorkContent(holidayName ?? "");
    setMaintenanceMode(false);
    setManagementOffice("");
    setMultiStationMode(false);
    setSelectedStations([]);
    setStationFacilityByStation({});
    setMaintenanceSelections([]);
    const first =
      writers[0]?.id ?? members.find((m) => m.role === "member")?.id ?? "";
    if (first) {
      setFormMemberId(first);
      setSelectedMemberIds([first]);
    }
    setModalOpen(true);
  }

  function toggleMemberSelection(id: string) {
    setSelectedMemberIds((prev) => {
      const has = prev.includes(id);
      const next = has ? prev.filter((x) => x !== id) : [...prev, id];
      if (next.length === 0) return prev;
      setFormMemberId(next[0]!);
      return next;
    });
  }

  function resolveMemberIdsForSave(): string[] {
    return selectedMemberIds.length > 0
      ? selectedMemberIds
      : formMemberId.trim()
        ? [formMemberId.trim()]
        : [];
  }

  const cohortMemberLabel = useMemo(() => {
    if (selectedMemberIds.length < 2) return "";
    return formatCohortMemberLabel(selectedMemberIds, memberNameById);
  }, [selectedMemberIds, memberNameById]);

  function openEdit(entry: ScheduleEntry) {
    setEditing(entry);
    setFormDate(entry.date);
    setFormMemberId(entry.memberId);
    if (isTimeOffFacility(entry.facilityArea)) {
      setFormScheduleKind(scheduleFormKindFromFacility(entry.facilityArea));
      setFormWorkContent(entry.note ?? entry.title ?? "");
      setMaintenanceMode(false);
      setManagementOffice("");
      setFormStation("");
      setFormFacilityArea("");
      setSelectedStations([]);
      setMultiStationMode(false);
      setStationFacilityByStation({});
      setMaintenanceSelections([]);
      if (entry.visitGroupId) {
        const cohort = cohortMemberIdsForVisit(
          schedules,
          entry.date,
          entry.visitGroupId
        );
        const ids = cohort.length > 0 ? cohort : [entry.memberId];
        setSelectedMemberIds(ids);
        setFormMemberId(ids[0] ?? entry.memberId);
      } else {
        setSelectedMemberIds([entry.memberId]);
      }
      setModalOpen(true);
      return;
    }
    setFormScheduleKind("field");
    const isMaintenance = entry.facilityArea === MANAGEMENT_OFFICE_FACILITY;
    setMaintenanceMode(isMaintenance);
    setManagementOffice(entry.managementOffice ?? "");
    if (isMaintenance && entry.managementOffice) {
      const planned =
        entry.maintenanceStationNames?.length
          ? entry.maintenanceStationNames
          : getMaintenancePlanStationDisplaysForOffice(entry.managementOffice);
      setSelectedStations(planned);
      setMultiStationMode(planned.length > 0);
      setFormStation(planned[0] ?? "");
      setFormFacilityArea(MANAGEMENT_OFFICE_FACILITY);
      setMaintenanceSelections(
        entry.maintenanceVisitTargets?.length
          ? entry.maintenanceVisitTargets.map((t) => ({
              station: t.station,
              facility: t.facility as StationFacilityArea,
              fromPlan: t.fromPlan !== false,
            }))
          : planned.length
            ? maintenanceSelectionsFromStationDisplays(
                entry.managementOffice,
                planned
              )
            : buildMaintenanceSelectionsForOffice(entry.managementOffice)
      );
    } else {
      setFormStation(entry.stationName ?? "");
      const area = entry.facilityArea?.trim() ?? "";
      setFormFacilityArea(isStationFacilityArea(area) ? area : "");
      setSelectedStations([]);
      setMultiStationMode(false);
    }
    setFormWorkContent(entry.note ?? "");
    setStationFacilityByStation({});
    if (entry.visitGroupId) {
      const cohort = cohortMemberIdsForVisit(
        schedules,
        entry.date,
        entry.visitGroupId
      );
      const ids = cohort.length > 0 ? cohort : [entry.memberId];
      setSelectedMemberIds(ids);
      setFormMemberId(ids[0] ?? entry.memberId);
    } else {
      setSelectedMemberIds([entry.memberId]);
    }
    setModalOpen(true);
  }

  function goDaily(
    date: string,
    memberId: string,
    stationName?: string,
    facilityArea?: string,
    managementOfficeId?: string,
    maintenanceStations?: string[],
    maintenanceTargets?: MaintenanceVisitTarget[]
  ) {
    const q = new URLSearchParams({ date, memberId });
    if (stationName?.trim()) {
      q.set("station", stationName.trim());
    }
    const area = facilityArea?.trim() ?? "";
    if (area === MANAGEMENT_OFFICE_FACILITY) {
      q.set("facility", MANAGEMENT_OFFICE_FACILITY);
    } else if (isStationFacilityArea(area)) {
      q.set("facility", area);
    }
    if (area === MANAGEMENT_OFFICE_FACILITY && managementOfficeId?.trim()) {
      q.set("office", managementOfficeId.trim());
      if (maintenanceTargets?.length) {
        q.set("targets", encodeMaintenanceVisitTargets(maintenanceTargets));
      } else if (maintenanceStations?.length) {
        q.set("stations", encodeMaintenanceStationNames(maintenanceStations));
      }
    }
    router.push(`/daily?${q.toString()}`);
  }

  async function saveSchedule(e: React.FormEvent) {
    e.preventDefault();
    const memberIds = resolveMemberIdsForSave();
    if (!memberIds.length) {
      setError("담당자를 1명 이상 선택해 주세요.");
      return;
    }
    const replaceVisitGroupId = editing?.visitGroupId?.trim() || undefined;

    if (
      formScheduleKind === "annual_leave" ||
      formScheduleKind === "public_holiday"
    ) {
      const facility =
        formScheduleKind === "annual_leave"
          ? ANNUAL_LEAVE_FACILITY
          : PUBLIC_HOLIDAY_FACILITY;
      const holidayName = getKoreanHolidayName(formDate);
      const title = defaultTimeOffTitle(
        formScheduleKind,
        holidayName ?? formWorkContent
      );
      if (!title.trim()) {
        setError("일정 제목을 입력해 주세요.");
        return;
      }
      setSaving(true);
      try {
        const res = await fetch("/api/schedules", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            date: formDate,
            memberIds,
            replaceVisitGroupId,
            id:
              !replaceVisitGroupId && memberIds.length === 1
                ? editing?.id
                : undefined,
            title,
            facilityArea: facility,
            note: formWorkContent.trim() || undefined,
            timeOff: true,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error ?? "저장 실패");
          return;
        }
        setModalOpen(false);
        setError("");
        await loadWeek();
      } catch {
        setError("저장 중 오류가 발생했습니다.");
      } finally {
        setSaving(false);
      }
      return;
    }

    const stations =
      (maintenanceMode || multiStationMode) && selectedStations.length > 0
        ? selectedStations
        : formStation.trim()
          ? [formStation.trim()]
          : [];
    if (maintenanceMode) {
      if (!maintenanceSelections.length) {
        setError("점검 대상(역·기능실)을 1건 이상 선택해 주세요.");
        return;
      }
    } else if (!stations.length) {
      setError("호선과 역사명을 선택해 주세요.");
      return;
    }
    if (maintenanceMode && !managementOffice) {
      setError("유지보수 용역 시 전기관리소를 선택해 주세요.");
      return;
    }
    const facilityForStation = (st: string) =>
      stations.length >= 2 && !maintenanceMode
        ? stationFacilityByStation[st]?.trim()
        : formFacilityArea.trim();

    if (
      !maintenanceMode &&
      stations.some((st) => !facilityForStation(st))
    ) {
      setError(
        stations.length >= 2
          ? "각 역사마다 작업 장소를 선택해 주세요."
          : "작업 장소를 선택해 주세요."
      );
      return;
    }
    if (!formWorkContent.trim()) {
      setError("작업 내용을 입력해 주세요.");
      return;
    }

    if (maintenanceMode && managementOffice) {
      const visitStations = uniqueStationsFromTargets(maintenanceSelections);
      const title = buildMaintenanceScheduleTitleFromTargets(
        managementOffice,
        maintenanceSelections,
        formWorkContent
      );
      setSaving(true);
      try {
        const res = await fetch("/api/schedules", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            date: formDate,
            memberIds,
            replaceVisitGroupId,
            maintenanceBulk: true,
            title,
            stationName: visitStations[0],
            maintenanceStationNames: visitStations,
            maintenanceVisitTargets: maintenanceSelections,
            facilityArea: MANAGEMENT_OFFICE_FACILITY,
            managementOffice,
            note: formWorkContent.trim(),
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error ?? "저장 실패");
          return;
        }
        setModalOpen(false);
        setError("");
        await loadWeek();
      } catch {
        setError("저장 중 오류가 발생했습니다.");
      } finally {
        setSaving(false);
      }
      return;
    }

    const visitGroupId =
      memberIds.length > 1 || stations.length > 1
        ? createVisitGroupId()
        : undefined;
    const titles = stations.map((st) =>
      buildScheduleTitle(st, facilityForStation(st)!, formWorkContent)
    );
    const facilityAreas = stations.map((st) => facilityForStation(st)!);
    setSaving(true);
    try {
      const res = await fetch("/api/schedules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id:
            !replaceVisitGroupId && memberIds.length === 1
              ? editing?.id
              : undefined,
          date: formDate,
          memberIds,
          replaceVisitGroupId,
          title: titles[0],
          titles: stations.length > 1 ? titles : undefined,
          stationNames: stations.length > 1 ? stations : undefined,
          stationName: stations.length === 1 ? stations[0] : undefined,
          visitGroupId,
          facilityArea: facilityAreas[0],
          facilityAreas: stations.length > 1 ? facilityAreas : undefined,
          note: formWorkContent.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "저장 실패");
        return;
      }
      setModalOpen(false);
      setError("");
      await loadWeek();
    } catch {
      setError("저장 중 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  }

  async function removeSchedule(id: string) {
    if (!confirm("이 일정을 삭제할까요?")) return;
    const res = await fetch(`/api/schedules?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    if (res.ok) await loadWeek();
  }

  return (
    <>
      <section className="card overflow-hidden p-0">
        <div className="border-b border-slate-100 bg-gradient-to-r from-indigo-50/90 to-slate-50 px-4 py-4 sm:px-5">
          <h2 className="text-lg font-bold tracking-tight text-slate-900">
            주간 일정
          </h2>
          <p className="muted mt-1 text-sm">
            {teamName} · 일정을 누르면 해당 날짜·담당자의{" "}
            <strong className="text-slate-700">일일 기록</strong>으로 이동합니다.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {WEEK_TABS.map((tab) => (
              <button
                key={tab.offset}
                type="button"
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                  weekTab === tab.offset
                    ? "bg-indigo-600 text-white shadow-md"
                    : "bg-white text-slate-600 ring-1 ring-slate-200 hover:text-indigo-600"
                }`}
                onClick={() => setWeekTab(tab.offset)}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <p className="muted mt-2 text-xs">{week.label}</p>
        </div>

        {error && (
          <p className="px-4 py-2 text-sm text-red-600 sm:px-5">{error}</p>
        )}

        {loading ? (
          <p className="muted px-4 py-8 text-center text-sm sm:px-5">
            불러오는 중…
          </p>
        ) : (
          <div className="grid gap-3 p-3 sm:grid-cols-5 sm:p-4">
            {days.map((date) => {
              const daySchedules = schedules.filter((s) => s.date === date);
              const isToday = date === formatDate(new Date());
              const holidayName = holidaysByDate.get(date);
              return (
                <div
                  key={date}
                  className={`flex min-h-[10rem] flex-col rounded-xl border p-2.5 sm:p-3 ${
                    holidayName
                      ? "border-rose-300 bg-rose-50/50 ring-1 ring-rose-200"
                      : isToday
                        ? "border-indigo-300 bg-indigo-50/50 ring-1 ring-indigo-200"
                        : "border-slate-200 bg-slate-50/60"
                  }`}
                >
                  <div className="mb-2 flex items-center justify-between gap-1">
                    <div>
                      <p
                        className={`text-xs font-bold ${
                          holidayName ? "text-rose-700" : "text-indigo-600"
                        }`}
                      >
                        {weekdayLabel(date)}
                      </p>
                      <p className="text-sm font-semibold text-slate-900">
                        {date.slice(5).replace("-", "/")}
                      </p>
                      {holidayName ? (
                        <p className="mt-0.5 text-[10px] font-semibold text-rose-800">
                          공휴일 · {holidayName}
                        </p>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      className="rounded-lg bg-white px-2 py-1 text-xs font-semibold text-indigo-600 ring-1 ring-indigo-200 hover:bg-indigo-50"
                      onClick={() => openAdd(date)}
                    >
                      + 추가
                    </button>
                  </div>

                  <div className="flex flex-1 flex-col gap-2">
                    {daySchedules.length === 0 ? (
                      <p className="muted flex flex-1 items-center justify-center text-center text-xs">
                        일정 없음
                      </p>
                    ) : (
                      daySchedules.map((s) => {
                        const timeOff = isTimeOffFacility(s.facilityArea);
                        const report = reportByKey.get(
                          `${s.memberId}:${s.date}`
                        );
                        const hasRecord = isScheduleDayComplete(
                          s.memberId,
                          s.date,
                          report,
                          schedules,
                          reports,
                          memberNameById,
                          s
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
                        const coveredByPeer =
                          report &&
                          !reportHasContent(report) &&
                          findCohortCoverage(
                            s.memberId,
                            s.date,
                            schedules,
                            reports,
                            memberNameById
                          );
                        return (
                          <div
                            key={s.id}
                            className={`rounded-lg border p-2 shadow-sm ring-1 ${
                              timeOff
                                ? "border-rose-100 bg-rose-50/90 ring-rose-100"
                                : "border-white bg-white ring-slate-100"
                            }`}
                          >
                            <button
                              type="button"
                              className="w-full text-left"
                              onClick={() => {
                                if (timeOff) {
                                  openEdit(s);
                                  return;
                                }
                                goDaily(
                                  s.date,
                                  s.memberId,
                                  s.stationName,
                                  s.facilityArea,
                                  s.managementOffice,
                                  s.maintenanceStationNames,
                                  s.maintenanceVisitTargets?.map((t) => ({
                                    station: t.station,
                                    facility: t.facility as StationFacilityArea,
                                    fromPlan: t.fromPlan !== false,
                                  }))
                                );
                              }}
                            >
                              <p className="line-clamp-2 text-xs font-bold text-slate-900">
                                {s.title}
                              </p>
                              <p className="mt-0.5 text-[11px] text-slate-600">
                                {memberNameById.get(s.memberId) ?? s.memberId}
                              </p>
                              {timeOff ? (
                                <p className="mt-0.5 text-[11px] font-medium text-rose-800">
                                  {s.facilityArea}
                                  {s.note?.trim() ? ` · ${s.note.trim()}` : ""}
                                </p>
                              ) : s.stationName &&
                                !isSecurityTestPlaceholder(s.stationName) ? (
                                <p className="mt-0.5 text-[11px] text-blue-700">
                                  {formatStationVisitLabel(
                                    s.stationName,
                                    s.facilityArea
                                  )}
                                </p>
                              ) : null}
                              {cohortLabel ? (
                                <p className="mt-0.5 text-[10px] font-medium text-violet-700">
                                  동행 {cohortLabel}
                                </p>
                              ) : null}
                              <span
                                className={`mt-1.5 inline-block rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                                  timeOff
                                    ? "bg-rose-100 text-rose-900"
                                    : hasRecord
                                      ? coveredByPeer
                                        ? "bg-violet-100 text-violet-900"
                                        : "bg-emerald-100 text-emerald-800"
                                      : "bg-slate-100 text-slate-600"
                                }`}
                              >
                                {timeOff
                                  ? "휴무"
                                  : hasRecord
                                    ? coveredByPeer
                                      ? "동행 기록"
                                      : "기록 있음"
                                    : "기록 작성"}
                              </span>
                            </button>
                            <div className="mt-1.5 flex gap-1 border-t border-slate-100 pt-1.5">
                              <button
                                type="button"
                                className="text-[10px] font-medium text-slate-500 hover:text-indigo-600"
                                onClick={() => openEdit(s)}
                              >
                                수정
                              </button>
                              <button
                                type="button"
                                className="text-[10px] font-medium text-red-600 hover:text-red-700"
                                onClick={() => void removeSchedule(s.id)}
                              >
                                삭제
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <Link href="/daily" className="card feature-card block">
          <h2 className="text-base font-bold">일일 기록 바로가기</h2>
          <p className="muted mt-2 text-sm">오늘 날짜로 업무 기록 작성</p>
        </Link>
        <Link href="/manager" className="card feature-card block">
          <h2 className="text-base font-bold">팀장 대시보드</h2>
          <p className="muted mt-2 text-sm">주간 제출 현황·요약 보고서</p>
        </Link>
      </div>

      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
        >
          <button
            type="button"
            className="absolute inset-0"
            aria-label="닫기"
            onClick={() => setModalOpen(false)}
          />
          <form
            className="relative z-10 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-xl"
            onSubmit={(e) => void saveSchedule(e)}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold">
              {editing ? "일정 수정" : "일정 추가"}
            </h3>
            <div className="mt-4 space-y-3">
              <div>
                <label className="label">날짜</label>
                <input
                  type="date"
                  className="input"
                  value={formDate}
                  onChange={(e) => {
                    const next = e.target.value;
                    setFormDate(next);
                    if (formScheduleKind === "public_holiday") {
                      const name = getKoreanHolidayName(next);
                      if (name) setFormWorkContent(name);
                    }
                  }}
                  required
                />
              </div>
              <div>
                <label className="label">담당자</label>
                <p className="muted mb-2 text-xs">
                  팀원을 눌러 선택하세요. <strong>2명 이상</strong>이면 자동으로
                  동행 일정이 됩니다. 한 명만 일일 기록하면 나머지는 추가 기록이
                  필요 없습니다.
                </p>
                <div className="flex flex-wrap gap-2 rounded-lg border border-violet-100 bg-violet-50/50 p-2.5">
                  {writers.map((m) => {
                    const checked = selectedMemberIds.includes(m.id);
                    return (
                      <label
                        key={m.id}
                        className={`inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium ${
                          checked
                            ? "border-violet-500 bg-violet-500 text-white"
                            : "border-slate-200 bg-white text-slate-700"
                        }`}
                      >
                        <input
                          type="checkbox"
                          className="sr-only"
                          checked={checked}
                          disabled={saving}
                          onChange={() => toggleMemberSelection(m.id)}
                        />
                        {m.name}
                      </label>
                    );
                  })}
                </div>
                {cohortMemberLabel ? (
                  <p className="mt-2 text-xs font-semibold text-violet-800">
                    동행: {cohortMemberLabel}
                  </p>
                ) : null}
              </div>
              <div>
                <label className="label">일정 유형</label>
                <div className="flex flex-wrap gap-2">
                  {(
                    [
                      ["field", "현장·사무"],
                      ["annual_leave", "연차"],
                      ["public_holiday", "공휴일"],
                    ] as const
                  ).map(([kind, label]) => (
                    <button
                      key={kind}
                      type="button"
                      disabled={saving}
                      className={`rounded-md border px-3 py-1.5 text-xs font-semibold ${
                        formScheduleKind === kind
                          ? kind === "field"
                            ? "border-indigo-600 bg-indigo-600 text-white"
                            : "border-rose-600 bg-rose-600 text-white"
                          : "border-slate-200 bg-white text-slate-700"
                      }`}
                      onClick={() => {
                        setFormScheduleKind(kind);
                        if (kind === "annual_leave") {
                          setFormWorkContent("");
                          setMaintenanceMode(false);
                        } else if (kind === "public_holiday") {
                          const name = getKoreanHolidayName(formDate);
                          setFormWorkContent(name ?? "");
                        } else {
                          setFormWorkContent("");
                        }
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {formScheduleKind === "public_holiday" && formDateHolidayName ? (
                  <p className="mt-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-950">
                    <strong>{formDate}</strong>은 법정 공휴일(
                    {formDateHolidayName})입니다.
                  </p>
                ) : null}
                {formScheduleKind === "annual_leave" ? (
                  <p className="muted mt-2 text-xs">
                    연차는 일일 기록 없이 휴무 일정으로만 등록됩니다.
                  </p>
                ) : null}
              </div>
              {formScheduleKind === "field" ? (
              <StationPicker
                value={formStation}
                onChange={setFormStation}
                facilityArea={formFacilityArea}
                onFacilityChange={setFormFacilityArea}
                requireFacility
                disabled={saving}
                enableMetroPicker
                enableDirectInput
                multiStationMode={multiStationMode}
                onMultiStationModeChange={setMultiStationMode}
                selectedStations={selectedStations}
                onSelectedStationsChange={setSelectedStations}
                stationFacilityByStation={stationFacilityByStation}
                onStationFacilityByStationChange={setStationFacilityByStation}
                maintenanceSelections={maintenanceSelections}
                onMaintenanceSelectionsChange={setMaintenanceSelections}
                maintenanceMode={maintenanceMode}
                onMaintenanceModeChange={(enabled) => {
                  setMaintenanceMode(enabled);
                  if (enabled) {
                    setFormFacilityArea(MANAGEMENT_OFFICE_FACILITY);
                    setManagementOffice("");
                    setMultiStationMode(false);
                    setSelectedStations([]);
                    setStationFacilityByStation({});
                    setMaintenanceSelections([]);
                    if (!formWorkContent.trim()) {
                      setFormWorkContent("정기점검");
                    }
                  } else {
                    setManagementOffice("");
                    setFormFacilityArea("");
                    setMultiStationMode(false);
                    setSelectedStations([]);
                    setStationFacilityByStation({});
                    setMaintenanceSelections([]);
                  }
                }}
                managementOffice={managementOffice}
                onManagementOfficeChange={setManagementOffice}
              />
              ) : (
              <div>
                <label className="label">
                  {formScheduleKind === "public_holiday"
                    ? "메모 (선택)"
                    : "메모 (선택)"}
                </label>
                <textarea
                  className="textarea min-h-[56px]"
                  placeholder={
                    formScheduleKind === "public_holiday"
                      ? formDateHolidayName
                        ? `기본 제목: ${formDateHolidayName}`
                        : "예: 회사 지정 휴무"
                      : "예: 오전 반차"
                  }
                  value={formWorkContent}
                  onChange={(e) => setFormWorkContent(e.target.value)}
                />
              </div>
              )}
              {formScheduleKind === "field" ? (
              <div>
                <label className="label">
                  작업 내용 <span className="text-red-600">*</span>
                </label>
                <textarea
                  className="textarea min-h-[72px]"
                  placeholder={
                    maintenanceMode
                      ? "예: 정기점검"
                      : "예: 관제 화면 점검, DB 매핑 작업"
                  }
                  value={formWorkContent}
                  required
                  onChange={(e) => setFormWorkContent(e.target.value)}
                />
              </div>
              ) : null}
              {scheduleTitlePreview ? (
                <div className="rounded-lg border border-indigo-200 bg-indigo-50/80 px-3 py-2">
                  <p className="text-xs font-medium text-indigo-900">
                    저장될 일정 제목
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    {scheduleTitlePreview}
                  </p>
                  <p className="muted mt-1 text-[11px]">
                    {formScheduleKind !== "field"
                      ? selectedMemberIds.length > 1
                        ? `선택한 ${selectedMemberIds.length}명에게 휴무 일정이 등록됩니다.`
                        : "휴무 일정으로 등록되며 일일 기록은 필요 없습니다."
                      : maintenanceMode
                        ? selectedMemberIds.length > 1
                          ? `동행 ${selectedMemberIds.length}명에게 관리소 산하 일정 1건씩 저장합니다.`
                          : "유지보수 용역은 관리소 산하 일정 1건으로 저장합니다."
                        : selectedMemberIds.length > 1
                          ? `동행 ${selectedMemberIds.length}명 × 역사별 일정이 생성됩니다.`
                          : "호선 · 역사명 · 작업 장소 · 작업 내용 순으로 자동 정리됩니다."}
                  </p>
                </div>
              ) : null}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="submit"
                className="btn btn-primary"
                disabled={saving}
              >
                {saving ? "저장 중…" : "일정 저장"}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={saving || !formDate || selectedMemberIds.length === 0}
                onClick={() => {
                  if (formScheduleKind !== "field") {
                    setError("현장·사무 일정만 일일 기록으로 바로 갈 수 있습니다.");
                    return;
                  }
                  if (
                    !maintenanceMode &&
                    formStation.trim() &&
                    !formFacilityArea
                  ) {
                    setError(
                      "역사를 선택했으면 작업 장소(전기실·변전소·역무실)도 선택해 주세요."
                    );
                    return;
                  }
                  const dailyStations =
                    maintenanceMode && maintenanceSelections.length > 0
                      ? uniqueStationsFromTargets(maintenanceSelections)
                      : undefined;
                  setModalOpen(false);
                  goDaily(
                    formDate,
                    formMemberId,
                    dailyStations?.[0] ?? formStation,
                    maintenanceMode
                      ? MANAGEMENT_OFFICE_FACILITY
                      : formFacilityArea,
                    managementOffice,
                    dailyStations,
                    maintenanceMode ? maintenanceSelections : undefined
                  );
                }}
              >
                일일 기록 작성
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setModalOpen(false)}
              >
                취소
              </button>
            </div>
            {formStation.trim() ? (
              <p className="muted mt-2 text-xs">
                「일일 기록 작성」 시{" "}
                <strong>
                  {formatStationVisitLabel(formStation, formFacilityArea) ||
                    formStation.trim()}
                </strong>
                가 자동으로 채워집니다.
              </p>
            ) : null}
          </form>
        </div>
      )}
    </>
  );
}
