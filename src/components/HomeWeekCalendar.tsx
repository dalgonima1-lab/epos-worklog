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
import {
  formatCalendarHolidayDisplay,
  getKoreanHolidayName,
  type KoreanHoliday,
} from "@/lib/koreanHolidays";
import { buildScheduleTitle } from "@/lib/scheduleTitle";
import {
  ANNUAL_LEAVE_FACILITY,
  defaultTimeOffTitle,
  isTimeOffFacility,
  PUBLIC_HOLIDAY_FACILITY,
  scheduleFormKindFromEntry,
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
  const [anchor, setAnchor] = useState(() => new Date());
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
  const [formFacilityAreas, setFormFacilityAreas] = useState<
    StationFacilityArea[]
  >([]);
  const [formWorkContent, setFormWorkContent] = useState("");
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [managementOffice, setManagementOffice] = useState("");
  const [multiStationMode, setMultiStationMode] = useState(false);
  const [selectedStations, setSelectedStations] = useState<string[]>([]);
  const [stationFacilityByStation, setStationFacilityByStation] = useState<
    Record<string, StationFacilityArea[]>
  >({});
  const [maintenanceSelections, setMaintenanceSelections] = useState<
    MaintenanceVisitTarget[]
  >([]);
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [weekHolidays, setWeekHolidays] = useState<KoreanHoliday[]>([]);
  const [formScheduleKind, setFormScheduleKind] =
    useState<ScheduleFormKind>("field_visit");

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
      (formScheduleKind === "maintenance" ||
        formScheduleKind === "field_visit" ||
        multiStationMode) &&
      selectedStations.length > 0
        ? selectedStations
        : formStation.trim()
          ? [formStation.trim()]
          : [];
    if (!stations.length) return "";

    const facilitiesFor = (st: string): StationFacilityArea[] =>
      stations.length >= 2
        ? (stationFacilityByStation[st] ?? [])
        : formFacilityAreas;

    if (formScheduleKind === "maintenance" && managementOffice) {
      return buildMaintenanceScheduleTitleFromTargets(
        managementOffice,
        maintenanceSelections,
        formWorkContent
      );
    }

    const titles = stations.flatMap((st) => {
      const areas = facilitiesFor(st);
      return areas.map((area) => buildScheduleTitle(st, area, formWorkContent));
    });
    return titles.join(" · ");
  }, [
    formStation,
    formFacilityAreas,
    formWorkContent,
    formScheduleKind,
    managementOffice,
    maintenanceSelections,
    multiStationMode,
    selectedStations,
    stationFacilityByStation,
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

  useEffect(() => {
    if (formScheduleKind !== "field_visit") return;
    if (selectedStations.length >= 2) {
      setMultiStationMode(true);
    }
  }, [formScheduleKind, selectedStations.length]);

  function handleSelectedStationsChange(stations: string[]) {
    setSelectedStations(stations);
    if (formScheduleKind === "field_visit" && stations.length >= 2) {
      setMultiStationMode(true);
    }
  }

  function openAdd(date: string) {
    setEditing(null);
    setError("");
    setFormDate(date);
    const holidayName = getKoreanHolidayName(date);
    setFormScheduleKind(holidayName ? "public_holiday" : "field_visit");
    setFormStation("");
    setFormFacilityArea("");
    setFormFacilityAreas([]);
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
    setError("");
    setFormDate(entry.date);
    setFormMemberId(entry.memberId);
    if (isTimeOffFacility(entry.facilityArea)) {
      setFormScheduleKind(scheduleFormKindFromFacility(entry.facilityArea));
      setFormWorkContent(entry.note ?? entry.title ?? "");
      setMaintenanceMode(false);
      setManagementOffice("");
      setFormStation("");
      setFormFacilityArea("");
      setFormFacilityAreas([]);
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
    setFormScheduleKind(scheduleFormKindFromEntry(entry));
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
      const areas = isStationFacilityArea(area) ? [area] : [];
      setFormFacilityArea(areas[0] ?? "");
      setFormFacilityAreas(areas);
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
      (formScheduleKind === "maintenance" ||
        formScheduleKind === "field_visit" ||
        multiStationMode) &&
      selectedStations.length > 0
        ? selectedStations
        : formStation.trim()
          ? [formStation.trim()]
          : [];
    if (formScheduleKind === "maintenance") {
      if (!maintenanceSelections.length) {
        setError("점검 대상(역·기능실)을 1건 이상 선택해 주세요.");
        return;
      }
    } else if (!stations.length) {
      setError("호선과 역사명을 선택해 주세요.");
      return;
    }
    if (formScheduleKind === "maintenance" && !managementOffice) {
      setError("유지보수 용역 시 전기관리소를 선택해 주세요.");
      return;
    }
    const facilitiesForStation = (st: string): StationFacilityArea[] =>
      stations.length >= 2
        ? (stationFacilityByStation[st] ?? [])
        : formFacilityAreas;

    if (
      formScheduleKind === "field_visit" &&
      stations.some((st) => !facilitiesForStation(st).length)
    ) {
      setError(
        stations.length >= 2
          ? "각 역사마다 작업 장소를 1곳 이상 선택해 주세요."
          : "작업 장소를 1곳 이상 선택해 주세요."
      );
      return;
    }
    if (!formWorkContent.trim()) {
      setError("작업 내용을 입력해 주세요.");
      return;
    }

    if (formScheduleKind === "maintenance" && managementOffice) {
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

    const visitSlots = stations.flatMap((st) =>
      facilitiesForStation(st).map((facility) => ({ station: st, facility }))
    );
    const visitGroupId =
      memberIds.length > 1 || visitSlots.length > 1
        ? createVisitGroupId()
        : undefined;
    const titles = visitSlots.map(({ station, facility }) =>
      buildScheduleTitle(station, facility, formWorkContent)
    );
    const slotStations = visitSlots.map((s) => s.station);
    const slotFacilities = visitSlots.map((s) => s.facility);
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
          titles: visitSlots.length > 1 ? titles : undefined,
          stationNames: visitSlots.length > 1 ? slotStations : undefined,
          stationName: visitSlots.length === 1 ? slotStations[0] : undefined,
          visitGroupId,
          facilityArea: slotFacilities[0],
          facilityAreas: visitSlots.length > 1 ? slotFacilities : undefined,
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
          <div className="mt-3 flex flex-wrap items-center gap-2">
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
            <button
              type="button"
              className="rounded-full px-3 py-2 text-xs font-semibold text-indigo-700 ring-1 ring-indigo-200 hover:bg-indigo-50"
              onClick={() => {
                setAnchor(new Date());
                setWeekTab(0);
              }}
            >
              오늘
            </button>
          </div>
          <p className="muted mt-2 text-xs">{week.label}</p>
        </div>

        {error && !modalOpen ? (
          <p className="px-4 py-2 text-sm text-red-600 sm:px-5">{error}</p>
        ) : null}

        {loading ? (
          <p className="muted px-4 py-8 text-center text-sm sm:px-5">
            불러오는 중…
          </p>
        ) : (
          <div className="grid gap-3 p-3 sm:grid-cols-5 sm:items-stretch sm:p-4">
            {days.map((date) => {
              const daySchedules = schedules.filter((s) => s.date === date);
              const isToday = date === formatDate(new Date());
              const holidayName = holidaysByDate.get(date);
              const holidayDisplay = holidayName
                ? formatCalendarHolidayDisplay(holidayName)
                : null;
              return (
                <div
                  key={date}
                  className={`flex h-full min-h-[10rem] flex-col rounded-xl border p-2.5 sm:p-3 ${
                    holidayName
                      ? "border-rose-300 bg-rose-50/50 ring-1 ring-rose-200"
                      : isToday
                        ? "border-indigo-300 bg-indigo-50/50 ring-1 ring-indigo-200"
                        : "border-slate-200 bg-slate-50/60"
                  }`}
                >
                  <div className="mb-2 shrink-0">
                    <div className="flex items-start gap-1">
                      <div className="min-w-0 flex-1">
                        <p
                          className={`text-xs font-bold leading-none ${
                            holidayName ? "text-rose-700" : "text-indigo-600"
                          }`}
                        >
                          {weekdayLabel(date)}
                        </p>
                        <p className="mt-0.5 text-sm font-semibold leading-none text-slate-900">
                          {date.slice(5).replace("-", "/")}
                        </p>
                        <div
                          className="mt-1.5 flex min-h-[2.25rem] items-start gap-0.5"
                          title={holidayDisplay?.fullName}
                        >
                          {holidayDisplay ? (
                            <>
                              <span className="shrink-0 rounded bg-rose-200/90 px-1 py-px text-[9px] font-bold leading-tight text-rose-900">
                                {holidayDisplay.isSubstitute ? "대체" : "공휴"}
                              </span>
                              <span className="min-w-0 line-clamp-2 text-[10px] font-semibold leading-snug text-rose-900">
                                {holidayDisplay.shortLabel}
                              </span>
                            </>
                          ) : (
                            <span
                              className="invisible text-[10px] leading-snug"
                              aria-hidden
                            >
                              .
                            </span>
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        className="shrink-0 rounded-lg bg-white px-2 py-1 text-xs font-semibold leading-none text-indigo-600 ring-1 ring-indigo-200 hover:bg-indigo-50"
                        onClick={() => openAdd(date)}
                      >
                        + 추가
                      </button>
                    </div>
                  </div>

                  <div className="flex min-h-0 flex-1 flex-col gap-2">
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
                            className={`rounded-lg border p-2 ${
                              timeOff
                                ? "border-rose-100 bg-rose-50/90"
                                : "border-white bg-white"
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
                  팀원을 탭해 선택 · 2명 이상이면 동행 일정
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
                      ["field_visit", "외근"],
                      ["maintenance", "유지보수"],
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
                          ? kind === "field_visit"
                            ? "border-indigo-600 bg-indigo-600 text-white"
                            : kind === "maintenance"
                              ? "border-amber-600 bg-amber-600 text-white"
                              : "border-rose-600 bg-rose-600 text-white"
                          : "border-slate-200 bg-white text-slate-700"
                      }`}
                      onClick={() => {
                        setFormScheduleKind(kind);
                        if (kind === "annual_leave") {
                          setFormWorkContent("");
                          setMaintenanceMode(false);
                          setManagementOffice("");
                        } else if (kind === "public_holiday") {
                          const name = getKoreanHolidayName(formDate);
                          setFormWorkContent(name ?? "");
                          setMaintenanceMode(false);
                          setManagementOffice("");
                        } else if (kind === "maintenance") {
                          setMaintenanceMode(true);
                          setMultiStationMode(false);
                          setSelectedStations([]);
                          setStationFacilityByStation({});
                          if (!formWorkContent.trim()) {
                            setFormWorkContent("정기점검");
                          }
                        } else {
                          setMaintenanceMode(false);
                          setManagementOffice("");
                          setMaintenanceSelections([]);
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
                    {formatCalendarHolidayDisplay(formDateHolidayName).fullName}
                    )입니다.
                  </p>
                ) : null}
                {formScheduleKind === "field_visit" ? (
                  <p className="muted mt-2 text-xs">
                    역을 2곳 이상 고르면 같은 날 <strong>역별 방문</strong>{" "}
                    일정이 각각 생성됩니다.
                  </p>
                ) : null}
                {formScheduleKind === "maintenance" ? (
                  <p className="muted mt-2 text-xs">
                    전기관리소·정기점검계획서 기준으로 역·기능실을
                    선택합니다.
                  </p>
                ) : null}
                {formScheduleKind === "annual_leave" ? (
                  <p className="muted mt-2 text-xs">
                    연차는 일일 기록 없이 휴무 일정으로만 등록됩니다.
                  </p>
                ) : null}
              </div>
              {formScheduleKind === "field_visit" || formScheduleKind === "maintenance" ? (
              <StationPicker
                value={formStation}
                onChange={setFormStation}
                facilityArea={formFacilityArea}
                onFacilityChange={setFormFacilityArea}
                facilityAreas={formFacilityAreas}
                onFacilityAreasChange={(areas) => {
                  setFormFacilityAreas(areas);
                  setFormFacilityArea(areas[0] ?? "");
                }}
                requireFacility={formScheduleKind === "field_visit"}
                disabled={saving}
                enableMetroPicker
                enableDirectInput
                fieldVisitMode={formScheduleKind === "field_visit"}
                multiStationMode={multiStationMode}
                onMultiStationModeChange={
                  formScheduleKind === "field_visit"
                    ? setMultiStationMode
                    : undefined
                }
                selectedStations={selectedStations}
                onSelectedStationsChange={handleSelectedStationsChange}
                stationFacilityByStation={stationFacilityByStation}
                onStationFacilityByStationChange={setStationFacilityByStation}
                maintenanceSelections={maintenanceSelections}
                onMaintenanceSelectionsChange={setMaintenanceSelections}
                maintenanceMode={formScheduleKind === "maintenance"}
                managementOffice={managementOffice}
                onManagementOfficeChange={setManagementOffice}
              />
              ) : (
              <div>
                <label className="label">메모 (선택)</label>
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
              {formScheduleKind === "field_visit" || formScheduleKind === "maintenance" ? (
              <div>
                <label className="label">
                  작업 내용 <span className="text-red-600">*</span>
                </label>
                <textarea
                  className="textarea min-h-[72px]"
                  placeholder={
                    formScheduleKind === "maintenance"
                      ? "예: 정기점검"
                      : "예: 관제 화면 점검, 현장 조치"
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
                    {formScheduleKind === "maintenance"
                      ? selectedMemberIds.length > 1
                        ? `동행 ${selectedMemberIds.length}명에게 관리소 산하 일정 1건씩 저장합니다.`
                        : "유지보수 용역은 관리소 산하 일정 1건으로 저장합니다."
                      : formScheduleKind === "field_visit"
                        ? selectedMemberIds.length > 1
                          ? `동행 ${selectedMemberIds.length}명 × 선택한 역마다 일정이 생성됩니다.`
                          : selectedStations.length > 1
                            ? `선택한 ${selectedStations.length}개 역에 대해 각각 일정이 생성됩니다.`
                            : formFacilityAreas.length > 1
                              ? `같은 역에서 작업 장소 ${formFacilityAreas.length}곳 → 일정 ${formFacilityAreas.length}건이 생성됩니다.`
                              : "호선 · 역사명 · 작업 장소 · 작업 내용 순으로 자동 정리됩니다."
                        : selectedMemberIds.length > 1
                          ? `선택한 ${selectedMemberIds.length}명에게 휴무 일정이 등록됩니다.`
                          : "휴무 일정으로 등록되며 일일 기록은 필요 없습니다."}
                  </p>
                </div>
              ) : null}
            </div>
            {error && modalOpen ? (
              <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </p>
            ) : null}
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
                  if (
                    formScheduleKind !== "field_visit" &&
                    formScheduleKind !== "maintenance"
                  ) {
                    setError("외근·유지보수 일정만 일일 기록으로 바로 갈 수 있습니다.");
                    return;
                  }
                  if (
                    formScheduleKind === "field_visit" &&
                    formStation.trim() &&
                    formFacilityAreas.length === 0
                  ) {
                    setError(
                      "역사를 선택했으면 작업 장소(전기실·변전소·역무실)를 1곳 이상 선택해 주세요."
                    );
                    return;
                  }
                  const dailyStations =
                    formScheduleKind === "maintenance" &&
                    maintenanceSelections.length > 0
                      ? uniqueStationsFromTargets(maintenanceSelections)
                      : selectedStations.length > 0
                        ? selectedStations
                        : undefined;
                  setModalOpen(false);
                  goDaily(
                    formDate,
                    formMemberId,
                    dailyStations?.[0] ?? formStation,
                    formScheduleKind === "maintenance"
                      ? MANAGEMENT_OFFICE_FACILITY
                      : formFacilityAreas[0] ?? formFacilityArea,
                    managementOffice,
                    dailyStations,
                    formScheduleKind === "maintenance"
                      ? maintenanceSelections
                      : undefined
                  );
                }}
              >
                기록 작성
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setModalOpen(false)}
              >
                취소
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
