"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  formatDate,
  getWeekRange,
  shiftWeek,
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
import {
  buildOfficeWorkScheduleTitle,
  guessOfficeProcessingRoleFromScheduleTitle,
  isOfficeAiAutomationRole,
  isOfficeGeneralStation,
  OFFICE_AI_AUTOMATION_ROLE,
  OFFICE_GENERAL_STATION,
  OFFICE_STATION_ROLES,
} from "@/lib/officeWork";
import { buildScheduleTitle } from "@/lib/scheduleTitle";
import {
  ANNUAL_LEAVE_FACILITY,
  defaultTimeOffTitle,
  isOfficeWorkFacility,
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
  formatCohortMemberLabel,
  isScheduleDayComplete,
} from "@/lib/visitCohort";
import {
  formatStationVisitLabel,
  isStationFacilityArea,
  MANAGEMENT_OFFICE_FACILITY,
  OFFICE_WORK_FACILITY,
  type StationFacilityArea,
  type WorkFacilityArea,
} from "@/lib/stationFacility";
import type { DailyReport, Member, ScheduleEntry } from "@/lib/types";
import { WeekTeamRoster } from "@/components/WeekTeamRoster";
import { NextWeekPlanPanel } from "@/components/NextWeekPlanPanel";

type WeekTab = -1 | 0 | 1;

const WEEK_TABS: { offset: WeekTab; label: string }[] = [
  { offset: -1, label: "저번주" },
  { offset: 0, label: "이번주" },
  { offset: 1, label: "다음주" },
];

interface HomeWeekCalendarProps {
  teamName: string;
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
  const [formFacilityArea, setFormFacilityArea] = useState<WorkFacilityArea | "">(
    ""
  );
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
  const [officeProcessingRole, setOfficeProcessingRole] = useState(
    () => OFFICE_STATION_ROLES[0] ?? "전력감시시스템"
  );

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
        formScheduleKind === "office_work" ||
        multiStationMode) &&
      selectedStations.length > 0
        ? selectedStations
        : formStation.trim()
          ? [formStation.trim()]
          : [];
    if (!stations.length) return "";

    if (formScheduleKind === "office_work") {
      return stations
        .map((st) =>
          buildOfficeWorkScheduleTitle(
            st,
            officeProcessingRole,
            formWorkContent
          )
        )
        .join(" · ");
    }

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
    officeProcessingRole,
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

  const weekProgress = useMemo(() => {
    const work = schedules.filter((s) => !isTimeOffFacility(s.facilityArea));
    let done = 0;
    for (const s of work) {
      const report = reportByKey.get(`${s.memberId}:${s.date}`);
      if (
        isScheduleDayComplete(
          s.memberId,
          s.date,
          report,
          schedules,
          reports,
          memberNameById,
          s
        )
      ) {
        done += 1;
      }
    }
    return { work: work.length, done, pending: work.length - done };
  }, [schedules, reports, reportByKey, memberNameById]);

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

  function openAdd(date: string, prefillMemberId?: string) {
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
    setOfficeProcessingRole(OFFICE_STATION_ROLES[0] ?? "전력감시시스템");
    const first =
      prefillMemberId?.trim() ||
      writers[0]?.id ||
      members.find((m) => m.role === "member")?.id ||
      "";
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
    if (isOfficeWorkFacility(entry.facilityArea)) {
      setFormScheduleKind("office_work");
      setMaintenanceMode(false);
      setManagementOffice("");
      setMaintenanceSelections([]);
      setFormFacilityArea(OFFICE_WORK_FACILITY);
      setFormFacilityAreas([]);
      setStationFacilityByStation({});
      setFormWorkContent(entry.note ?? "");
      setOfficeProcessingRole(
        guessOfficeProcessingRoleFromScheduleTitle(entry.title ?? "") ??
          OFFICE_STATION_ROLES[0] ??
          "전력감시시스템"
      );
      let officeStations: string[] = [];
      if (entry.visitGroupId) {
        officeStations = [
          ...new Set(
            schedules
              .filter(
                (s) =>
                  s.date === entry.date &&
                  s.visitGroupId === entry.visitGroupId &&
                  isOfficeWorkFacility(s.facilityArea)
              )
              .map((s) => s.stationName?.trim() ?? "")
              .filter(Boolean)
          ),
        ];
      }
      if (!officeStations.length && entry.stationName?.trim()) {
        officeStations = [entry.stationName.trim()];
      }
      setSelectedStations(officeStations);
      setMultiStationMode(officeStations.length > 0);
      setFormStation(officeStations[0] ?? "");
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
    maintenanceTargets?: MaintenanceVisitTarget[],
    scheduleMeta?: { id?: string; visitGroupId?: string }
  ) {
    const q = new URLSearchParams({ date, memberId });
    if (scheduleMeta?.id?.trim()) {
      q.set("scheduleId", scheduleMeta.id.trim());
    }
    if (scheduleMeta?.visitGroupId?.trim()) {
      q.set("visitGroupId", scheduleMeta.visitGroupId.trim());
    }
    if (stationName?.trim()) {
      q.set("station", stationName.trim());
    }
    const area = facilityArea?.trim() ?? "";
    if (area === MANAGEMENT_OFFICE_FACILITY) {
      q.set("facility", MANAGEMENT_OFFICE_FACILITY);
    } else if (isStationFacilityArea(area)) {
      q.set("facility", area);
    } else if (area === OFFICE_WORK_FACILITY) {
      q.set("facility", OFFICE_WORK_FACILITY);
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

    if (formScheduleKind === "office_work") {
      const officeStations =
        selectedStations.length > 0
          ? selectedStations
          : formStation.trim()
            ? [formStation.trim()]
            : [];
      if (!officeStations.length) {
        setError("사무 작업할 역사를 1곳 이상 선택해 주세요.");
        return;
      }
      const role = officeProcessingRole.trim();
      if (!role) {
        setError("공종을 선택해 주세요.");
        return;
      }
      if (
        isOfficeAiAutomationRole(role) &&
        !officeStations.every((st) => isOfficeGeneralStation(st))
      ) {
        setError(
          `「${OFFICE_AI_AUTOMATION_ROLE}」은 「${OFFICE_GENERAL_STATION}」만 선택할 수 있습니다.`
        );
        return;
      }
      if (
        !isOfficeAiAutomationRole(role) &&
        officeStations.some((st) => isOfficeGeneralStation(st))
      ) {
        setError(
          `역사별 사무 작업은 「${OFFICE_GENERAL_STATION}」을 제외하고 역을 선택해 주세요.`
        );
        return;
      }
      if (!formWorkContent.trim()) {
        setError("작업 내용을 입력해 주세요.");
        return;
      }
      const visitGroupId = createVisitGroupId();
      const titles = officeStations.map((st) =>
        buildOfficeWorkScheduleTitle(st, role, formWorkContent)
      );
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
            titles: officeStations.length > 1 ? titles : undefined,
            stationNames:
              officeStations.length > 1 ? officeStations : undefined,
            stationName:
              officeStations.length === 1 ? officeStations[0] : undefined,
            visitGroupId,
            facilityArea: OFFICE_WORK_FACILITY,
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
    const visitGroupId = createVisitGroupId();
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
            {weekTab === 1 ? (
              <span className="mt-1 block text-indigo-700">
                「다음주」 탭에서 등록한 일정·차주 계획은 AI 주간 분석에 반영됩니다.
              </span>
            ) : null}
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
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
            <span className="font-medium text-slate-700">{week.label}</span>
            {weekProgress.work > 0 ? (
              <span className="text-slate-600">
                현장·유지보수 일정{" "}
                <strong className="text-emerald-700">{weekProgress.done}</strong>
                /{weekProgress.work}건 기록 완료
                {weekProgress.pending > 0 ? (
                  <span className="text-amber-700">
                    {" "}
                    · 미작성 {weekProgress.pending}건
                  </span>
                ) : null}
              </span>
            ) : (
              <span className="text-slate-500">등록된 일정 없음</span>
            )}
          </div>
          <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-slate-600">
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              기록 완료
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-amber-400" />
              일일 기록 필요
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-violet-500" />
              동행 기록
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-rose-400" />
              휴무
            </span>
          </div>
        </div>

        {error && !modalOpen ? (
          <p className="px-4 py-2 text-sm text-red-600 sm:px-5">{error}</p>
        ) : null}

        {loading ? (
          <p className="muted px-4 py-8 text-center text-sm sm:px-5">
            불러오는 중…
          </p>
        ) : writers.length === 0 ? (
          <p className="muted px-4 py-8 text-center text-sm sm:px-5">
            등록된 팀원이 없습니다.
          </p>
        ) : (
          <div className="p-2 sm:p-4">
            <WeekTeamRoster
              members={writers}
              days={days}
              schedules={schedules}
              reports={reports}
              memberNameById={memberNameById}
              holidaysByDate={holidaysByDate}
              today={formatDate(new Date())}
              onAdd={openAdd}
              onScheduleClick={(s) => {
                if (isTimeOffFacility(s.facilityArea)) {
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
                  })),
                  { id: s.id, visitGroupId: s.visitGroupId }
                );
              }}
              onEdit={openEdit}
              onDelete={removeSchedule}
            />
          </div>
        )}
        {weekTab === 1 && writers.length > 0 ? (
          <NextWeekPlanPanel
            weekStart={week.start}
            weekEnd={week.end}
            weekLabel={week.label}
            members={writers}
            caption="이 주 일정과 함께 저장하면 AI 주간 분석 보고서 4-1절(차주 계획)에 반영됩니다."
          />
        ) : null}
      </section>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <Link href="/daily" className="card feature-card block">
          <h2 className="text-base font-bold">일일 기록 바로가기</h2>
          <p className="muted mt-2 text-sm">오늘 날짜로 업무 기록 작성</p>
        </Link>
        <Link href="/manager" className="card feature-card block">
          <h2 className="text-base font-bold">관리자 대시보드</h2>
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
                      ["office_work", "사무작업"],
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
                            : kind === "office_work"
                              ? "border-sky-600 bg-sky-600 text-white"
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
                          setFormFacilityArea("");
                          setFormFacilityAreas([]);
                          if (!formWorkContent.trim()) {
                            setFormWorkContent("정기점검");
                          }
                        } else if (kind === "office_work") {
                          setMaintenanceMode(false);
                          setManagementOffice("");
                          setMaintenanceSelections([]);
                          setMultiStationMode(true);
                          setFormFacilityArea(OFFICE_WORK_FACILITY);
                          setFormFacilityAreas([]);
                          setStationFacilityByStation({});
                          setSelectedStations([]);
                          setFormStation("");
                          if (!formWorkContent.trim()) {
                            setFormWorkContent("");
                          }
                        } else {
                          setMaintenanceMode(false);
                          setManagementOffice("");
                          setMaintenanceSelections([]);
                          setFormFacilityArea("");
                          setFormFacilityAreas([]);
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
                {formScheduleKind === "office_work" ? (
                  <p className="muted mt-2 text-xs">
                    역사별 사무 작업을 등록합니다. 역을 여러 곳 고르면{" "}
                    <strong>역마다 일정</strong>이 생성됩니다.
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
              {formScheduleKind === "field_visit" ||
              formScheduleKind === "office_work" ||
              formScheduleKind === "maintenance" ? (
              <>
              {formScheduleKind === "office_work" ? (
                <div>
                  <label className="label">
                    공종 <span className="text-red-600">*</span>
                  </label>
                  <select
                    className="input max-w-md"
                    value={officeProcessingRole}
                    disabled={saving}
                    onChange={(e) => {
                      const role = e.target.value;
                      setOfficeProcessingRole(role);
                      if (isOfficeAiAutomationRole(role)) {
                        setSelectedStations([OFFICE_GENERAL_STATION]);
                        setFormStation(OFFICE_GENERAL_STATION);
                        setMultiStationMode(true);
                      }
                    }}
                  >
                    {OFFICE_STATION_ROLES.map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                    <option value={OFFICE_AI_AUTOMATION_ROLE}>
                      {OFFICE_AI_AUTOMATION_ROLE}
                    </option>
                  </select>
                </div>
              ) : null}
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
                officeWorkMode={formScheduleKind === "office_work"}
                multiStationMode={
                  formScheduleKind === "office_work" ? true : multiStationMode
                }
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
              </>
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
              {formScheduleKind === "field_visit" ||
              formScheduleKind === "office_work" ||
              formScheduleKind === "maintenance" ? (
              <div>
                <label className="label">
                  작업 내용 <span className="text-red-600">*</span>
                </label>
                <textarea
                  className="textarea min-h-[72px]"
                  placeholder={
                    formScheduleKind === "maintenance"
                      ? "예: 정기점검"
                      : formScheduleKind === "office_work"
                        ? "예: 관제 화면 점검, 자료 정리"
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
                      : formScheduleKind === "office_work"
                        ? selectedMemberIds.length > 1
                          ? `동행 ${selectedMemberIds.length}명 × 선택한 역마다 사무 일정이 생성됩니다.`
                          : selectedStations.length > 1
                            ? `선택한 ${selectedStations.length}개 역에 대해 사무 일정이 각각 생성됩니다.`
                            : "호선 · 역사명 · 사무 · 공종 · 작업 내용 순으로 자동 정리됩니다."
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
                    formScheduleKind !== "office_work" &&
                    formScheduleKind !== "maintenance"
                  ) {
                    setError(
                      "외근·사무작업·유지보수 일정만 일일 기록으로 바로 갈 수 있습니다."
                    );
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
                      : formScheduleKind === "office_work"
                        ? OFFICE_WORK_FACILITY
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
