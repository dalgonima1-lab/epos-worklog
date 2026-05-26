"use client";

import { useEffect, useMemo } from "react";
import {
  OFFICE_AI_AUTOMATION_ROLE,
  OFFICE_GENERAL_STATION,
  OFFICE_STATION_ROLES,
  officeWorkEntryKey,
} from "@/lib/officeWork";
import { getMetroLineColor, parseMetroStationValue } from "@/lib/metroStations";

type OfficeRoleTab = "station" | "ai";

interface OfficeWorkDailyFormProps {
  stations: string[];
  /** StationPicker에서 체크한 역 (작업한 역) */
  visitedStations: string[];
  selectedRoles: string[];
  onSelectedRolesChange: (roles: string[]) => void;
  workByKey: Record<string, string>;
  onWorkByKeyChange: (next: Record<string, string>) => void;
  disabled?: boolean;
}

export function OfficeWorkDailyForm({
  stations,
  visitedStations,
  selectedRoles,
  onSelectedRolesChange,
  workByKey,
  onWorkByKeyChange,
  disabled,
}: OfficeWorkDailyFormProps) {
  const visitedSet = useMemo(
    () => new Set(visitedStations.map((s) => s.trim()).filter(Boolean)),
    [visitedStations]
  );
  const hasStationWork = visitedSet.size > 0;
  const aiKey = officeWorkEntryKey(
    OFFICE_GENERAL_STATION,
    OFFICE_AI_AUTOMATION_ROLE
  );

  const activeTab: OfficeRoleTab = hasStationWork ? "station" : "ai";

  const stationRows = useMemo(() => {
    const list: { station: string; role: string; key: string }[] = [];
    for (const station of visitedStations) {
      for (const role of selectedRoles) {
        if (role === OFFICE_AI_AUTOMATION_ROLE) continue;
        list.push({
          station,
          role,
          key: officeWorkEntryKey(station, role),
        });
      }
    }
    return list;
  }, [visitedStations, selectedRoles]);

  useEffect(() => {
    if (hasStationWork) {
      onSelectedRolesChange(
        selectedRoles.filter((r) => r !== OFFICE_AI_AUTOMATION_ROLE)
      );
    } else {
      onSelectedRolesChange(
        selectedRoles.includes(OFFICE_AI_AUTOMATION_ROLE)
          ? [OFFICE_AI_AUTOMATION_ROLE]
          : [OFFICE_AI_AUTOMATION_ROLE]
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 역 작업 유무에 따라 공종 모드 전환
  }, [hasStationWork]);

  function toggleRole(role: string) {
    if (activeTab === "ai") return;
    onSelectedRolesChange(
      selectedRoles.includes(role)
        ? selectedRoles.filter((r) => r !== role)
        : [...selectedRoles, role]
    );
  }

  const filledStationCount = stationRows.filter((r) =>
    workByKey[r.key]?.trim()
  ).length;
  const aiFilled = Boolean(workByKey[aiKey]?.trim());

  return (
    <div className="office-work-daily space-y-4">
      <p className="muted text-xs">
        {stations.length > 0 ? (
          <>
            위 「선택한 역사」 목록에서 <strong>작업한 역만 체크(✓)</strong>
            하세요. 체크가 하나도 없으면 아래{" "}
            <strong>AI를 통한 자동화</strong> 탭이 열립니다.
          </>
        ) : (
          <>
            역을 추가하지 않았거나 모두 작업하지 않았다면{" "}
            <strong>AI를 통한 자동화</strong>로 기록하세요.
          </>
        )}
      </p>

      <div>
        <p className="label text-sm font-medium text-slate-800">공종</p>
        <div className="mt-2 flex flex-wrap gap-2 border-b border-sky-100 pb-2">
          <span
            className={`rounded-t-md px-2 py-1 text-xs font-semibold ${
              activeTab === "station"
                ? "bg-sky-600 text-white"
                : hasStationWork
                  ? "bg-sky-100 text-sky-800"
                  : "bg-slate-100 text-slate-400"
            }`}
          >
            역사별 공종
          </span>
          <span
            className={`rounded-t-md px-2 py-1 text-xs font-semibold ${
              activeTab === "ai"
                ? "bg-violet-600 text-white"
                : !hasStationWork
                  ? "bg-violet-100 text-violet-900"
                  : "bg-slate-100 text-slate-400"
            }`}
          >
            AI를 통한 자동화
          </span>
        </div>

        {activeTab === "station" ? (
          <>
            <p className="muted mb-2 text-xs">
              체크한 역사마다 공종별 작업 내용을 적습니다.
            </p>
            <div className="flex flex-wrap gap-2">
              {OFFICE_STATION_ROLES.map((role) => {
                const active = selectedRoles.includes(role);
                return (
                  <button
                    key={role}
                    type="button"
                    disabled={disabled}
                    className={`rounded-md border px-2.5 py-1.5 text-xs font-medium ${
                      active
                        ? "border-sky-600 bg-sky-600 text-white"
                        : "border-slate-200 bg-white text-slate-700"
                    }`}
                    onClick={() => toggleRole(role)}
                  >
                    {role}
                  </button>
                );
              })}
            </div>
          </>
        ) : (
          <p className="muted mb-2 text-xs">
            오늘은 역사 방문 작업이 없습니다. AI·자동화로 수행한 사무 업무를
            적어 주세요.
          </p>
        )}
      </div>

      {activeTab === "station" ? (
        visitedStations.length === 0 ? (
          <p className="muted rounded-lg border border-dashed border-sky-200 px-3 py-4 text-center text-xs">
            작업한 역사를 체크하거나, 역 작업이 없으면 체크를 모두 해제한 뒤
            「AI를 통한 자동화」 탭을 이용하세요.
          </p>
        ) : selectedRoles.filter((r) => r !== OFFICE_AI_AUTOMATION_ROLE)
            .length === 0 ? (
          <p className="muted rounded-lg border border-dashed border-sky-200 px-3 py-4 text-center text-xs">
            공종을 1개 이상 선택해 주세요.
          </p>
        ) : (
          <>
            <p className="text-xs font-semibold text-sky-900">
              역·공종별 작업 ({filledStationCount}/{stationRows.length}건 입력)
            </p>
            <ol className="max-h-80 list-none space-y-3 overflow-y-auto p-0">
              {stationRows.map(({ station, role, key }) => {
                const { line } = parseMetroStationValue(station);
                const lineColor =
                  line != null ? getMetroLineColor(line) : undefined;
                return (
                  <li
                    key={key}
                    className="rounded-lg border border-sky-100 bg-white px-2.5 py-2 shadow-sm"
                    style={
                      lineColor
                        ? { borderLeftWidth: 4, borderLeftColor: lineColor }
                        : undefined
                    }
                  >
                    <p className="text-sm font-semibold text-slate-900">
                      {station}
                      <span className="ml-2 text-xs font-medium text-sky-700">
                        {role}
                      </span>
                    </p>
                    <textarea
                      className="textarea mt-2 min-h-[56px] text-sm"
                      placeholder={`${role} 관련 수행 업무`}
                      value={workByKey[key] ?? ""}
                      disabled={disabled}
                      onChange={(e) =>
                        onWorkByKeyChange({
                          ...workByKey,
                          [key]: e.target.value,
                        })
                      }
                    />
                  </li>
                );
              })}
            </ol>
          </>
        )
      ) : (
        <div className="rounded-lg border border-violet-200 bg-violet-50/60 px-2.5 py-2">
          <p className="text-sm font-semibold text-violet-950">
            {OFFICE_AI_AUTOMATION_ROLE}
          </p>
          <textarea
            className="textarea mt-2 min-h-[80px] text-sm"
            placeholder="예: 일일기록 자동 정리, 점검표 스크립트, 데이터 검증 자동화…"
            value={workByKey[aiKey] ?? ""}
            disabled={disabled}
            onChange={(e) =>
              onWorkByKeyChange({ ...workByKey, [aiKey]: e.target.value })
            }
          />
          {!aiFilled ? (
            <p className="muted mt-1 text-[11px]">작업 내용을 입력해 주세요.</p>
          ) : null}
        </div>
      )}
    </div>
  );
}
