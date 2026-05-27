"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Header } from "@/components/Header";
import { isSecurityTestPlaceholder } from "@/lib/sanitizeTestData";
import { getEposProductForDisplayName } from "@/lib/eposProductStations";
import {
  getProcessingRolesForFacilities,
  getProcessingRolesForFacility,
  isProcessingRoleAllowedForFacilities,
  isProcessingRoleAllowedForFacility,
  isStationFacilityArea,
  MANAGEMENT_OFFICE_FACILITY,
  OFFICE_WORK_FACILITY,
  parseStationFacilityAreas,
  STATION_FACILITY_AREAS,
  type StationFacilityArea,
  type WorkFacilityArea,
} from "@/lib/stationFacility";
import {
  filledOfficeWorkEntries,
  isOfficeAiAutomationRole,
  isOfficeGeneralStation,
  notesMapToOfficeWorkEntries,
  OFFICE_AI_AUTOMATION_ROLE,
  OFFICE_GENERAL_STATION,
  officeVisitedStationsFromEntries,
  officeWorkEntriesToNotesMap,
  officeWorkEntryKey,
  type OfficeWorkEntry,
} from "@/lib/officeWork";
import { MaintenanceDailyVisitForm } from "@/components/MaintenanceDailyVisitForm";
import { OfficeWorkDailyForm } from "@/components/OfficeWorkDailyForm";
import { PhotoCapture, WorkTimeDisplay } from "@/components/PhotoCapture";
import { StationPicker } from "@/components/StationPicker";
import { DEFAULT_TEAM_MEMBERS, DEFAULT_TEAM_NAME } from "@/lib/constants";
import { formatDate } from "@/lib/dates";
import { maintenanceSelectionsFromStationDisplays } from "@/lib/maintenancePlan";
import {
  decodeMaintenanceStationNames,
  decodeMaintenanceVisitTargets,
} from "@/lib/maintenanceSchedule";
import {
  uniqueStationsFromTargets,
  type MaintenanceVisitTarget,
} from "@/lib/maintenanceVisit";
import { calcWorkMinutes } from "@/lib/workTime";
import type { CohortCoverage } from "@/lib/visitCohort";
import {
  clearDailyDraft,
  loadLastMemberId,
  saveDailyDraft,
  saveLastMemberId,
} from "@/lib/dailyDraft";

const ROLE_OTHER = "\uae30\ud0c0";

interface Member {
  id: string;
  name: string;
}

const DEFAULT_WRITERS: Member[] = DEFAULT_TEAM_MEMBERS.filter(
  (m) => m.role === "member"
);

function DailyPageInner() {
  const searchParams = useSearchParams();
  const [teamName, setTeamName] = useState(DEFAULT_TEAM_NAME);
  const [members, setMembers] = useState<Member[]>(DEFAULT_WRITERS);
  const [memberId, setMemberId] = useState(
    () => searchParams.get("memberId") ?? DEFAULT_WRITERS[0]?.id ?? ""
  );
  const [date, setDate] = useState(
    () => searchParams.get("date") ?? formatDate(new Date())
  );
  const [stationName, setStationName] = useState(
    () => searchParams.get("station")?.trim() ?? ""
  );
  const [multiStationMode, setMultiStationMode] = useState(false);
  const [selectedStations, setSelectedStations] = useState<string[]>([]);
  const [stationFacilityByStation, setStationFacilityByStation] = useState<
    Record<string, StationFacilityArea[]>
  >({});
  const [maintenanceSelections, setMaintenanceSelections] = useState<
    MaintenanceVisitTarget[]
  >([]);
  const [maintenancePlannedTargets, setMaintenancePlannedTargets] = useState<
    MaintenanceVisitTarget[]
  >([]);
  const [deficienciesByStation, setDeficienciesByStation] = useState<
    Record<string, string>
  >({});
  const [facilityArea, setFacilityArea] = useState<WorkFacilityArea | "">(() => {
    const q = searchParams.get("facility")?.trim() ?? "";
    if (q === MANAGEMENT_OFFICE_FACILITY) return MANAGEMENT_OFFICE_FACILITY;
    return isStationFacilityArea(q) ? q : "";
  });
  const [facilityAreas, setFacilityAreas] = useState<StationFacilityArea[]>(
    () => {
      const q = searchParams.get("facility")?.trim() ?? "";
      const extras =
        searchParams
          .get("facilities")
          ?.split(",")
          .map((s) => s.trim())
          .filter(isStationFacilityArea) ?? [];
      return parseStationFacilityAreas(q, extras);
    }
  );
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [officeWorkMode, setOfficeWorkMode] = useState(false);
  const [selectedOfficeRolesByStation, setSelectedOfficeRolesByStation] =
    useState<Record<string, string[]>>({});
  const [officeWorkByKey, setOfficeWorkByKey] = useState<Record<string, string>>(
    {}
  );
  const [officeVisitedStations, setOfficeVisitedStations] = useState<
    string[]
  >([]);
  const maintenanceLocked = useMemo(() => {
    const qFacility = searchParams.get("facility")?.trim() ?? "";
    return qFacility === MANAGEMENT_OFFICE_FACILITY || maintenanceMode;
  }, [searchParams, maintenanceMode]);
  const [managementOffice, setManagementOffice] = useState("");
  const [processingRole, setProcessingRole] = useState("");
  const [customRole, setCustomRole] = useState("");
  const [done, setDone] = useState("");
  const [plan, setPlan] = useState("");
  const [issues, setIssues] = useState("");
  const [deficiencies, setDeficiencies] = useState("");
  const [beforePhotoAt, setBeforePhotoAt] = useState<string | undefined>();
  const [afterPhotoAt, setAfterPhotoAt] = useState<string | undefined>();
  const [hasBeforePhoto, setHasBeforePhoto] = useState(false);
  const [hasAfterPhoto, setHasAfterPhoto] = useState(false);
  const [visitGroupId, setVisitGroupId] = useState<string | undefined>();
  const [cohortCoverage, setCohortCoverage] = useState<CohortCoverage | null>(
    null
  );
  const formLockedByCohort = cohortCoverage != null;
  const [workMinutes, setWorkMinutes] = useState<number | null>(null);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [extraMemoOpen, setExtraMemoOpen] = useState(false);

  const fieldVisitMode =
    !maintenanceLocked && !officeWorkMode && !maintenanceMode;

  const activeStations = useMemo(() => {
    if (maintenanceMode && maintenanceSelections.length > 0) {
      return uniqueStationsFromTargets(maintenanceSelections);
    }
    if (
      (fieldVisitMode || officeWorkMode || multiStationMode) &&
      selectedStations.length > 0
    ) {
      return selectedStations;
    }
    return stationName.trim() ? [stationName.trim()] : [];
  }, [
    maintenanceMode,
    maintenanceSelections,
    fieldVisitMode,
    officeWorkMode,
    multiStationMode,
    selectedStations,
    stationName,
  ]);

  const perStationFacilities =
    (fieldVisitMode || multiStationMode) &&
    activeStations.length >= 2 &&
    !maintenanceMode;

  const stationFacilitiesMap = useMemo(() => {
    const map: Record<string, StationFacilityArea[]> = {};
    for (const st of activeStations) {
      const facilities = getEposProductForDisplayName(st).facilities;
      map[st] = facilities.length > 0 ? facilities : [...STATION_FACILITY_AREAS];
    }
    return map;
  }, [activeStations]);

  const derivedFacilityAreas = useMemo(() => {
    if (maintenanceMode) return [];
    if (!activeStations.length) return [];
    return activeStations.flatMap((s) => stationFacilitiesMap[s] ?? []);
  }, [activeStations, maintenanceMode, stationFacilitiesMap]);

  const activeFacilityAreas = useMemo(() => {
    if (maintenanceMode && maintenanceSelections.length > 0) {
      return [...new Set(maintenanceSelections.map((t) => t.facility))];
    }
    if (maintenanceMode) return [MANAGEMENT_OFFICE_FACILITY];
    if (perStationFacilities) {
      return activeStations.flatMap(
        (s) => stationFacilityByStation[s] ?? []
      );
    }
    return facilityAreas.length > 0
      ? facilityAreas
      : derivedFacilityAreas.length > 0
        ? derivedFacilityAreas
      : facilityArea
        ? [facilityArea as StationFacilityArea]
        : [];
  }, [
    activeStations,
    facilityArea,
    facilityAreas,
    derivedFacilityAreas,
    maintenanceMode,
    perStationFacilities,
    stationFacilityByStation,
  ]);

  const allFacilitiesChosen =
    (maintenanceMode && maintenanceSelections.length > 0) ||
    (perStationFacilities
      ? activeStations.every(
          (s) =>
            (stationFacilityByStation[s] ?? []).length > 0 ||
            (stationFacilitiesMap[s] ?? []).length > 0
        )
      : facilityAreas.length > 0 ||
        derivedFacilityAreas.length > 0 ||
        Boolean(facilityArea));

  const effectiveRole =
    facilityArea === MANAGEMENT_OFFICE_FACILITY
      ? "유지보수 용역"
      : processingRole === ROLE_OTHER
        ? customRole.trim()
        : processingRole;

  const rolesForFacility = useMemo(() => {
    if (maintenanceMode) return getProcessingRolesForFacility(MANAGEMENT_OFFICE_FACILITY);
    // 역사 기반으로 가능한 공종을 합집합으로 노출
    const union = new Set<string>();
    for (const area of activeFacilityAreas) {
      for (const role of getProcessingRolesForFacility(area)) {
        union.add(role);
      }
    }
    return union.size > 0 ? [...union] : getProcessingRolesForFacilities(activeFacilityAreas);
  }, [activeFacilityAreas, maintenanceMode]);

  useEffect(() => {
    if (!officeWorkMode && !maintenanceMode && !maintenanceLocked) {
      if (selectedStations.length >= 2) {
        setMultiStationMode(true);
      }
    }
  }, [selectedStations.length, officeWorkMode, maintenanceMode, maintenanceLocked]);

  function handleSelectedStationsChange(stations: string[]) {
    setSelectedStations(stations);
    if (
      !officeWorkMode &&
      !maintenanceMode &&
      !maintenanceLocked &&
      stations.length >= 2
    ) {
      setMultiStationMode(true);
    }
  }

  useEffect(() => {
    if (!officeWorkMode) return;
    setOfficeVisitedStations((prev) =>
      prev.filter((s) => selectedStations.includes(s))
    );
  }, [selectedStations, officeWorkMode]);

  useEffect(() => {
    if (!officeWorkMode) return;
    const next: Record<string, string[]> = {};
    for (const station of officeVisitedStations) {
      next[station] = selectedOfficeRolesByStation[station] ?? [];
    }
    if (
      JSON.stringify(next) !== JSON.stringify(selectedOfficeRolesByStation)
    ) {
      setSelectedOfficeRolesByStation(next);
    }
  }, [officeVisitedStations, officeWorkMode, selectedOfficeRolesByStation]);

  useEffect(() => {
    if (memberId) saveLastMemberId(memberId);
  }, [memberId]);

  useEffect(() => {
    if (!memberId || !date || formLockedByCohort) return;
    const timer = setTimeout(() => {
      saveDailyDraft(memberId, date, {
        stationName,
        facilityArea,
        facilityAreas,
        selectedStations,
        stationFacilityByStation,
        maintenanceSelections,
        managementOffice,
        processingRole,
        customRole,
        done,
        plan,
        issues,
        deficiencies,
        officeWorkMode,
        maintenanceMode,
        selectedOfficeRolesByStation,
        officeWorkByKey,
        officeVisitedStations,
      });
    }, 600);
    return () => clearTimeout(timer);
  }, [
    memberId,
    date,
    formLockedByCohort,
    stationName,
    facilityArea,
    facilityAreas,
    selectedStations,
    stationFacilityByStation,
    maintenanceSelections,
    managementOffice,
    processingRole,
    customRole,
    done,
    plan,
    issues,
    deficiencies,
    officeWorkMode,
    maintenanceMode,
    selectedOfficeRolesByStation,
    officeWorkByKey,
    officeVisitedStations,
  ]);

  useEffect(() => {
    fetch("/api/members")
      .then((r) => r.json())
      .then((data) => {
        const writers = data.members?.length ? data.members : DEFAULT_WRITERS;
        setTeamName(data.teamName ?? DEFAULT_TEAM_NAME);
        setMembers(writers);
        const last = loadLastMemberId();
        const pick =
          (last && writers.some((w: { id: string }) => w.id === last)
            ? last
            : null) ??
          writers[0]?.id;
        if (!memberId && pick) {
          setMemberId(pick);
        }
      })
      .catch(() => {
        setTeamName(DEFAULT_TEAM_NAME);
        setMembers(DEFAULT_WRITERS);
        if (!memberId) {
          setMemberId(DEFAULT_WRITERS[0]?.id ?? "");
        }
      });
  }, [memberId]);

  useEffect(() => {
    if (!allFacilitiesChosen) {
      setProcessingRole("");
      setCustomRole("");
      return;
    }
    const allowed =
      activeFacilityAreas.length > 1
        ? getProcessingRolesForFacilities(activeFacilityAreas)
        : getProcessingRolesForFacility(facilityArea);
    if (
      processingRole &&
      processingRole !== ROLE_OTHER &&
      !allowed.includes(processingRole)
    ) {
      setProcessingRole("");
      setCustomRole("");
    }
  }, [
    activeFacilityAreas,
    allFacilitiesChosen,
    facilityArea,
    processingRole,
  ]);

  function applyMaintenanceFromSchedule(
    qOffice: string,
    qTargets: string,
    qStations: string,
    qStation: string
  ) {
    setFacilityArea(MANAGEMENT_OFFICE_FACILITY);
    setManagementOffice(qOffice);
    setMaintenanceMode(true);
    setProcessingRole("유지보수 용역");
    const fromTargets = decodeMaintenanceVisitTargets(qTargets);
    const fromUrl = decodeMaintenanceStationNames(qStations);
    const planned =
      fromTargets.length > 0
        ? fromTargets
        : qOffice
          ? maintenanceSelectionsFromStationDisplays(qOffice, fromUrl)
          : [];
    if (planned.length > 0) {
      setMaintenancePlannedTargets(planned);
      setMaintenanceSelections(planned);
      const names = uniqueStationsFromTargets(planned);
      setSelectedStations(names);
      setMultiStationMode(true);
      if (!qStation && names[0]) setStationName(names[0]);
    }
  }

  useEffect(() => {
    const qDate = searchParams.get("date");
    const qMember = searchParams.get("memberId");
    const qStation = searchParams.get("station")?.trim() ?? "";
    const qFacility = searchParams.get("facility")?.trim() ?? "";
    const qOffice = searchParams.get("office")?.trim() ?? "";
    const qStations = searchParams.get("stations")?.trim() ?? "";
    const qTargets = searchParams.get("targets")?.trim() ?? "";
    if (qDate) setDate(qDate);
    if (qMember) setMemberId(qMember);
    if (qStation) setStationName(qStation);
    if (qFacility === MANAGEMENT_OFFICE_FACILITY) {
      applyMaintenanceFromSchedule(qOffice, qTargets, qStations, qStation);
    } else if (isStationFacilityArea(qFacility)) {
      setFacilityArea(qFacility);
    }
  }, [searchParams]);

  useEffect(() => {
    if (!memberId || !date) return;
    const stationFromSchedule = searchParams.get("station")?.trim() ?? "";
    const facilityFromSchedule = searchParams.get("facility")?.trim() ?? "";
    setCohortCoverage(null);
    setVisitGroupId(undefined);
    setLoading(true);
    setBeforePhotoAt(undefined);
    setAfterPhotoAt(undefined);
    setHasBeforePhoto(false);
    setHasAfterPhoto(false);
    fetch(`/api/reports?memberId=${memberId}&date=${date}`)
      .then((r) => r.json())
      .then((data) => {
        setVisitGroupId(data.visitGroupId?.trim() || undefined);
        setCohortCoverage(data.cohortCoverage ?? null);
        const report = data.report;
        const role = report?.processingRole ?? "";
        const loadedFacility = report?.facilityArea?.trim() ?? "";
        const facilityForRole = isStationFacilityArea(loadedFacility)
          ? loadedFacility
          : isStationFacilityArea(facilityFromSchedule)
            ? facilityFromSchedule
            : "";
        const fromReport = report?.stationName?.trim() ?? "";
        const safeReportStation = isSecurityTestPlaceholder(fromReport)
          ? ""
          : fromReport;
        const additional = report?.additionalStationNames ?? [];
        const cohortFacilities = (() => {
          const names = [safeReportStation, ...additional].filter(Boolean);
          const extras = report?.additionalFacilityAreas ?? [];
          if (names.length <= 1) {
            return parseStationFacilityAreas(facilityForRole, extras);
          }
          const list = parseStationFacilityAreas(facilityForRole, extras);
          return names
            .map((_, i) => list[i])
            .filter((f): f is StationFacilityArea => Boolean(f));
        })();

        if (
          role &&
          cohortFacilities.length > 0 &&
          (cohortFacilities.length > 1
            ? isProcessingRoleAllowedForFacilities(role, cohortFacilities)
            : isProcessingRoleAllowedForFacility(role, cohortFacilities[0]!))
        ) {
          setProcessingRole(role);
          setCustomRole("");
        } else if (role) {
          setProcessingRole(ROLE_OTHER);
          setCustomRole(role);
        } else {
          setProcessingRole("");
          setCustomRole("");
        }
        const scheduleIsMaintenance =
          facilityFromSchedule === MANAGEMENT_OFFICE_FACILITY;
        if (report?.maintenanceVisitTargets?.length) {
          const targets = (
            report.maintenanceVisitTargets as {
              station: string;
              facility: string;
              fromPlan?: boolean;
            }[]
          ).map(
            (t): MaintenanceVisitTarget => ({
              station: t.station,
              facility: t.facility as StationFacilityArea,
              fromPlan: t.fromPlan !== false,
            })
          );
          const plannedRaw = report.maintenancePlannedTargets as
            | { station: string; facility: string; fromPlan?: boolean }[]
            | undefined;
          const planned =
            plannedRaw?.length
              ? plannedRaw.map(
                  (t): MaintenanceVisitTarget => ({
                    station: t.station,
                    facility: t.facility as StationFacilityArea,
                    fromPlan: t.fromPlan !== false,
                  })
                )
              : targets;
          setOfficeWorkMode(false);
          setSelectedOfficeRolesByStation({});
          setOfficeWorkByKey({});
          setMaintenancePlannedTargets(planned);
          setMaintenanceSelections(targets);
          const names = uniqueStationsFromTargets(targets);
          setMultiStationMode(true);
          setSelectedStations(names);
          const defMap: Record<string, string> = {};
          for (const row of report.maintenanceDeficienciesByStation ?? []) {
            if (row.station?.trim()) {
              defMap[row.station.trim()] = row.text ?? "";
            }
          }
          setDeficienciesByStation(defMap);
        } else if (scheduleIsMaintenance) {
          const qOffice = searchParams.get("office")?.trim() ?? "";
          const qTargets = searchParams.get("targets")?.trim() ?? "";
          const qStations = searchParams.get("stations")?.trim() ?? "";
          applyMaintenanceFromSchedule(
            qOffice,
            qTargets,
            qStations,
            stationFromSchedule
          );
        } else if (additional.length > 0) {
          const cohort = [
            safeReportStation,
            ...additional.filter(Boolean),
          ].filter(Boolean);
          setMultiStationMode(true);
          setSelectedStations(cohort);
          const facilityList = parseStationFacilityAreas(
            loadedFacility,
            report?.additionalFacilityAreas ?? []
          );
          const map: Record<string, StationFacilityArea[]> = {};
          cohort.forEach((name, i) => {
            const fac = facilityList[i];
            if (!fac) return;
            if (!map[name]) map[name] = [];
            if (!map[name].includes(fac)) map[name].push(fac);
          });
          setStationFacilityByStation(map);
          setFacilityAreas([]);
          setFacilityArea("");
        } else {
          const areas = parseStationFacilityAreas(
            loadedFacility,
            report?.additionalFacilityAreas ?? []
          );
          setFacilityAreas(areas);
          setFacilityArea(areas[0] ?? "");
          setMultiStationMode(false);
          setSelectedStations([]);
          setStationFacilityByStation({});
        }
        setStationName(safeReportStation || stationFromSchedule);
        const area = report?.facilityArea?.trim() ?? "";
        if (
          area === MANAGEMENT_OFFICE_FACILITY ||
          scheduleIsMaintenance
        ) {
          setOfficeWorkMode(false);
          setSelectedOfficeRolesByStation({});
          setOfficeWorkByKey({});
          setFacilityArea(MANAGEMENT_OFFICE_FACILITY);
          setManagementOffice(
            report?.managementOffice?.trim() ??
              searchParams.get("office")?.trim() ??
              ""
          );
          setMaintenanceMode(true);
          setProcessingRole("유지보수 용역");
        } else if (area === OFFICE_WORK_FACILITY || report?.officeWorkEntries?.length) {
          const entries = (report?.officeWorkEntries ?? []) as OfficeWorkEntry[];
          setOfficeWorkMode(true);
          setMaintenanceMode(false);
          setFacilityArea(OFFICE_WORK_FACILITY);
          setManagementOffice("");
          setOfficeWorkByKey(officeWorkEntriesToNotesMap(entries));
          const stationFromEntries = [
            ...new Set(
              entries
                .map((e: OfficeWorkEntry) => e.station.trim())
                .filter((s) => s && !isOfficeGeneralStation(s))
            ),
          ];
          const officeStations =
            stationFromEntries.length > 0
              ? stationFromEntries
              : [safeReportStation, ...additional].filter(
                  (s) => s && !isOfficeGeneralStation(s)
                );
          const visited =
            report.officeWorkVisitedStations?.length
              ? report.officeWorkVisitedStations.filter((s: string) =>
                  officeStations.includes(s)
                )
              : officeVisitedStationsFromEntries(entries, officeStations);
          setOfficeVisitedStations(visited);
          const rolesByStation: Record<string, string[]> = {};
          for (const e of entries) {
            const st = e.station.trim();
            const role = e.processingRole.trim();
            if (!st || !role || isOfficeGeneralStation(st)) continue;
            if (!rolesByStation[st]) rolesByStation[st] = [];
            if (!rolesByStation[st].includes(role)) rolesByStation[st].push(role);
          }
          setSelectedOfficeRolesByStation(rolesByStation);
          if (officeStations.length) {
            setMultiStationMode(true);
            setSelectedStations(officeStations);
          }
        } else if (
          isStationFacilityArea(area) &&
          !additional.length &&
          !report?.maintenanceVisitTargets?.length
        ) {
          const areas = parseStationFacilityAreas(
            area,
            report?.additionalFacilityAreas ?? []
          );
          setFacilityAreas(areas);
          setFacilityArea(areas[0] ?? area);
          setManagementOffice("");
          setMaintenanceMode(false);
          setOfficeWorkMode(false);
          setOfficeWorkByKey({});
          setSelectedOfficeRolesByStation({});
        } else if (isStationFacilityArea(facilityFromSchedule)) {
          const areas = parseStationFacilityAreas(facilityFromSchedule, []);
          setFacilityAreas(areas);
          setFacilityArea(facilityFromSchedule);
          setManagementOffice("");
          setMaintenanceMode(false);
          setOfficeWorkMode(false);
          setOfficeWorkByKey({});
          setSelectedOfficeRolesByStation({});
        } else {
          setFacilityArea("");
          setFacilityAreas([]);
          setManagementOffice("");
          setMaintenanceMode(false);
          setOfficeWorkMode(false);
          setOfficeWorkByKey({});
          setSelectedOfficeRolesByStation({});
        }
        if (stationFromSchedule && !fromReport) {
          void fetch("/api/stations", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: stationFromSchedule }),
          });
        }
        setDone(report?.done ?? "");
        setPlan(report?.plan ?? "");
        setIssues(report?.issues ?? "");
        setDeficiencies(report?.deficiencies ?? "");
        setExtraMemoOpen(
          Boolean(
            report?.plan?.trim() ||
              report?.issues?.trim() ||
              report?.deficiencies?.trim()
          )
        );
        setBeforePhotoAt(report?.beforePhotoAt);
        setAfterPhotoAt(report?.afterPhotoAt);
        setHasBeforePhoto(!!report?.hasBeforePhoto);
        setHasAfterPhoto(!!report?.hasAfterPhoto);
        setWorkMinutes(
          report?.workMinutes ??
            calcWorkMinutes(report?.beforePhotoAt, report?.afterPhotoAt)
        );
      })
      .finally(() => setLoading(false));
  }, [memberId, date, searchParams]);

  function applyWorkTime(
    before?: string,
    after?: string,
    minutes?: number | null
  ) {
    if (before) setBeforePhotoAt(before);
    if (after) setAfterPhotoAt(after);
    setWorkMinutes(
      minutes ??
        calcWorkMinutes(before ?? beforePhotoAt, after ?? afterPhotoAt)
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (formLockedByCohort) {
      setStatus(
        `${cohortCoverage!.recordedByMemberName}님이 동행 일지를 작성했습니다. 추가 기록이 필요 없습니다.`
      );
      return;
    }
    if (officeWorkMode) {
      const listedStations =
        selectedStations.length > 0
          ? selectedStations
          : stationName.trim()
            ? [stationName.trim()]
            : [];
      const hasVisited = officeVisitedStations.length > 0;
      let officeEntries: OfficeWorkEntry[];

      if (hasVisited) {
        const selectedRoleCount = officeVisitedStations.reduce(
          (n, st) => n + (selectedOfficeRolesByStation[st]?.length ?? 0),
          0
        );
        if (!selectedRoleCount) {
          setStatus("역사별로 공종을 1개 이상 선택해 주세요.");
          return;
        }
        const raw = notesMapToOfficeWorkEntries(officeWorkByKey).filter(
          (e) =>
            !isOfficeAiAutomationRole(e.processingRole) &&
            officeVisitedStations.includes(e.station.trim()) &&
            (selectedOfficeRolesByStation[e.station.trim()] ?? []).includes(
              e.processingRole.trim()
            )
        );
        officeEntries = filledOfficeWorkEntries(raw);
        if (!officeEntries.length) {
          setStatus("체크한 역사·공종별로 작업 내용을 최소 1건 입력해 주세요.");
          return;
        }
      } else {
        const aiKey = officeWorkEntryKey(
          OFFICE_GENERAL_STATION,
          OFFICE_AI_AUTOMATION_ROLE
        );
        const aiDone = officeWorkByKey[aiKey]?.trim() ?? "";
        if (!aiDone) {
          setStatus(
            "역 작업이 없을 때는 AI를 통한 자동화 작업 내용을 입력해 주세요."
          );
          return;
        }
        officeEntries = [
          {
            station: OFFICE_GENERAL_STATION,
            processingRole: OFFICE_AI_AUTOMATION_ROLE,
            done: aiDone,
          },
        ];
      }

      const primaryStation = hasVisited
        ? officeVisitedStations[0]!
        : listedStations[0] ?? OFFICE_GENERAL_STATION;
      const reportStationNames = hasVisited
        ? officeVisitedStations.length > 1
          ? officeVisitedStations
          : undefined
        : listedStations.length > 1
          ? listedStations
          : undefined;

      setStatus("저장 중...");
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          memberId,
          date,
          stationName: primaryStation,
          stationNames: reportStationNames,
          facilityArea: OFFICE_WORK_FACILITY,
          officeWorkEntries: officeEntries,
          officeWorkVisitedStations: hasVisited
            ? officeVisitedStations
            : undefined,
          plan,
          issues,
          deficiencies,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setDone(data.report?.done ?? "");
        setStatus("저장되었습니다. 일정에 자동 반영되었습니다.");
        clearDailyDraft(memberId, date);
      } else {
        const err = await res.json();
        setStatus(err.error ?? "저장에 실패했습니다.");
      }
      return;
    }
    if (maintenanceMode && !maintenanceSelections.length) {
      setStatus("실제 방문한 점검 대상(역·기능실)을 1건 이상 남겨 주세요.");
      return;
    }
    const stations =
      maintenanceMode && maintenanceSelections.length > 0
        ? uniqueStationsFromTargets(maintenanceSelections)
        : (fieldVisitMode || multiStationMode) && selectedStations.length > 0
          ? selectedStations
          : stationName.trim()
            ? [stationName.trim()]
            : [];
    if (!stations.length) {
      setStatus("역사명을 선택하거나 입력해 주세요.");
      return;
    }
    const facilityAreasForSave = maintenanceMode
      ? [...new Set(maintenanceSelections.map((t) => t.facility))]
      : perStationFacilities
        ? activeStations.flatMap(
            (st) => stationFacilityByStation[st] ?? stationFacilitiesMap[st] ?? []
          )
        : derivedFacilityAreas.length > 0
          ? derivedFacilityAreas
        : facilityAreas.length > 0
          ? facilityAreas
          : facilityArea
            ? [facilityArea as StationFacilityArea]
            : [];
    if (!maintenanceMode && facilityAreasForSave.length === 0) {
      setStatus(
        perStationFacilities
          ? "각 역사마다 작업 장소를 1곳 이상 선택해 주세요."
          : "작업 장소(전기실·변전소·역무실)를 1곳 이상 선택해 주세요."
      );
      return;
    }
    if (!effectiveRole) {
      setStatus("\uacf5\uc885\uc744 \uc120\ud0dd\ud574 \uc8fc\uc138\uc694.");
      return;
    }
    if (processingRole !== ROLE_OTHER) {
      const hasAnyAllowed = facilityAreasForSave.some((f) =>
        isProcessingRoleAllowedForFacility(effectiveRole, f)
      );
      if (!hasAnyAllowed) {
      setStatus(
        perStationFacilities || facilityAreasForSave.length > 1
          ? "선택한 역사에 실제 있는 공종을 선택해 주세요."
          : `${facilityAreasForSave[0]}에서는 선택할 수 없는 공종입니다. 작업 장소에 맞는 공종을 선택해 주세요.`
      );
      return;
      }
    }
    const maintenanceDeficiencyRows = maintenanceMode
      ? Object.entries(deficienciesByStation)
          .filter(([, text]) => text.trim())
          .map(([station, text]) => ({ station, text: text.trim() }))
      : undefined;
    const mergedDeficiencies = maintenanceMode
      ? maintenanceDeficiencyRows?.length
        ? maintenanceDeficiencyRows
            .map(({ station, text }) => `【${station}】\n${text}`)
            .join("\n\n")
        : ""
      : deficiencies;

    const visitSlots = maintenanceMode
      ? maintenanceSelections.map((t) => ({
          station: t.station.trim(),
          facility: t.facility,
        }))
      : stations.flatMap((st) => {
          const areas = perStationFacilities
            ? (stationFacilityByStation[st] ?? [])
            : facilityAreas.length > 0
              ? facilityAreas
              : facilityArea
                ? [facilityArea as StationFacilityArea]
                : [];
          return areas.map((facility) => ({ station: st, facility }));
        });
    const slotStations = visitSlots.map((s) => s.station);
    const slotFacilities = visitSlots.map((s) => s.facility);
    const sameStationMultiFacility =
      !maintenanceMode &&
      slotStations.length > 1 &&
      new Set(slotStations).size === 1;

    setStatus("\uc800\uc7a5 \uc911...");
    const res = await fetch("/api/reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        memberId,
        date,
        stationName: slotStations[0] ?? stations[0],
        stationNames:
          !maintenanceMode && slotStations.length > 1 && !sameStationMultiFacility
            ? slotStations
            : undefined,
        facilityArea: maintenanceMode
          ? MANAGEMENT_OFFICE_FACILITY
          : slotFacilities[0],
        additionalFacilityAreas:
          !maintenanceMode && slotFacilities.length > 1
            ? slotFacilities.slice(1)
            : undefined,
        maintenanceVisitTargets: maintenanceMode
          ? maintenanceSelections
          : undefined,
        maintenancePlannedTargets: maintenanceMode
          ? maintenancePlannedTargets.length
            ? maintenancePlannedTargets
            : maintenanceSelections
          : undefined,
        maintenanceDeficienciesByStation: maintenanceDeficiencyRows,
        managementOffice: maintenanceMode ? managementOffice : undefined,
        processingRole: effectiveRole,
        done,
        plan,
        issues,
        deficiencies: mergedDeficiencies,
        beforePhotoAt: maintenanceMode ? undefined : beforePhotoAt,
        afterPhotoAt: maintenanceMode ? undefined : afterPhotoAt,
        visitGroupId,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      setWorkMinutes(data.report?.workMinutes ?? workMinutes);
      setStatus("\uc800\uc7a5\ub418\uc5c8\uc2b5\ub2c8\ub2e4. \uc77c\uc815\uc5d0 \uc790\ub3d9 \ubc18\uc601\ub418\uc5c8\uc2b5\ub2c8\ub2e4.");
      clearDailyDraft(memberId, date);
    } else {
      const err = await res.json();
      setStatus(err.error ?? "\uc800\uc7a5\uc5d0 \uc2e4\ud328\ud588\uc2b5\ub2c8\ub2e4.");
    }
  }

  return (
    <>
      <Header
        teamName={teamName}
        subtitle={`${date} · 일일 업무 기록`}
      />
      {searchParams.get("station")?.trim() ? (
        <p className="muted -mt-4 mb-4 text-sm">
          <a href="/" className="link-accent">
            ← 홈
          </a>
          <span className="ml-2">
            · {searchParams.get("station")?.trim()}
          </span>
        </p>
      ) : (
        <p className="muted -mt-4 mb-4 text-sm">
          <a href="/" className="link-accent">
            ← 홈 일정
          </a>
        </p>
      )}

      <form
        onSubmit={handleSubmit}
        className="card space-y-5 p-5"
        aria-disabled={formLockedByCohort}
      >
        {formLockedByCohort ? (
          <div className="rounded-lg border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-950">
            <p className="font-semibold">동행 일지가 이미 작성되었습니다</p>
            <p className="mt-1 text-violet-900/90">
              <strong>{cohortCoverage.recordedByMemberName}</strong>님이 같은
              방문(동행) 일지를 남겼습니다. 이 날짜에는 추가 일일 기록이 필요
              없습니다.
            </p>
          </div>
        ) : null}
        <fieldset
          disabled={formLockedByCohort}
          className="space-y-5 disabled:opacity-60"
        >
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="member">
              {"\uc791\uc131\uc790"}
            </label>
            <select
              id="member"
              className="select"
              value={memberId}
              onChange={(e) => setMemberId(e.target.value)}
            >
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="date">
              {"\ub0a0\uc9dc"}
            </label>
            <input
              id="date"
              type="date"
              className="input"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
        </div>

        {!maintenanceLocked ? (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${
                fieldVisitMode
                  ? "border-indigo-300 bg-indigo-50 text-indigo-950"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              }`}
              disabled={loading || formLockedByCohort}
              onClick={() => {
                setOfficeWorkMode(false);
                setMaintenanceMode(false);
                setSelectedOfficeRolesByStation({});
                setOfficeWorkByKey({});
                setOfficeVisitedStations([]);
                setFacilityArea("");
                setFacilityAreas([]);
                setManagementOffice("");
                setMaintenanceSelections([]);
                setMaintenancePlannedTargets([]);
                setDeficienciesByStation({});
                setProcessingRole("");
                setCustomRole("");
              }}
            >
              외근
            </button>
            <button
              type="button"
              className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${
                officeWorkMode
                  ? "border-sky-300 bg-sky-50 text-sky-950"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              }`}
              disabled={loading || formLockedByCohort}
              onClick={() => {
                setOfficeWorkMode(true);
                setMaintenanceMode(false);
                setFacilityArea(OFFICE_WORK_FACILITY);
                setMultiStationMode(true);
                setManagementOffice("");
                setMaintenanceSelections([]);
                setMaintenancePlannedTargets([]);
                setDeficienciesByStation({});
                setStationFacilityByStation({});
                setSelectedOfficeRolesByStation({});
                setProcessingRole("");
                setCustomRole("");
              }}
            >
              사무 작업
            </button>
          </div>
        ) : null}

        <StationPicker
          value={stationName}
          onChange={setStationName}
          facilityArea={facilityArea}
          onFacilityChange={maintenanceMode ? setFacilityArea : undefined}
          facilityAreas={facilityAreas}
          onFacilityAreasChange={(areas) => {
            setFacilityAreas(areas);
            setFacilityArea(areas[0] ?? "");
          }}
          requireFacility={false}
          disabled={loading}
          enableMetroPicker={!maintenanceLocked}
          maintenanceMode={maintenanceMode}
          lockMaintenanceMode={maintenanceLocked}
          hideMaintenanceVisitList={maintenanceLocked}
          officeWorkMode={officeWorkMode}
          fieldVisitMode={fieldVisitMode}
          officeVisitedStations={officeVisitedStations}
          onOfficeVisitedStationsChange={setOfficeVisitedStations}
          onMaintenanceModeChange={(enabled) => {
            if (maintenanceLocked) return;
            setMaintenanceMode(enabled);
            if (enabled) {
              setOfficeWorkMode(false);
              setSelectedOfficeRolesByStation({});
              setOfficeWorkByKey({});
              setOfficeVisitedStations([]);
              setFacilityArea(MANAGEMENT_OFFICE_FACILITY);
              setManagementOffice("");
              setStationFacilityByStation({});
              setMultiStationMode(false);
              setSelectedStations([]);
              setMaintenanceSelections([]);
              setMaintenancePlannedTargets([]);
              setDeficienciesByStation({});
              setProcessingRole("유지보수 용역");
              setCustomRole("");
            } else {
              setManagementOffice("");
              setFacilityArea("");
              setStationFacilityByStation({});
              setSelectedStations([]);
              setMaintenanceSelections([]);
              setMaintenancePlannedTargets([]);
              setDeficienciesByStation({});
              setMultiStationMode(false);
            }
          }}
          managementOffice={managementOffice}
          onManagementOfficeChange={setManagementOffice}
          multiStationMode={officeWorkMode ? true : multiStationMode}
          onMultiStationModeChange={officeWorkMode ? undefined : setMultiStationMode}
          selectedStations={selectedStations}
          onSelectedStationsChange={handleSelectedStationsChange}
          stationFacilityByStation={stationFacilityByStation}
          onStationFacilityByStationChange={
            officeWorkMode || fieldVisitMode
              ? undefined
              : setStationFacilityByStation
          }
          maintenanceSelections={maintenanceSelections}
          onMaintenanceSelectionsChange={setMaintenanceSelections}
        />

        {officeWorkMode ? (
          <OfficeWorkDailyForm
            stations={activeStations}
            visitedStations={officeVisitedStations}
            selectedRolesByStation={selectedOfficeRolesByStation}
            onSelectedRolesByStationChange={setSelectedOfficeRolesByStation}
            workByKey={officeWorkByKey}
            onWorkByKeyChange={setOfficeWorkByKey}
            disabled={loading || formLockedByCohort}
          />
        ) : null}

        {maintenanceLocked && managementOffice ? (
          <MaintenanceDailyVisitForm
            managementOffice={managementOffice}
            plannedTargets={
              maintenancePlannedTargets.length
                ? maintenancePlannedTargets
                : maintenanceSelections
            }
            visitedTargets={maintenanceSelections}
            onVisitedChange={setMaintenanceSelections}
            deficienciesByStation={deficienciesByStation}
            onDeficienciesChange={setDeficienciesByStation}
            disabled={loading || formLockedByCohort}
          />
        ) : null}

        {!officeWorkMode ? (
        <div>
          <label className="label" htmlFor="role">
            {"\uacf5\uc885 "}
            <span className="text-red-600">*</span>
          </label>
          {!allFacilitiesChosen ? (
            <p className="muted text-xs">
              {maintenanceMode
                ? "점검 대상을 선택하면 공종이 활성화됩니다."
                : "작업 장소를 선택하면 공종 목록이 표시됩니다."}
            </p>
          ) : null}
          <select
            id="role"
            className="select"
            value={
              facilityArea === MANAGEMENT_OFFICE_FACILITY
                ? "유지보수 용역"
                : processingRole
            }
            onChange={(e) => setProcessingRole(e.target.value)}
            disabled={
              loading ||
              !allFacilitiesChosen ||
              facilityArea === MANAGEMENT_OFFICE_FACILITY
            }
          >
            <option value="">
              {allFacilitiesChosen ? "선택하세요" : "작업 장소를 먼저 선택하세요"}
            </option>
            {rolesForFacility.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          {processingRole === ROLE_OTHER && (
            <input
              className="input mt-2"
              placeholder={"\uacf5\uc885 \uc9c1\uc811 \uc785\ub825 (이전 기록 등)"}
              value={customRole}
              onChange={(e) => setCustomRole(e.target.value)}
              disabled={loading}
            />
          )}
        </div>
        ) : null}

        {!maintenanceMode && !officeWorkMode ? (
        <section>
          <h2 className="mb-3 text-sm font-bold">
            {"\uc791\uc5c5 \uc804\u00b7\ud6c4 \uc0ac\uc9c4"}
          </h2>
          <div className="photo-grid">
            <PhotoCapture
              label={"\uc791\uc5c5 \uc804"}
              slot="before"
              memberId={memberId}
              date={date}
              recordedAt={beforePhotoAt}
              hasPhoto={hasBeforePhoto}
              disabled={loading}
              onUploaded={({ recordedAt, workMinutes }) => {
                setHasBeforePhoto(true);
                applyWorkTime(recordedAt, undefined, workMinutes);
              }}
            />
            <PhotoCapture
              label={"\uc791\uc5c5 \ud6c4"}
              slot="after"
              memberId={memberId}
              date={date}
              recordedAt={afterPhotoAt}
              hasPhoto={hasAfterPhoto}
              disabled={loading}
              onUploaded={({ recordedAt, workMinutes }) => {
                setHasAfterPhoto(true);
                applyWorkTime(undefined, recordedAt, workMinutes);
              }}
            />
          </div>
          <div className="mt-3">
            <WorkTimeDisplay
              beforeAt={beforePhotoAt}
              afterAt={afterPhotoAt}
              workMinutes={workMinutes}
            />
          </div>
        </section>
        ) : null}

        {!officeWorkMode ? (
        <div>
          <label className="label" htmlFor="done">
            {"\uae08\uc77c \uc218\ud589 \uc5c5\ubb34"}
          </label>
          <textarea
            id="done"
            className="textarea"
            placeholder={"\uc624\ub298 \uc644\ub8cc\u00b7\uc9c4\ud589\ud55c \uc5c5\ubb34"}
            value={done}
            onChange={(e) => setDone(e.target.value)}
            disabled={loading}
          />
        </div>
        ) : (
          done.trim() ? (
            <div>
              <p className="label text-sm font-medium text-slate-800">
                금일 수행 업무 (자동 요약)
              </p>
              <pre className="muted max-h-40 overflow-y-auto whitespace-pre-wrap rounded-lg border border-sky-100 bg-sky-50/50 px-3 py-2 text-xs">
                {done}
              </pre>
            </div>
          ) : null
        )}

        <div className="rounded-lg border border-slate-200 bg-slate-50/50">
          <button
            type="button"
            className="flex w-full items-center justify-between px-3 py-2.5 text-left text-sm font-medium text-slate-800"
            onClick={() => setExtraMemoOpen((o) => !o)}
          >
            추가 메모
            <span className="text-xs font-normal text-slate-500">
              {extraMemoOpen ? "접기" : "익일 계획 · 이슈 · 미비사항"}
            </span>
          </button>
          {extraMemoOpen ? (
            <div className="space-y-4 border-t border-slate-200 px-3 pb-3 pt-2">
              <div>
                <label className="label" htmlFor="plan">
                  {"\uc775\uc77c \uacc4\ud68d"}
                </label>
                <textarea
                  id="plan"
                  className="textarea"
                  value={plan}
                  onChange={(e) => setPlan(e.target.value)}
                  disabled={loading}
                />
              </div>
              <div>
                <label className="label" htmlFor="issues">
                  {"\uc774\uc288 / \uc9c0\uc6d0 \uc694\uccad"}
                </label>
                <textarea
                  id="issues"
                  className="textarea"
                  value={issues}
                  onChange={(e) => setIssues(e.target.value)}
                  disabled={loading}
                />
              </div>
              {!maintenanceMode && !officeWorkMode ? (
                <div>
                  <label className="label" htmlFor="deficiencies">
                    {"\ubbf8\ube44\uc0ac\ud56d"}
                  </label>
                  <textarea
                    id="deficiencies"
                    className="textarea"
                    placeholder={
                      "\ubbf8\uc644\ub8cc, \ubcf4\uc644 \ud544\uc694, \uc7ac\uc791\uc5c5 \uc608\uc815 \ub4f1"
                    }
                    value={deficiencies}
                    onChange={(e) => setDeficiencies(e.target.value)}
                    disabled={loading}
                  />
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading || formLockedByCohort}
          >
            {"\uc800\uc7a5"}
          </button>
          {status && <span className="muted">{status}</span>}
        </div>
        </fieldset>
      </form>
    </>
  );
}

export default function DailyPage() {
  return (
    <Suspense
      fallback={
        <p className="muted py-8 text-center text-sm">일일 기록 불러오는 중…</p>
      }
    >
      <DailyPageInner />
    </Suspense>
  );
}
