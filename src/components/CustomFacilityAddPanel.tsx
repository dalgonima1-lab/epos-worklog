"use client";

import { useMemo, useState } from "react";
import { StationFacilityPicker } from "@/components/StationFacilityPicker";
import { getMetroLineColor, parseMetroStationValue } from "@/lib/metroStations";
import {
  STATION_FACILITY_AREAS,
  type StationFacilityArea,
} from "@/lib/stationFacility";
import { mergeStationFacilityAreas } from "@/lib/stationFacilities";
import type { StationRecord } from "@/lib/types";

interface CustomFacilityAddPanelProps {
  /** 호선·역사 목록에서 선택한 역 (예: 3호선 연신내역) */
  stationName: string;
  existingFacilities?: StationFacilityArea[];
  disabled?: boolean;
  onRecordsChange?: (records: StationRecord[]) => void;
  onAdded: (
    station: string,
    allFacilities: StationFacilityArea[],
    addedFacilities: StationFacilityArea[]
  ) => void;
}

export function CustomFacilityAddPanel({
  stationName,
  existingFacilities = [],
  disabled,
  onRecordsChange,
  onAdded,
}: CustomFacilityAddPanelProps) {
  const [open, setOpen] = useState(false);
  const [facilities, setFacilities] = useState<StationFacilityArea[]>([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const trimmedStation = stationName.trim();
  const parsed = parseMetroStationValue(trimmedStation);
  const lineColor =
    parsed.line != null ? getMetroLineColor(parsed.line) : undefined;

  const addableFacilities = useMemo(
    () =>
      STATION_FACILITY_AREAS.filter((f) => !existingFacilities.includes(f)),
    [existingFacilities]
  );

  async function handleSubmit() {
    setError("");
    if (!trimmedStation) {
      setError("역사를 먼저 선택해 주세요.");
      return;
    }
    if (facilities.length === 0) {
      setError("추가할 기능실을 1곳 이상 선택해 주세요.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/stations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmedStation,
          facilities,
          custom: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "기능실 등록에 실패했습니다.");
        return;
      }
      const records = (data.records ?? []) as StationRecord[];
      onRecordsChange?.(records);
      const allFacilities = mergeStationFacilityAreas(
        existingFacilities,
        facilities
      );
      onAdded(trimmedStation, allFacilities, facilities);
      setFacilities([]);
      setOpen(false);
    } catch {
      setError("네트워크 오류로 등록하지 못했습니다.");
    } finally {
      setSaving(false);
    }
  }

  if (!trimmedStation) {
    return (
      <p className="muted mt-2 text-xs">
        납품·현황표에 없는 기능실은{" "}
        <strong className="text-emerald-900">역사를 먼저 선택</strong>한 뒤
        추가할 수 있습니다.
      </p>
    );
  }

  if (addableFacilities.length === 0) {
    return (
      <p className="muted mt-2 text-xs text-emerald-900/90">
        <strong>{trimmedStation}</strong> — 전기실·변전소·역무실이 모두
        등록되어 있습니다.
      </p>
    );
  }

  return (
    <div className="mt-2">
      {!open ? (
        <button
          type="button"
          className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-900 hover:bg-emerald-100"
          disabled={disabled}
          onClick={() => setOpen(true)}
        >
          + 새 기능실 추가
        </button>
      ) : (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50/80 p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-emerald-950">
              기능실 추가
            </span>
            <button
              type="button"
              className="text-xs text-blue-700 underline"
              disabled={disabled || saving}
              onClick={() => {
                setOpen(false);
                setFacilities([]);
                setError("");
              }}
            >
              닫기
            </button>
          </div>
          <p className="muted mb-2 text-xs">
            <strong style={lineColor ? { color: lineColor } : undefined}>
              {trimmedStation}
            </strong>
            에 추가할 기능실을 선택하세요.
            {existingFacilities.length > 0 ? (
              <span className="mt-1 block text-emerald-800">
                기존: {existingFacilities.join(" · ")}
              </span>
            ) : null}
          </p>
          <StationFacilityPicker
            multiple
            compact
            values={facilities}
            onValuesChange={setFacilities}
            disabled={disabled || saving}
            accentColor={lineColor}
            availableFacilities={addableFacilities}
          />
          {error ? (
            <p className="mt-2 text-xs text-red-600">{error}</p>
          ) : null}
          <div className="mt-3">
            <button
              type="button"
              className="btn btn-primary shrink-0 text-sm"
              disabled={disabled || saving}
              onClick={() => void handleSubmit()}
            >
              {saving ? "등록 중…" : "기능실 등록"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
