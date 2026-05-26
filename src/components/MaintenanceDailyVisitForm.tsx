"use client";

import { useMemo } from "react";
import { getMaintenancePlanFacilities } from "@/lib/maintenancePlan";
import { getMetroLineColor, parseMetroStationValue } from "@/lib/metroStations";
import {
  formatMaintenanceVisitSummary,
  isStationVisited,
  maintenanceTargetKey,
  mergeUniqueTargets,
  removeStationFromTargets,
  targetsForStation,
  uniqueStationsFromTargets,
  type MaintenanceVisitTarget,
} from "@/lib/maintenanceVisit";
import type { StationFacilityArea } from "@/lib/stationFacility";

interface MaintenanceDailyVisitFormProps {
  managementOffice: string;
  plannedTargets: MaintenanceVisitTarget[];
  visitedTargets: MaintenanceVisitTarget[];
  onVisitedChange: (next: MaintenanceVisitTarget[]) => void;
  deficienciesByStation: Record<string, string>;
  onDeficienciesChange: (next: Record<string, string>) => void;
  disabled?: boolean;
}

export function MaintenanceDailyVisitForm({
  managementOffice,
  plannedTargets,
  visitedTargets,
  onVisitedChange,
  deficienciesByStation,
  onDeficienciesChange,
  disabled,
}: MaintenanceDailyVisitFormProps) {
  const plannedStations = useMemo(
    () => uniqueStationsFromTargets(plannedTargets),
    [plannedTargets]
  );

  const visitedStations = useMemo(
    () =>
      plannedStations.filter((st) => isStationVisited(st, visitedTargets)),
    [plannedStations, visitedTargets]
  );

  const notVisitedStations = useMemo(
    () =>
      plannedStations.filter((st) => !isStationVisited(st, visitedTargets)),
    [plannedStations, visitedTargets]
  );

  const selectedKeys = new Set(
    visitedTargets.map((t) => maintenanceTargetKey(t.station, t.facility))
  );

  function toggleFacility(station: string, facility: StationFacilityArea) {
    const k = maintenanceTargetKey(station, facility);
    if (selectedKeys.has(k)) {
      onVisitedChange(
        visitedTargets.filter(
          (t) => maintenanceTargetKey(t.station, t.facility) !== k
        )
      );
    } else {
      const fromPlan = plannedTargets.some(
        (t) => t.station === station && t.facility === facility
      );
      onVisitedChange([
        ...visitedTargets,
        { station, facility, fromPlan: fromPlan || true },
      ]);
    }
  }

  function markStationNotVisited(station: string) {
    onVisitedChange(removeStationFromTargets(station, visitedTargets));
    const next = { ...deficienciesByStation };
    delete next[station];
    onDeficienciesChange(next);
  }

  function markStationVisited(station: string) {
    const add = targetsForStation(station, plannedTargets);
    onVisitedChange(mergeUniqueTargets(visitedTargets, add));
  }

  if (!managementOffice) {
    return (
      <p className="muted rounded-lg border border-dashed border-amber-200 bg-amber-50/50 px-3 py-4 text-center text-xs">
        전기관리소 정보가 없습니다. 일정에서 다시 들어와 주세요.
      </p>
    );
  }

  const visitSummary = formatMaintenanceVisitSummary(
    visitedTargets,
    true
  );

  return (
    <div className="maintenance-daily-visit space-y-4">
      {visitSummary ? (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs font-semibold text-amber-950">
          실제 방문: {visitSummary}
        </p>
      ) : null}
      <p className="muted text-xs">
        <span className="font-semibold text-emerald-800">방문한 역</span> ·{" "}
        <span className="font-semibold text-slate-500">미방문 역</span> ·
        미방문 기능실은 <strong className="text-red-600">×</strong> 해제
      </p>

      {visitedStations.length > 0 ? (
        <section>
          <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-emerald-800">
            방문한 역 ({visitedStations.length})
          </h3>
          <ol className="list-none space-y-3 p-0">
            {visitedStations.map((station) => (
              <StationVisitCard
                key={`visited-${station}`}
                station={station}
                managementOffice={managementOffice}
                plannedTargets={plannedTargets}
                visitedTargets={visitedTargets}
                visited
                deficiencies={deficienciesByStation[station] ?? ""}
                onDeficienciesChange={(text) =>
                  onDeficienciesChange({
                    ...deficienciesByStation,
                    [station]: text,
                  })
                }
                onToggleFacility={toggleFacility}
                onMarkStationNotVisited={() => markStationNotVisited(station)}
                disabled={disabled}
              />
            ))}
          </ol>
        </section>
      ) : null}

      {notVisitedStations.length > 0 ? (
        <section>
          <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">
            미방문 역 ({notVisitedStations.length})
          </h3>
          <ol className="list-none space-y-2 p-0">
            {notVisitedStations.map((station) => {
              const { line } = parseMetroStationValue(station);
              const lineColor =
                line != null ? getMetroLineColor(line) : undefined;
              return (
                <li
                  key={`skipped-${station}`}
                  className="flex items-center justify-between gap-2 rounded-lg border border-dashed border-slate-200 bg-slate-50 px-2.5 py-2"
                  style={
                    lineColor
                      ? { borderLeftWidth: 4, borderLeftColor: lineColor }
                      : undefined
                  }
                >
                  <span className="text-sm font-medium text-slate-500">
                    {station}
                  </span>
                  <button
                    type="button"
                    className="shrink-0 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700"
                    disabled={disabled}
                    onClick={() => markStationVisited(station)}
                  >
                    방문함
                  </button>
                </li>
              );
            })}
          </ol>
        </section>
      ) : null}

      {plannedStations.length === 0 ? (
        <p className="muted rounded-lg border border-dashed border-amber-200 px-3 py-4 text-center text-xs">
          점검 대상 역이 없습니다.
        </p>
      ) : null}
    </div>
  );
}

function StationVisitCard({
  station,
  managementOffice,
  plannedTargets,
  visitedTargets,
  visited,
  deficiencies,
  onDeficienciesChange,
  onToggleFacility,
  onMarkStationNotVisited,
  disabled,
}: {
  station: string;
  managementOffice: string;
  plannedTargets: MaintenanceVisitTarget[];
  visitedTargets: MaintenanceVisitTarget[];
  visited: boolean;
  deficiencies: string;
  onDeficienciesChange: (text: string) => void;
  onToggleFacility: (station: string, facility: StationFacilityArea) => void;
  onMarkStationNotVisited: () => void;
  disabled?: boolean;
}) {
  const { line, stationName } = parseMetroStationValue(station);
  const lineColor = line != null ? getMetroLineColor(line) : undefined;
  const planFacilities =
    line != null && stationName
      ? getMaintenancePlanFacilities(managementOffice, line, stationName)
      : targetsForStation(station, plannedTargets).map((t) => t.facility);

  const selectedKeys = new Set(
    visitedTargets.map((t) => maintenanceTargetKey(t.station, t.facility))
  );

  return (
    <li
      className={`rounded-lg border px-2.5 py-2 shadow-sm ${
        visited
          ? "border-emerald-200 bg-white"
          : "border-dashed border-slate-200 bg-slate-50"
      }`}
      style={
        lineColor
          ? { borderLeftWidth: 4, borderLeftColor: lineColor }
          : undefined
      }
    >
      <div className="flex items-start justify-between gap-2">
        <p
          className={`text-sm font-semibold ${
            visited ? "text-emerald-950" : "text-slate-500"
          }`}
        >
          {station}
        </p>
        {visited ? (
          <button
            type="button"
            className="shrink-0 text-xs font-medium text-slate-500 underline"
            disabled={disabled}
            onClick={onMarkStationNotVisited}
          >
            미방문
          </button>
        ) : null}
      </div>
      {visited ? (
        <>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {planFacilities.map((facility) => {
              const active = selectedKeys.has(
                maintenanceTargetKey(station, facility)
              );
              return (
                <button
                  key={facility}
                  type="button"
                  disabled={disabled}
                  className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium ${
                    active
                      ? "border-amber-500 bg-amber-500 text-white"
                      : "border-amber-200 bg-amber-50 text-amber-900"
                  }`}
                  onClick={() => onToggleFacility(station, facility)}
                >
                  {facility}
                  {active ? (
                    <span className="text-amber-100" aria-hidden>
                      ×
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
          <label className="mt-3 block">
            <span className="text-xs font-medium text-slate-700">
              미비사항 (이 역)
            </span>
            <textarea
              className="textarea mt-1 min-h-[56px] text-sm"
              placeholder="이 역에서 발견한 미비·보완 사항"
              value={deficiencies}
              disabled={disabled}
              onChange={(e) => onDeficienciesChange(e.target.value)}
            />
          </label>
        </>
      ) : null}
    </li>
  );
}
