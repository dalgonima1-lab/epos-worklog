"use client";

import { useMemo } from "react";
import { OFFICE_WORK_ROLES, officeWorkEntryKey } from "@/lib/officeWork";
import { getMetroLineColor, parseMetroStationValue } from "@/lib/metroStations";

interface OfficeWorkDailyFormProps {
  stations: string[];
  selectedRoles: string[];
  onSelectedRolesChange: (roles: string[]) => void;
  workByKey: Record<string, string>;
  onWorkByKeyChange: (next: Record<string, string>) => void;
  disabled?: boolean;
}

export function OfficeWorkDailyForm({
  stations,
  selectedRoles,
  onSelectedRolesChange,
  workByKey,
  onWorkByKeyChange,
  disabled,
}: OfficeWorkDailyFormProps) {
  const rows = useMemo(() => {
    const list: { station: string; role: string; key: string }[] = [];
    for (const station of stations) {
      for (const role of selectedRoles) {
        list.push({
          station,
          role,
          key: officeWorkEntryKey(station, role),
        });
      }
    }
    return list;
  }, [stations, selectedRoles]);

  function toggleRole(role: string) {
    onSelectedRolesChange(
      selectedRoles.includes(role)
        ? selectedRoles.filter((r) => r !== role)
        : [...selectedRoles, role]
    );
  }

  const filledCount = rows.filter((r) => workByKey[r.key]?.trim()).length;

  return (
    <div className="office-work-daily space-y-4">
      <div>
        <p className="label text-sm font-medium text-slate-800">공종 (복수 선택)</p>
        <p className="muted mb-2 text-xs">
          선택한 역사마다 아래에 공종별 작업 내용을 적습니다.
        </p>
        <div className="flex flex-wrap gap-2">
          {OFFICE_WORK_ROLES.map((role) => {
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
      </div>

      {stations.length === 0 ? (
        <p className="muted rounded-lg border border-dashed border-sky-200 px-3 py-4 text-center text-xs">
          위에서 역사를 1곳 이상 선택해 주세요.
        </p>
      ) : selectedRoles.length === 0 ? (
        <p className="muted rounded-lg border border-dashed border-sky-200 px-3 py-4 text-center text-xs">
          공종을 1개 이상 선택해 주세요.
        </p>
      ) : (
        <>
          <p className="text-xs font-semibold text-sky-900">
            역·공종별 작업 ({filledCount}/{rows.length}건 입력)
          </p>
          <ol className="max-h-80 list-none space-y-3 overflow-y-auto p-0">
            {rows.map(({ station, role, key }) => {
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
                      onWorkByKeyChange({ ...workByKey, [key]: e.target.value })
                    }
                  />
                </li>
              );
            })}
          </ol>
        </>
      )}
    </div>
  );
}
