"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { ManagementOfficePicker } from "@/components/ManagementOfficePicker";
import { StationFacilityPicker } from "@/components/StationFacilityPicker";
import {
  formatStationNameWithOffice,
  getOfficeMetroLine,
  resolveManagementOffice,
} from "@/lib/eposStationOffices";
import {
  filterMetroStations,
  formatMetroStationValue,
  getMetroLineColor,
  getMetroStationsForLine,
  normalizeStationName,
  parseMetroStationValue,
  type MetroLineInfo,
} from "@/lib/metroStations";
import { MaintenanceVisitList } from "@/components/MaintenanceVisitList";
import {
  buildMaintenanceSelectionsForOffice,
  formatFacilitiesLabelWithMaintenanceAnnotations,
  getMaintenancePlanFacilities,
  getMaintenancePlanFacilitiesForStation,
  isStationInMaintenancePlan,
  mergeFacilitiesForStationDisplay,
} from "@/lib/maintenancePlan";
import {
  formatEposFacilitiesLabel,
  getEposProductFacilities,
  getEposProductForDisplayName,
  hasEposProductAtStation,
  hasEposProductAtStationForMaintenance,
  isMaintenancePlanPrimaryStation,
} from "@/lib/eposProductStations";
import {
  maintenanceTargetKey,
  formatMaintenanceVisitSummary,
  uniqueStationsFromTargets,
  type MaintenanceVisitTarget,
} from "@/lib/maintenanceVisit";
import {
  formatStationVisitLabel,
  MANAGEMENT_OFFICE_FACILITY,
  type StationFacilityArea,
} from "@/lib/stationFacility";
import { shortStationLabel } from "@/lib/visitGroup";

interface StationPickerProps {
  value: string;
  onChange: (name: string) => void;
  disabled?: boolean;
  /** 호선 → 역사명 선택 (서울교통공사 1~9호선) */
  enableMetroPicker?: boolean;
  /** 호선 목록에 없을 때 직접 입력 */
  enableDirectInput?: boolean;
  /** 역사 선택 후 작업 장소 (전기실·변전소·역무실) */
  facilityArea?: string;
  onFacilityChange?: (area: StationFacilityArea | "") => void;
  /** 작업 장소 필수 (일일기록) */
  requireFacility?: boolean;
  /** 유지보수 용역(관리소 단위) */
  maintenanceMode?: boolean;
  onMaintenanceModeChange?: (enabled: boolean) => void;
  managementOffice?: string;
  onManagementOfficeChange?: (officeId: string) => void;
  /** 여러 역 한번에 선택 */
  multiStationMode?: boolean;
  onMultiStationModeChange?: (enabled: boolean) => void;
  selectedStations?: string[];
  onSelectedStationsChange?: (stations: string[]) => void;
  /** 여러 역 선택 시 역별 작업 장소 */
  stationFacilityByStation?: Record<string, StationFacilityArea | "">;
  onStationFacilityByStationChange?: (
    map: Record<string, StationFacilityArea | "">
  ) => void;
  /** 유지보수: 역·기능실 단위 선택 */
  maintenanceSelections?: MaintenanceVisitTarget[];
  onMaintenanceSelectionsChange?: (targets: MaintenanceVisitTarget[]) => void;
  /** 일일기록: 유지보수 일정에서 진입 시 해제 불가 */
  lockMaintenanceMode?: boolean;
  /** 일일기록: 역·기능실 UI를 페이지 전용 폼으로 대체 */
  hideMaintenanceVisitList?: boolean;
  /** 사무 작업: 역 다중 선택, 작업 장소·유지보수 UI 숨김 */
  officeWorkMode?: boolean;
  /** 역사 히스토리 등: 정기점검계획서 기능실에 (유지보수 용역) 표기 */
  showMaintenanceFacilityLabels?: boolean;
  /** 사무 작업: 오늘 실제 작업한 역 (체크) */
  officeVisitedStations?: string[];
  onOfficeVisitedStationsChange?: (stations: string[]) => void;
}

export function StationPicker({
  value,
  onChange,
  disabled,
  enableMetroPicker = true,
  enableDirectInput = true,
  facilityArea = "",
  onFacilityChange,
  requireFacility = false,
  maintenanceMode = false,
  onMaintenanceModeChange,
  managementOffice = "",
  onManagementOfficeChange,
  multiStationMode = false,
  onMultiStationModeChange,
  selectedStations = [],
  onSelectedStationsChange,
  stationFacilityByStation = {},
  onStationFacilityByStationChange,
  maintenanceSelections = [],
  onMaintenanceSelectionsChange,
  lockMaintenanceMode = false,
  hideMaintenanceVisitList = false,
  officeWorkMode = false,
  showMaintenanceFacilityLabels = false,
  officeVisitedStations = [],
  onOfficeVisitedStationsChange,
}: StationPickerProps) {
  const effectiveMaintenanceMode = lockMaintenanceMode || maintenanceMode;
  const [lines, setLines] = useState<MetroLineInfo[]>([]);
  const [stationListOpen, setStationListOpen] = useState(false);

  const [selectedLine, setSelectedLine] = useState<number | "">("");
  const [selectedStation, setSelectedStation] = useState("");
  const [stationQuery, setStationQuery] = useState("");

  const [useDirectInput, setUseDirectInput] = useState(false);
  const [directValue, setDirectValue] = useState("");

  useEffect(() => {
    if (!enableMetroPicker) return;
    fetch("/api/metro/lines")
      .then((r) => r.json())
      .then((d) => setLines(d.lines ?? []));
  }, [enableMetroPicker]);

  useEffect(() => {
    const parsed = parseMetroStationValue(value);
    if (parsed.line != null && parsed.stationName) {
      setSelectedLine(parsed.line);
      setSelectedStation(parsed.stationName);
      setUseDirectInput(false);
      setDirectValue("");
      return;
    }
    if (value.trim() && parsed.line == null) {
      setUseDirectInput(true);
      setDirectValue(value);
      setSelectedLine("");
      setSelectedStation("");
    } else if (!value.trim()) {
      setSelectedLine("");
      setSelectedStation("");
      setUseDirectInput(false);
      setDirectValue("");
    }
  }, [value]);

  const allLineStations = useMemo(() => {
    if (selectedLine === "") return [];
    return getMetroStationsForLine(selectedLine);
  }, [selectedLine]);

  const filteredStations = useMemo(() => {
    if (selectedLine === "") return [];
    const q = stationQuery.trim();
    let list = q
      ? filterMetroStations(selectedLine, q)
      : allLineStations;
    const lineNum = typeof selectedLine === "number" ? selectedLine : null;
    if (effectiveMaintenanceMode && managementOffice && lineNum != null) {
      list = list.filter((s) =>
        isStationInMaintenancePlan(managementOffice, lineNum, s.name)
      );
    }
    return [...list].sort((a, b) => {
      if (lineNum == null) return a.name.localeCompare(b.name, "ko");
      const aPrimary = isMaintenancePlanPrimaryStation(
        lineNum,
        a.name,
        effectiveMaintenanceMode ? managementOffice : undefined
      );
      const bPrimary = isMaintenancePlanPrimaryStation(
        lineNum,
        b.name,
        effectiveMaintenanceMode ? managementOffice : undefined
      );
      if (aPrimary !== bPrimary) return aPrimary ? -1 : 1;
      const ha = hasEposProductAtStationForMaintenance(
        lineNum,
        a.name,
        effectiveMaintenanceMode ? managementOffice : undefined
      );
      const hb = hasEposProductAtStationForMaintenance(
        lineNum,
        b.name,
        effectiveMaintenanceMode ? managementOffice : undefined
      );
      if (ha !== hb) return ha ? -1 : 1;
      return a.name.localeCompare(b.name, "ko");
    });
  }, [
    selectedLine,
    stationQuery,
    allLineStations,
    effectiveMaintenanceMode,
    managementOffice,
  ]);

  function handleMaintenanceToggle(enabled: boolean) {
    onMaintenanceModeChange?.(enabled);
    if (enabled) {
      onFacilityChange?.(MANAGEMENT_OFFICE_FACILITY as StationFacilityArea);
      onManagementOfficeChange?.("");
    } else {
      onManagementOfficeChange?.("");
      onFacilityChange?.("");
    }
    setSelectedLine("");
    setSelectedStation("");
    setStationQuery("");
    onChange("");
  }

  function handleManagementOfficePick(officeId: string) {
    onManagementOfficeChange?.(officeId);
    if (!officeId) {
      setSelectedLine("");
      setSelectedStation("");
      setStationQuery("");
      onSelectedStationsChange?.([]);
      onMaintenanceSelectionsChange?.([]);
      if (value.trim()) onChange("");
      return;
    }

    onFacilityChange?.(MANAGEMENT_OFFICE_FACILITY as StationFacilityArea);

    const office = resolveManagementOffice(officeId);
    const line = office ? getOfficeMetroLine(office) : null;

    if (line != null) {
      setSelectedLine(line);
      setUseDirectInput(false);
      setStationListOpen(true);
    }

    const defaults = buildMaintenanceSelectionsForOffice(officeId);
    onMaintenanceSelectionsChange?.(defaults);
    const stationNames = uniqueStationsFromTargets(defaults);
    if (stationNames.length > 0) {
      onMultiStationModeChange?.(true);
      onSelectedStationsChange?.(stationNames);
      onChange(stationNames[0]!);
      for (const name of stationNames) {
        void registerStation(name);
      }
    } else {
      setSelectedStation("");
      setStationQuery("");
      if (value.trim()) onChange("");
    }
  }

  const productFacilitiesForSelection = useMemo(() => {
    if (selectedLine === "" || !selectedStation) return [];
    return getEposProductFacilities(selectedLine, selectedStation);
  }, [selectedLine, selectedStation]);

  const productFacilitiesForValue = useMemo(() => {
    const parsed = parseMetroStationValue(value);
    if (parsed.line == null || !parsed.stationName) return [];
    return getEposProductFacilities(parsed.line, parsed.stationName);
  }, [value]);

  function setStationValue(name: string) {
    if (name.trim() !== value.trim()) {
      onFacilityChange?.("");
    }
    onChange(name);
  }

  function addStationToMultiList(line: number, stationName: string) {
    if (!onSelectedStationsChange) return;
    const formatted = formatMetroStationValue(line, stationName);
    if (selectedStations.some((s) => s === formatted)) return;
    const next = [...selectedStations, formatted];
    onSelectedStationsChange(next);
    if (!value.trim()) onChange(formatted);
    void registerStation(formatted);
    setSelectedStation("");
    setStationQuery("");
    setStationListOpen(false);
  }

  function applyMetroSelection(line: number, stationName: string) {
    const formatted = formatMetroStationValue(line, stationName);
    if (
      effectiveMaintenanceMode &&
      managementOffice &&
      onMaintenanceSelectionsChange
    ) {
      const planFacilities = getMaintenancePlanFacilities(
        managementOffice,
        line,
        stationName
      );
      const keys = new Set(
        maintenanceSelections.map((t) =>
          maintenanceTargetKey(t.station, t.facility)
        )
      );
      const toAdd: MaintenanceVisitTarget[] = [];
      for (const facility of planFacilities) {
        const k = maintenanceTargetKey(formatted, facility);
        if (!keys.has(k)) {
          toAdd.push({ station: formatted, facility, fromPlan: true });
        }
      }
      if (toAdd.length) {
        const next = [...maintenanceSelections, ...toAdd];
        onMaintenanceSelectionsChange(next);
        onSelectedStationsChange?.(uniqueStationsFromTargets(next));
        if (!value.trim()) onChange(formatted);
      }
      setSelectedStation("");
      setStationQuery("");
      setStationListOpen(false);
      void registerStation(formatted);
      return;
    }
    if ((multiStationMode || officeWorkMode) && onSelectedStationsChange) {
      addStationToMultiList(line, stationName);
      return;
    }
    setStationValue(formatted);
    void registerStation(formatted);
  }

  function removeFromMultiList(name: string) {
    if (!onSelectedStationsChange) return;
    const next = selectedStations.filter((s) => s !== name);
    onSelectedStationsChange(next);
    if (value === name) onChange(next[0] ?? "");
    if (onStationFacilityByStationChange) {
      const { [name]: _removed, ...rest } = stationFacilityByStation;
      onStationFacilityByStationChange(rest);
    }
  }

  const perStationFacilityPick =
    multiStationMode &&
    !maintenanceMode &&
    !officeWorkMode &&
    selectedStations.length >= 2 &&
    Boolean(onStationFacilityByStationChange);

  function setFacilityForStation(
    station: string,
    area: StationFacilityArea | ""
  ) {
    if (!onStationFacilityByStationChange) return;
    onStationFacilityByStationChange({
      ...stationFacilityByStation,
      [station]: area,
    });
    if (station === selectedStations[0]) {
      onFacilityChange?.(area);
    }
  }

  function facilitiesForStation(station: string): StationFacilityArea[] | undefined {
    const { facilities } = getEposProductForDisplayName(station);
    return facilities.length ? facilities : undefined;
  }

  function handleLineChange(lineStr: string) {
    if (!lineStr) {
      setSelectedLine("");
      setSelectedStation("");
      setStationListOpen(false);
      setStationValue("");
      return;
    }
    const line = Number(lineStr);
    setSelectedLine(line);
    setSelectedStation("");
    setStationQuery("");
    setStationListOpen(false);
    setStationValue("");
  }

  function handleStationPick(stationName: string) {
    if (selectedLine === "") return;
    setSelectedStation(stationName);
    setStationQuery("");
    setStationListOpen(false);
    applyMetroSelection(selectedLine, stationName);
  }

  async function registerStation(name: string) {
    const trimmed = name.trim();
    if (!trimmed) return;
    await fetch("/api/stations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: trimmed }),
    });
  }

  async function commitDirect() {
    const trimmed = directValue.trim();
    if (!trimmed) return;
    setStationValue(trimmed);
    await registerStation(trimmed);
  }

  const lineInfo = lines.find((l) => l.line === selectedLine);
  const lineColor =
    typeof selectedLine === "number"
      ? (lineInfo?.color ?? getMetroLineColor(selectedLine))
      : "";
  const metroLineStyle = lineColor
    ? ({ "--metro-line-color": lineColor } as CSSProperties)
    : undefined;

  const valueParsed = parseMetroStationValue(value);
  const valueLineColor =
    valueParsed.line != null ? getMetroLineColor(valueParsed.line) : "";

  function selectedStationRowStyle(name: string): CSSProperties | undefined {
    const { line } = parseMetroStationValue(name);
    if (line == null) return undefined;
    const c = getMetroLineColor(line);
    return { borderLeftColor: c, borderLeftWidth: 4 };
  }

  const canPickStation =
    !maintenanceMode || Boolean(managementOffice);

  return (
    <div className="station-picker">
      {officeWorkMode ? (
        <p className="mb-3 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-950">
          <strong>사무 작업</strong>: 호선·역사를 누르면 아래 목록에 추가됩니다. 공종과
          작업 내용은 아래에서 입력합니다.
        </p>
      ) : null}

      {onMultiStationModeChange && !maintenanceMode && !officeWorkMode ? (
        <label className="mb-3 flex cursor-pointer items-start gap-2 rounded-lg border border-indigo-200 bg-indigo-50/90 px-3 py-2.5">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={multiStationMode}
            disabled={disabled}
            onChange={(e) => {
              onMultiStationModeChange(e.target.checked);
              if (!e.target.checked) {
                onSelectedStationsChange?.([]);
                onStationFacilityByStationChange?.({});
              }
            }}
          />
          <span className="text-sm">
            <strong className="text-indigo-950">여러 역 한번에</strong>
            <span className="mt-0.5 block text-xs font-normal text-indigo-900/90">
              호선·역사를 누르면 아래 목록에 순서대로 추가됩니다.
            </span>
          </span>
        </label>
      ) : null}

      {onMaintenanceModeChange && !lockMaintenanceMode && !officeWorkMode ? (
        <label className="mb-3 flex cursor-pointer items-start gap-2 rounded-lg border border-amber-200 bg-amber-50/90 px-3 py-2.5">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={maintenanceMode}
            disabled={disabled}
            onChange={(e) => handleMaintenanceToggle(e.target.checked)}
          />
          <span className="text-sm">
            <strong className="text-amber-950">유지보수 용역</strong>
            <span className="mt-0.5 block text-xs font-normal text-amber-900/90">
              체크 시 전기관리소를 선택하면 정기점검계획서 대상 역·기능실만
              표시됩니다. 일일기록에서 미방문 기능실은 ×로 해제할 수 있습니다.
            </span>
          </span>
        </label>
      ) : null}

      {effectiveMaintenanceMode && onManagementOfficeChange ? (
        <div className="mb-4">
          <ManagementOfficePicker
            value={managementOffice}
            onChange={handleManagementOfficePick}
            disabled={disabled || (lockMaintenanceMode && Boolean(managementOffice))}
          />
          {managementOffice && selectedStations.length > 0 ? (
            <p className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50/90 px-3 py-2 text-xs text-emerald-950">
              <strong>{selectedStations.length}개 역</strong>이 이 관리소 소속으로
              자동 선택되었습니다. 아래 목록에서 확인·수정할 수 있습니다.
            </p>
          ) : null}
        </div>
      ) : null}

      {lockMaintenanceMode ? (
        <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
          <strong>유지보수 용역</strong> 일정에서 연결된 기록입니다. 아래에서
          방문·미방문 역과 역별 미비사항을 입력하세요.
        </p>
      ) : null}

      {!lockMaintenanceMode ? (
        <>
      <label className="label">
        역사명 <span className="text-red-600">*</span>
      </label>
      <p className="muted mb-3 text-xs">
        {effectiveMaintenanceMode ? (
          <>
            <strong>1단계 호선</strong> → <strong>2단계 역사명</strong>
            {managementOffice
              ? " (괄호 안은 소속 전기관리소)"
              : " — 먼저 위에서 관리소를 선택하세요"}
          </>
        ) : (
          <>
            <strong>1단계 호선</strong> → <strong>2단계 역사명</strong> 순으로
            선택하세요. (서울교통공사 1~9호선 데이터)
          </>
        )}
      </p>

      {enableMetroPicker && !useDirectInput && (
        <div
          className={`metro-picker-steps${lineColor ? " metro-picker-steps--lined" : ""}`}
          style={metroLineStyle}
        >
          <div className={`metro-step${lineColor ? " metro-step--lined" : ""}`}>
            <span
              className={`metro-step-num${lineColor ? " metro-step-num--lined" : ""}`}
              style={
                lineColor
                  ? { borderColor: lineColor, color: lineColor }
                  : undefined
              }
              aria-hidden
            >
              1
            </span>
            <div className="metro-step-body">
              <label className="label text-sm" htmlFor="metro-line">
                호선 선택
              </label>
              <select
                id="metro-line"
                className={`input mt-1${lineColor ? " metro-input--lined" : ""}`}
                style={lineColor ? { borderColor: lineColor } : undefined}
                value={selectedLine === "" ? "" : String(selectedLine)}
                    disabled={disabled || !canPickStation}
                    onChange={(e) => handleLineChange(e.target.value)}
                  >
                <option value="">호선을 선택하세요</option>
                {lines.map((l) => (
                  <option key={l.line} value={l.line}>
                    {l.label} ({l.stationCount}개 역)
                  </option>
                ))}
              </select>
              {lineInfo ? (
                <span
                  className="metro-line-chip mt-2"
                  style={{
                    backgroundColor: lineInfo.color,
                    borderColor: lineInfo.color,
                  }}
                >
                  {lineInfo.label}
                </span>
              ) : null}
            </div>
          </div>

          <div className={`metro-step${lineColor ? " metro-step--lined" : ""}`}>
            <span
              className={`metro-step-num${lineColor ? " metro-step-num--lined" : ""}`}
              style={
                lineColor
                  ? { borderColor: lineColor, color: lineColor }
                  : undefined
              }
              aria-hidden
            >
              2
            </span>
            <div className="metro-step-body">
              <label className="label text-sm" htmlFor="metro-station-search">
                역사명 선택
              </label>
              {!canPickStation ? (
                <p className="muted mt-1 text-xs">
                  유지보수 작업은 먼저 전기관리소를 선택해 주세요.
                </p>
              ) : selectedLine === "" ? (
                <p className="muted mt-1 text-xs">먼저 호선을 선택해 주세요.</p>
              ) : (
                <>
                  {selectedStation ? (
                    <p className="mt-1 text-sm">
                      선택한 역:{" "}
                      <strong>
                        {formatMetroStationValue(selectedLine, selectedStation)}
                      </strong>
                    </p>
                  ) : null}

                  <button
                    type="button"
                    className={`metro-station-list-toggle mt-2${lineColor ? " metro-station-list-toggle--lined" : ""}`}
                    style={
                      lineColor
                        ? {
                            borderColor: lineColor,
                            color: lineColor,
                            ["--metro-line-color" as string]: lineColor,
                          }
                        : undefined
                    }
                    disabled={disabled}
                    aria-expanded={stationListOpen}
                    aria-controls="metro-station-list-panel"
                    onClick={() => setStationListOpen((open) => !open)}
                  >
                    {stationListOpen
                      ? "역 목록 닫기"
                      : `${lineInfo?.label ?? ""} 역 목록에서 선택 (${allLineStations.length}개)`}
                  </button>

                  {stationListOpen ? (
                    <div
                      id="metro-station-list-panel"
                      className="metro-station-list-panel mt-2"
                    >
                      <input
                        id="metro-station-search"
                        type="search"
                        className={`input${lineColor ? " metro-input--lined" : ""}`}
                        style={lineColor ? { borderColor: lineColor } : undefined}
                        placeholder={`역 이름 검색 (예: 서울, 종로)`}
                        value={stationQuery}
                        disabled={disabled}
                        autoComplete="off"
                        onChange={(e) => setStationQuery(e.target.value)}
                      />
                      <p className="muted mt-2 text-xs">
                        아래 목록에서 역을 눌러 선택하세요.
                        {stationQuery.trim()
                          ? ` · 검색 결과 ${filteredStations.length}개`
                          : ` · 전체 ${allLineStations.length}개`}
                        <span className="block mt-1">
                          {maintenanceMode && managementOffice ? (
                            <>
                              <strong className="text-slate-800">
                                진한 글씨
                              </strong>
                              = 정기점검계획 ·{" "}
                              <span className="text-slate-400">
                                흐린 글씨
                              </span>
                              = 기능실 현황(서브)만
                            </>
                          ) : (
                            <>
                              <strong className="text-slate-700">
                                진한 글씨
                              </strong>
                              = EPOS 설치 역 ·{" "}
                              <span className="text-slate-400">
                                흐린 글씨
                              </span>
                              = 미설치
                            </>
                          )}
                        </span>
                      </p>
                      <div
                        className={`metro-station-list mt-2${lineColor ? " metro-station-list--lined" : ""}`}
                        style={lineColor ? { borderColor: lineColor } : undefined}
                        role="listbox"
                        aria-label={`${lineInfo?.label ?? ""} 역 목록`}
                      >
                        {filteredStations.length === 0 ? (
                          <p className="muted p-3 text-xs text-center">
                            일치하는 역이 없습니다. 검색어를 바꿔 보세요.
                          </p>
                        ) : (
                          filteredStations.map((s) => {
                            const lineNum =
                              typeof selectedLine === "number" ? selectedLine : null;
                            const inPlan =
                              lineNum != null &&
                              isMaintenancePlanPrimaryStation(
                                lineNum,
                                s.name,
                                maintenanceMode ? managementOffice : undefined
                              );
                            const hasProduct =
                              lineNum != null &&
                              hasEposProductAtStationForMaintenance(
                                lineNum,
                                s.name,
                                maintenanceMode ? managementOffice : undefined
                              );
                            const facilities =
                              lineNum != null
                                ? getEposProductFacilities(lineNum, s.name)
                                : [];
                            const planFacilities =
                              lineNum != null && managementOffice
                                ? getMaintenancePlanFacilities(
                                    managementOffice,
                                    lineNum,
                                    s.name
                                  )
                                : lineNum != null && showMaintenanceFacilityLabels
                                  ? getMaintenancePlanFacilitiesForStation(
                                      lineNum,
                                      s.name
                                    )
                                  : [];
                            const facilityLabel = maintenanceMode
                              ? formatEposFacilitiesLabel(planFacilities)
                              : showMaintenanceFacilityLabels && lineNum != null
                                ? formatFacilitiesLabelWithMaintenanceAnnotations(
                                    mergeFacilitiesForStationDisplay(
                                      facilities,
                                      planFacilities
                                    ),
                                    planFacilities
                                  )
                                : formatEposFacilitiesLabel(facilities);
                            const faint =
                              maintenanceMode && managementOffice
                                ? false
                                : !hasProduct;

                            return (
                              <button
                                key={s.name}
                                type="button"
                                role="option"
                                aria-selected={selectedStation === s.name}
                                className={`metro-station-option ${
                                  selectedStation === s.name ? "active" : ""
                                }${faint ? " metro-station-option--no-product" : ""}${
                                  lineColor ? " metro-station-option--lined" : ""
                                }`}
                                style={
                                  lineColor
                                    ? {
                                        borderLeftColor: lineColor,
                                        ...(selectedStation === s.name
                                          ? {
                                              borderColor: lineColor,
                                              boxShadow: `inset 3px 0 0 ${lineColor}`,
                                            }
                                          : {}),
                                      }
                                    : undefined
                                }
                                disabled={disabled}
                                onClick={() => handleStationPick(s.name)}
                              >
                                <span className="font-medium">
                                {typeof selectedLine === "number"
                                  ? formatStationNameWithOffice(
                                      selectedLine,
                                      s.name
                                    )
                                  : s.name}
                              </span>
                                {facilityLabel ? (
                                  <span className="metro-station-facilities">
                                    {facilityLabel}
                                  </span>
                                ) : (
                                  <span className="metro-station-facilities metro-station-facilities--empty">
                                    미설치
                                  </span>
                                )}
                              </button>
                            );
                          })
                        )}
                      </div>
                      {multiStationMode && onSelectedStationsChange ? (
                        <p className="muted mt-2 text-xs">
                          역 목록에서 역사를 누르면 아래「선택한 역사」에
                          추가됩니다.
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {enableDirectInput && (
        <div className="mt-3">
          {!useDirectInput ? (
            <button
              type="button"
              className="text-xs text-blue-700 underline"
              disabled={disabled}
              onClick={() => setUseDirectInput(true)}
            >
              호선 목록에 없는 역은 직접 입력
            </button>
          ) : (
            <div className="rounded-lg border border-amber-200 bg-amber-50/80 p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-amber-900">
                  직접 입력
                </span>
                <button
                  type="button"
                  className="text-xs text-blue-700 underline"
                  disabled={disabled}
                  onClick={() => {
                    setUseDirectInput(false);
                    setDirectValue("");
                  }}
                >
                  호선 선택으로 돌아가기
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                <input
                  type="text"
                  className="input flex-1"
                  placeholder="예: 2호선 강남역 또는 길음역"
                  value={directValue}
                  disabled={disabled}
                  onChange={(e) => {
                    setDirectValue(e.target.value);
                    setStationValue(e.target.value);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void commitDirect();
                    }
                  }}
                />
                <button
                  type="button"
                  className="btn btn-secondary shrink-0"
                  disabled={disabled || !directValue.trim()}
                  onClick={() => void commitDirect()}
                >
                  등록
                </button>
              </div>
            </div>
          )}
        </div>
      )}
        </>
      ) : null}

      {effectiveMaintenanceMode &&
      onMaintenanceSelectionsChange &&
      !hideMaintenanceVisitList ? (
        <div className="mt-4">
          <label className="label text-sm font-medium text-amber-950">
            방문 대상 (역·기능실){" "}
            {maintenanceSelections.length > 0 || managementOffice ? (
              <span className="font-normal text-slate-600">
                (
                {formatMaintenanceVisitSummary(
                  maintenanceSelections,
                  Boolean(managementOffice)
                ) || "0역 · 0기능실"}
                )
              </span>
            ) : null}
          </label>
          <MaintenanceVisitList
            managementOffice={managementOffice}
            selections={maintenanceSelections}
            onChange={(next) => {
              onMaintenanceSelectionsChange(next);
              onSelectedStationsChange?.(uniqueStationsFromTargets(next));
              if (next.length && !value.trim()) onChange(next[0]!.station);
            }}
            disabled={disabled}
          />
        </div>
      ) : null}

      {(multiStationMode || maintenanceMode || officeWorkMode) &&
      onSelectedStationsChange &&
      !maintenanceMode ? (
        <div className="mt-4">
          <label className="label text-sm font-medium text-indigo-950">
            {"선택한 역사"}{" "}
            {selectedStations.length > 0 ? (
              <span className="font-normal text-slate-600">
                ({selectedStations.length}역)
              </span>
            ) : null}
          </label>
          {maintenanceMode && selectedStations.length > 0 ? (
            <p className="muted mb-2 text-xs">
              오늘 돌지 않은 역은「해제」로 목록에서 빼 주세요.
            </p>
          ) : null}
          {officeWorkMode && selectedStations.length > 0 ? (
            <p className="muted mb-2 text-xs">
              작업한 역만 체크(✓)하세요. 모두 비우면 AI 자동화 기록으로
              전환됩니다.
            </p>
          ) : null}
          {selectedStations.length === 0 ? (
            <p className="muted mt-2 rounded-lg border border-dashed border-indigo-200 bg-indigo-50/50 px-3 py-4 text-center text-xs">
              {maintenanceMode
                ? "전기관리소를 선택하면 소속 역사가 여기에 표시됩니다."
                : officeWorkMode
                  ? "호선을 고른 뒤 역사명을 누르면 여기에 추가됩니다."
                  : "호선을 고른 뒤 역사명을 누르면 여기에 순서대로 표시됩니다."}
              {perStationFacilityPick ? (
                <>
                  <br />
                  역이 2개 이상이면 각 역마다 작업 장소를 따로 선택합니다.
                </>
              ) : null}
            </p>
          ) : (
            <ol className="mt-2 max-h-52 list-none space-y-1.5 overflow-y-auto p-0">
              {selectedStations.map((name, index) => {
                const { line } = parseMetroStationValue(name);
                const lineColor =
                  line != null ? getMetroLineColor(line) : undefined;
                const stationFacility = stationFacilityByStation[name] ?? "";
                const officeVisited =
                  officeWorkMode &&
                  officeVisitedStations
                    .map((s) => s.trim())
                    .includes(name.trim());
                function toggleOfficeVisited() {
                  if (!onOfficeVisitedStationsChange) return;
                  const trimmed = name.trim();
                  if (officeVisited) {
                    onOfficeVisitedStationsChange(
                      officeVisitedStations.filter((s) => s.trim() !== trimmed)
                    );
                  } else {
                    onOfficeVisitedStationsChange([
                      ...officeVisitedStations,
                      name,
                    ]);
                  }
                }
                return (
                  <li
                    key={`${index}-${name}`}
                    className={`rounded-lg border px-2.5 py-2 shadow-sm ${
                      officeWorkMode && officeVisited
                        ? "border-sky-300 bg-sky-50/80"
                        : "border-indigo-100 bg-white"
                    }`}
                    style={selectedStationRowStyle(name)}
                  >
                    <div className="flex items-center gap-2">
                      {officeWorkMode && onOfficeVisitedStationsChange ? (
                        <label className="flex shrink-0 cursor-pointer items-center">
                          <input
                            type="checkbox"
                            className="sr-only"
                            checked={officeVisited}
                            disabled={disabled}
                            onChange={toggleOfficeVisited}
                          />
                          <span
                            className={`flex h-6 w-6 items-center justify-center rounded-full border text-xs font-bold ${
                              officeVisited
                                ? "border-sky-600 bg-sky-600 text-white"
                                : "border-slate-300 bg-white text-slate-400"
                            }`}
                            title={officeVisited ? "작업함" : "미작업"}
                          >
                            {officeVisited ? "✓" : ""}
                          </span>
                        </label>
                      ) : (
                        <span
                          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                          style={
                            lineColor
                              ? { backgroundColor: lineColor }
                              : { backgroundColor: "#6366f1" }
                          }
                        >
                          {index + 1}
                        </span>
                      )}
                      <span
                        className={`min-w-0 flex-1 text-sm font-medium ${
                          officeWorkMode && !officeVisited
                            ? "text-slate-500"
                            : "text-slate-900"
                        }`}
                      >
                        {name}
                      </span>
                      {maintenanceMode ? (
                        <button
                          type="button"
                          className="shrink-0 rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-900 hover:bg-amber-100"
                          disabled={disabled}
                          onClick={() => removeFromMultiList(name)}
                        >
                          해제
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="shrink-0 text-sm text-slate-400 hover:text-red-600"
                          disabled={disabled}
                          aria-label={`${name} 제거`}
                          onClick={() => removeFromMultiList(name)}
                        >
                          ×
                        </button>
                      )}
                    </div>
                    {perStationFacilityPick ? (
                      <div className="mt-2 border-t border-indigo-50 pt-2">
                        <StationFacilityPicker
                          value={stationFacility}
                          onChange={(area) => setFacilityForStation(name, area)}
                          disabled={disabled}
                          accentColor={lineColor}
                          availableFacilities={facilitiesForStation(name)}
                        />
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      ) : null}

      {value.trim() &&
      onFacilityChange &&
      !maintenanceMode &&
      !officeWorkMode &&
      !perStationFacilityPick ? (
        <div className="mt-4">
          <StationFacilityPicker
            value={facilityArea}
            onChange={onFacilityChange}
            disabled={disabled}
            accentColor={valueLineColor || lineColor || undefined}
            availableFacilities={
              productFacilitiesForValue.length
                ? productFacilitiesForValue
                : productFacilitiesForSelection.length
                  ? productFacilitiesForSelection
                  : undefined
            }
          />
        </div>
      ) : null}

      {value.trim() ? (
        <p
          className={`muted mt-3 text-xs metro-selection-summary${
            valueLineColor ? " metro-selection-summary--lined" : ""
          }`}
          style={
            valueLineColor
              ? { borderColor: valueLineColor, ["--metro-line-color" as string]: valueLineColor }
              : undefined
          }
        >
          선택됨:{" "}
          <strong>
            {formatStationVisitLabel(
              value,
              facilityArea,
              managementOffice
            ) || value}
          </strong>
          {requireFacility && !facilityArea ? (
            <span className="text-red-600"> · 작업 장소를 선택해 주세요</span>
          ) : null}
        </p>
      ) : null}
    </div>
  );
}
