"use client";

import { useMemo, useState } from "react";
import { StationFacilityPicker } from "@/components/StationFacilityPicker";
import {
  formatMetroStationValue,
  getMetroLineColor,
  type MetroLineInfo,
} from "@/lib/metroStations";
import type { StationFacilityArea } from "@/lib/stationFacility";
import type { StationRecord } from "@/lib/types";

interface CustomStationAddPanelProps {
  lines: MetroLineInfo[];
  disabled?: boolean;
  customStations?: StationRecord[];
  onAdded: (station: string, facilities: StationFacilityArea[]) => void;
}

export function CustomStationAddPanel({
  lines,
  disabled,
  customStations = [],
  onAdded,
}: CustomStationAddPanelProps) {
  const [open, setOpen] = useState(false);
  const [line, setLine] = useState<number | "">("");
  const [stationName, setStationName] = useState("");
  const [facilities, setFacilities] = useState<StationFacilityArea[]>([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const lineColor =
    typeof line === "number" ? getMetroLineColor(line) : undefined;

  const previewName = useMemo(() => {
    const trimmed = stationName.trim();
    if (!trimmed) return "";
    if (typeof line === "number") {
      return formatMetroStationValue(line, trimmed);
    }
    return trimmed.endsWith("역") ? trimmed : `${trimmed}역`;
  }, [line, stationName]);

  async function handleSubmit() {
    setError("");
    const trimmed = stationName.trim();
    if (!trimmed) {
      setError("역사명을 입력해 주세요.");
      return;
    }
    if (facilities.length === 0) {
      setError("기능실을 1곳 이상 선택해 주세요.");
      return;
    }

    const formatted =
      typeof line === "number"
        ? formatMetroStationValue(line, trimmed)
        : trimmed.endsWith("역")
          ? trimmed
          : `${trimmed}역`;

    setSaving(true);
    try {
      const res = await fetch("/api/stations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formatted,
          facilities,
          custom: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "역사 등록에 실패했습니다.");
        return;
      }
      onAdded(formatted, facilities);
      setStationName("");
      setFacilities([]);
      setOpen(false);
    } catch {
      setError("네트워크 오류로 등록하지 못했습니다.");
    } finally {
      setSaving(false);
    }
  }

  function pickCustomStation(rec: StationRecord) {
    const areas = (rec.facilities ?? []).filter(
      (f): f is StationFacilityArea =>
        f === "전기실" || f === "변전소" || f === "역무실"
    );
    onAdded(rec.name, areas.length ? areas : ["전기실"]);
  }

  return (
    <div className="mt-3">
      {!open ? (
        <button
          type="button"
          className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-900 hover:bg-emerald-100"
          disabled={disabled}
          onClick={() => setOpen(true)}
        >
          + 새 역사 추가 (납품 목록 외)
        </button>
      ) : (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50/80 p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-emerald-950">
              새 역사 · 기능실 등록
            </span>
            <button
              type="button"
              className="text-xs text-blue-700 underline"
              disabled={disabled || saving}
              onClick={() => {
                setOpen(false);
                setError("");
              }}
            >
              닫기
            </button>
          </div>
          <p className="muted mb-3 text-xs">
            EPOS 납품·현황표에 없는 역사를 등록합니다. 등록한 기능실만
            선택할 수 있습니다.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label text-sm">호선 (선택)</label>
              <select
                className="input mt-1"
                value={line === "" ? "" : String(line)}
                disabled={disabled || saving}
                onChange={(e) =>
                  setLine(e.target.value ? Number(e.target.value) : "")
                }
              >
                <option value="">호선 없음 / 직접 입력</option>
                {lines.map((l) => (
                  <option key={l.line} value={l.line}>
                    {l.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label text-sm">
                역사명 <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                className="input mt-1"
                placeholder="예: 강남 또는 신규현장역"
                value={stationName}
                disabled={disabled || saving}
                onChange={(e) => setStationName(e.target.value)}
              />
            </div>
          </div>
          {previewName ? (
            <p className="muted mt-2 text-xs">
              저장 형식:{" "}
              <strong style={lineColor ? { color: lineColor } : undefined}>
                {previewName}
              </strong>
            </p>
          ) : null}
          <div className="mt-3">
            <StationFacilityPicker
              multiple
              values={facilities}
              onValuesChange={setFacilities}
              disabled={disabled || saving}
              accentColor={lineColor}
            />
          </div>
          {error ? (
            <p className="mt-2 text-xs text-red-600">{error}</p>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              className="btn btn-primary shrink-0"
              disabled={disabled || saving}
              onClick={() => void handleSubmit()}
            >
              {saving ? "등록 중…" : "역사 등록"}
            </button>
          </div>
        </div>
      )}

      {customStations.length > 0 ? (
        <div className="mt-3">
          <p className="label mb-1 text-xs text-emerald-950">등록한 역사</p>
          <div className="flex flex-wrap gap-1.5">
            {customStations.map((rec) => {
              const facilityLabel = (rec.facilities ?? []).join(" · ");
              return (
                <button
                  key={rec.name}
                  type="button"
                  className="rounded-full border border-emerald-200 bg-white px-2.5 py-1 text-left text-xs text-emerald-950 hover:bg-emerald-50"
                  disabled={disabled}
                  title={facilityLabel || rec.name}
                  onClick={() => pickCustomStation(rec)}
                >
                  <span className="font-medium">{rec.name}</span>
                  {facilityLabel ? (
                    <span className="ml-1 text-[10px] text-emerald-700">
                      ({facilityLabel})
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
