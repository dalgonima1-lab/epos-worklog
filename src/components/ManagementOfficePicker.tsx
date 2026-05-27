"use client";

import {
  getManagementOffices,
  getOfficeMetroLine,
  resolveManagementOffice,
} from "@/lib/eposStationOffices";
import { getMetroLineColor } from "@/lib/metroStations";

interface ManagementOfficePickerProps {
  value: string;
  onChange: (officeId: string) => void;
  disabled?: boolean;
  /** 일정 연결 일일기록: 선택된 관리소만 표시 (전체 목록 숨김) */
  selectedOnly?: boolean;
}

export function ManagementOfficePicker({
  value,
  onChange,
  disabled,
  selectedOnly = false,
}: ManagementOfficePickerProps) {
  const allOffices = getManagementOffices();
  const resolved = value.trim() ? resolveManagementOffice(value) : null;
  const offices =
    selectedOnly && value.trim()
      ? allOffices.filter(
          (o) =>
            o.id === value ||
            o.shortLabel === value ||
            (resolved != null &&
              (o.id === resolved.id || o.shortLabel === resolved.shortLabel))
        )
      : allOffices;

  const showSingleLocked =
    selectedOnly && value.trim() && (offices.length === 1 || resolved);

  if (showSingleLocked) {
    const office =
      offices[0] ??
      (resolved
        ? {
            id: resolved.id,
            shortLabel: resolved.shortLabel,
            label: resolved.label,
            line: resolved.line,
          }
        : null);
    if (!office) {
      return (
        <div className="management-office-picker">
          <p className="label text-sm">전기관리소 (작업 장소)</p>
          <p className="mt-1 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-950">
            {value}
          </p>
        </div>
      );
    }
    const line = getOfficeMetroLine(office);
    const lineColor = line != null ? getMetroLineColor(line) : "";
    return (
      <div className="management-office-picker">
        <p className="label text-sm">전기관리소 (작업 장소)</p>
        <p className="muted mb-2 text-xs">
          유지보수 일정에 연결된 관리소입니다. 변경할 수 없습니다.
        </p>
        <div
          className="management-office-btn management-office-btn--lined active inline-block max-w-full rounded-lg border-2 px-4 py-2.5 text-left"
          style={
            lineColor
              ? {
                  borderColor: lineColor,
                  backgroundColor: lineColor,
                  color: "#fff",
                }
              : undefined
          }
        >
          <span className="font-semibold">{office.label}</span>
          {line != null ? (
            <span className="mt-0.5 block text-[10px] font-normal opacity-90">
              {line}호선
            </span>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="management-office-picker">
      <p className="label text-sm">
        전기관리소 (작업 장소) <span className="text-red-600">*</span>
      </p>
      <p className="muted mb-2 text-xs">
        유지보수 용역 시 관리소를 선택하면 해당 호선·소속 역사가 자동으로
        선택됩니다. 버튼 색은 담당 호선입니다.
      </p>
      <div
        className="management-office-grid"
        role="listbox"
        aria-label="전기관리소 선택"
      >
        {offices.map((office) => {
          const active = value === office.id || value === office.shortLabel;
          const line = getOfficeMetroLine(office);
          const lineColor = line != null ? getMetroLineColor(line) : "";
          return (
            <button
              key={office.id}
              type="button"
              role="option"
              aria-selected={active}
              className={`management-office-btn management-office-btn--lined${
                active ? " active" : ""
              }`}
              style={
                lineColor
                  ? active
                    ? {
                        borderColor: lineColor,
                        backgroundColor: lineColor,
                        color: "#fff",
                      }
                    : { borderColor: lineColor, color: lineColor }
                  : undefined
              }
              disabled={disabled}
              onClick={() => {
                if (selectedOnly) return;
                onChange(active ? "" : office.id);
              }}
            >
              <span className="font-semibold">{office.label}</span>
              {line != null ? (
                <span
                  className="mt-0.5 block text-[10px] font-normal opacity-90"
                  style={active ? { color: "#fff" } : undefined}
                >
                  {line}호선
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
