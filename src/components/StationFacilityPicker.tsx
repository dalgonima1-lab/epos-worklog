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
  /** EPOS 설치 기능실만 선택 가능 (없으면 3종 모두) */
  availableFacilities?: StationFacilityArea[];
}

export function StationFacilityPicker({
  value,
  onChange,
  disabled,
  accentColor,
  availableFacilities,
}: StationFacilityPickerProps) {
  const options =
    availableFacilities?.length ? availableFacilities : [...STATION_FACILITY_AREAS];

  return (
    <div className="station-facility-picker">
      <p className="label text-sm">
        작업 장소 <span className="text-red-600">*</span>
      </p>
      <p className="muted mb-2 text-xs">
        {availableFacilities?.length
          ? `이 역사 EPOS 설치 구역: ${options.join(" · ")}`
          : "같은 역사라도 전기실·변전소·역무실 중 어디에서 작업했는지 선택하세요."}
      </p>
      <div className="station-facility-buttons" role="group" aria-label="작업 장소">
        {options.map((area) => {
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
