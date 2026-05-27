"use client";

import {
  STATION_FACILITY_AREAS,
  type StationFacilityArea,
} from "@/lib/stationFacility";

interface StationFacilityPickerProps {
  value?: string;
  onChange?: (area: StationFacilityArea | "") => void;
  /** true면 전기실·변전소 등 여러 작업 장소 동시 선택 */
  multiple?: boolean;
  values?: StationFacilityArea[];
  onValuesChange?: (areas: StationFacilityArea[]) => void;
  disabled?: boolean;
  /** 호선색 테두리 (선택) */
  accentColor?: string;
  /** EPOS 설치 기능실만 선택 가능 (없으면 3종 모두) */
  availableFacilities?: StationFacilityArea[];
  /** 역 목록 안 등 — 라벨·안내 문구 생략 */
  compact?: boolean;
}

export function StationFacilityPicker({
  value = "",
  onChange,
  multiple = false,
  values = [],
  onValuesChange,
  disabled,
  accentColor,
  availableFacilities,
  compact = false,
}: StationFacilityPickerProps) {
  const options =
    availableFacilities?.length ? availableFacilities : [...STATION_FACILITY_AREAS];

  const selectedSet = multiple
    ? new Set(values)
    : value
      ? new Set([value])
      : new Set<string>();

  function toggle(area: StationFacilityArea) {
    if (multiple) {
      const active = selectedSet.has(area);
      const next = active
        ? values.filter((v) => v !== area)
        : [...values, area];
      onValuesChange?.(next);
      onChange?.(next[0] ?? "");
      return;
    }
    const active = value === area;
    onChange?.(active ? "" : area);
  }

  return (
    <div className="station-facility-picker">
      {!compact ? (
        <>
          <p className="label text-sm">
            작업 장소 <span className="text-red-600">*</span>
          </p>
          <p className="muted mb-2 text-xs">
            {multiple
              ? "전기실·변전소 등 작업한 곳을 모두 선택하세요."
              : availableFacilities?.length
                ? `EPOS 설치 구역: ${options.join(" · ")}`
                : "전기실·변전소·역무실 중 작업한 곳을 선택하세요."}
          </p>
        </>
      ) : null}
      <div className="station-facility-buttons" role="group" aria-label="작업 장소">
        {options.map((area) => {
          const active = selectedSet.has(area);
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
              onClick={() => toggle(area)}
            >
              {area}
            </button>
          );
        })}
      </div>
    </div>
  );
}
