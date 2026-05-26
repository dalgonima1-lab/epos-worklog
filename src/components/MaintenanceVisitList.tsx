"use client";

import { useMemo } from "react";
import {
  getFacilitySheetOnlyFacilities,
  getEposProductFacilities,
} from "@/lib/eposProductStations";
import { getStationDisplayNamesForOffice } from "@/lib/eposStationOffices";
import {
  getMaintenancePlanFacilities,
  isStationInMaintenancePlan,
} from "@/lib/maintenancePlan";
import {
  formatMetroStationValue,
  getMetroLineColor,
  parseMetroStationValue,
} from "@/lib/metroStations";
import {
  formatMaintenanceVisitSummary,
  maintenanceTargetKey,
  type MaintenanceVisitTarget,
} from "@/lib/maintenanceVisit";
import {
  STATION_FACILITY_AREAS,
  type StationFacilityArea,
} from "@/lib/stationFacility";

interface MaintenanceVisitListProps {
  managementOffice: string;
  selections: MaintenanceVisitTarget[];
  onChange: (next: MaintenanceVisitTarget[]) => void;
  disabled?: boolean;
}

export function MaintenanceVisitList({
  managementOffice,
  selections,
  onChange,
  disabled,
}: MaintenanceVisitListProps) {
  const selectedKeys = new Set(
    selections.map((t) => maintenanceTargetKey(t.station, t.facility))
  );

  const stationDisplays = useMemo(() => {
    const set = new Set<string>();
    for (const d of getStationDisplayNamesForOffice(managementOffice)) {
      set.add(d);
    }
    for (const t of selections) {
      if (t.station.trim()) set.add(t.station.trim());
    }
    return [...set].sort((a, b) => a.localeCompare(b, "ko"));
  }, [managementOffice, selections]);

  function toggle(
    station: string,
    facility: StationFacilityArea,
    fromPlan: boolean
  ) {
    const k = maintenanceTargetKey(station, facility);
    if (selectedKeys.has(k)) {
      onChange(
        selections.filter(
          (t) => maintenanceTargetKey(t.station, t.facility) !== k
        )
      );
    } else {
      onChange([...selections, { station, facility, fromPlan }]);
    }
  }

  if (!managementOffice) {
    return (
      <p className="muted rounded-lg border border-dashed border-amber-200 bg-amber-50/50 px-3 py-4 text-center text-xs">
        전기관리소를 선택하면 정기점검계획 점검 대상이 표시됩니다.
      </p>
    );
  }

  const visitSummary = formatMaintenanceVisitSummary(
    selections,
    Boolean(managementOffice)
  );

  return (
    <div className="maintenance-visit-list">
      {visitSummary ? (
        <p className="mb-2 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs font-semibold text-amber-950">
          방문 대상: {visitSummary}
        </p>
      ) : null}
      <p className="muted mb-2 text-xs">
        <strong className="text-slate-800">정기점검계획</strong> = 선명 ·{" "}
        <span className="text-slate-400">기능실 현황(서브)</span> = 흐림 ·
        미방문 기능실은 <strong className="text-red-600">×</strong> 해제 ·
        관리소는 기능실 1건으로 집계
      </p>
      {stationDisplays.length === 0 ? (
        <p className="muted rounded-lg border border-dashed border-amber-200 px-3 py-4 text-center text-xs">
          이 관리소의 정기점검 대상이 없습니다.
        </p>
      ) : (
        <ol className="max-h-64 list-none space-y-2 overflow-y-auto p-0">
          {stationDisplays.map((station) => {
            const { line, stationName } = parseMetroStationValue(station);
            const lineColor =
              line != null ? getMetroLineColor(line) : undefined;
            const inPlan =
              line != null &&
              stationName &&
              isStationInMaintenancePlan(managementOffice, line, stationName);
            const hasSelectedFacility = selections.some(
              (t) =>
                t.station === station &&
                selectedKeys.has(maintenanceTargetKey(t.station, t.facility))
            );
            const planFacilities =
              line != null && stationName
                ? getMaintenancePlanFacilities(
                    managementOffice,
                    line,
                    stationName
                  )
                : [];
            const sheetOnly =
              line != null && stationName
                ? getFacilitySheetOnlyFacilities(
                    line,
                    stationName,
                    managementOffice
                  )
                : [];
            const allFacilities = [
              ...new Set([
                ...planFacilities,
                ...sheetOnly,
                ...(line != null && stationName
                  ? getEposProductFacilities(line, stationName)
                  : []),
              ]),
            ].filter((f): f is StationFacilityArea =>
              (STATION_FACILITY_AREAS as readonly string[]).includes(f)
            );

            return (
              <li
                key={station}
                className="rounded-lg border border-amber-100 bg-white px-2.5 py-2 shadow-sm"
                style={
                  lineColor
                    ? { borderLeftWidth: 4, borderLeftColor: lineColor }
                    : undefined
                }
              >
                <p
                  className={`text-sm font-semibold ${
                    inPlan || hasSelectedFacility
                      ? "text-slate-900"
                      : "text-slate-400"
                  }`}
                >
                  {station}
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {allFacilities.map((facility) => {
                    const fromPlan = planFacilities.includes(facility);
                    const active = selectedKeys.has(
                      maintenanceTargetKey(station, facility)
                    );
                    const subOnly = !fromPlan;
                    return (
                      <button
                        key={facility}
                        type="button"
                        disabled={disabled}
                        className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium ${
                          active
                            ? subOnly
                              ? "border-slate-300 bg-slate-100 text-slate-700"
                              : "border-amber-500 bg-amber-500 text-white"
                            : subOnly
                              ? "border-slate-200 bg-white text-slate-400"
                              : "border-amber-200 bg-amber-50 text-amber-900"
                        }`}
                        onClick={() => toggle(station, facility, fromPlan)}
                      >
                        {facility}
                        {active ? (
                          <span
                            className={
                              subOnly ? "text-slate-500" : "text-amber-100"
                            }
                            aria-hidden
                          >
                            ×
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
