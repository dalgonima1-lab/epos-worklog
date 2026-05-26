"use client";

import { getManagementOffices } from "@/lib/eposStationOffices";

interface ManagementOfficePickerProps {
  value: string;
  onChange: (officeId: string) => void;
  disabled?: boolean;
  accentColor?: string;
}

export function ManagementOfficePicker({
  value,
  onChange,
  disabled,
  accentColor,
}: ManagementOfficePickerProps) {
  const offices = getManagementOffices();

  return (
    <div className="management-office-picker">
      <p className="label text-sm">
        전기관리소 (작업 장소) <span className="text-red-600">*</span>
      </p>
      <p className="muted mb-2 text-xs">
        유지보수 용역 시 관리소 단위로 방문합니다. 담당 관리소를 선택하세요.
      </p>
      <div
        className="management-office-grid"
        role="listbox"
        aria-label="전기관리소 선택"
      >
        {offices.map((office) => {
          const active = value === office.id || value === office.shortLabel;
          return (
            <button
              key={office.id}
              type="button"
              role="option"
              aria-selected={active}
              className={`management-office-btn${active ? " active" : ""}${
                accentColor ? " management-office-btn--lined" : ""
              }`}
              style={
                accentColor
                  ? active
                    ? {
                        borderColor: accentColor,
                        backgroundColor: accentColor,
                        color: "#fff",
                      }
                    : { borderColor: accentColor, color: accentColor }
                  : undefined
              }
              disabled={disabled}
              onClick={() =>
                onChange(active ? "" : office.id)
              }
            >
              <span className="font-semibold">{office.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
