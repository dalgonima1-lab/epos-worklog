"use client";

import {
  STATION_FACILITY_AREAS,
  type StationFacilityArea,
} from "@/lib/stationFacility";

interface StationFacilityPickerProps {
  value: string;
  onChange: (area: StationFacilityArea | "") => void;
  disabled?: boolean;
  /** 호선색 테두리 (선택) */
  accentColor?: string;
}

export function StationFacilityPicker({
  value,
  onChange,
  disabled,
  accentColor,
}: StationFacilityPickerProps) {
  return (
    <div className="station-facility-picker">
      <p className="label text-sm">
        작업 장소 <span className="text-red-600">*</span>
      </p>
      <p className="muted mb-2 text-xs">
        같은 역사라도 전기실·변전소·역무실 중 어디에서 작업했는지 선택하세요.
      </p>
      <div className="station-facility-buttons" role="group" aria-label="작업 장소">
        {STATION_FACILITY_AREAS.map((area) => {
          const active = value === area;
          return (
            <button
              key={area}
              type="button"
              className={`station-facility-btn${active ? " active" : ""}${
                accentColor ? " station-facility-btn--lined" : ""
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
              aria-pressed={active}
              onClick={() => onChange(active ? "" : area)}
            >
              {area}
            </button>
          );
        })}
      </div>
    </div>
  );
}
