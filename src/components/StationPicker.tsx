"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

interface StationPickerProps {
  value: string;
  onChange: (name: string) => void;
  disabled?: boolean;
  /**
   * 등록된 역 탭이 많을 때 검색창으로 목록을 좁힙니다.
   * @default true
   */
  enableTabSearch?: boolean;
}

function stationTabMatches(name: string, query: string): boolean {
  const q = query.trim().toLowerCase().replace(/\s+/g, "");
  if (!q) return true;
  const n = name.toLowerCase().replace(/\s+/g, "");
  return n.includes(q);
}

export function StationPicker({
  value,
  onChange,
  disabled,
  enableTabSearch = true,
}: StationPickerProps) {
  const [stations, setStations] = useState<string[]>([]);
  const [tabQuery, setTabQuery] = useState("");

  const loadStations = useCallback(() => {
    fetch("/api/stations")
      .then((r) => r.json())
      .then((d) => setStations(d.stations ?? []));
  }, []);

  useEffect(() => {
    loadStations();
  }, [loadStations]);

  function selectStation(name: string) {
    onChange(name);
  }

  async function commitCustom(name: string) {
    const trimmed = name.trim();
    if (!trimmed) return;
    onChange(trimmed);
    await fetch("/api/stations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: trimmed }),
    });
    loadStations();
  }

  const isKnown = value && stations.some((s) => s === value);

  const filteredTabs = useMemo(
    () => stations.filter((s) => stationTabMatches(s, tabQuery)),
    [stations, tabQuery]
  );

  const tabsToShow = enableTabSearch ? filteredTabs : stations;

  return (
    <div className="station-picker">
      <label className="label">
        {"\uc5ed\uc0ac\uba85 "}
        <span className="text-red-600">*</span>
      </label>
      <p className="muted mb-2 text-xs">
        {
          "\ud604\uc7a5 \ubc29\ubb38 \uc9c0\ud558\ucca0 \uc5ed\uc744 \uc120\ud0dd\ud558\uac70\ub098 \uc544\ub798 \uc785\ub825\uce78\uc5d0 \uc9c1\uc811 \uc785\ub825\ud558\uc138\uc694. \ucd5c\uadfc \uc0ac\uc6a9 \uc5ed\uc740 \ud0ed\uc73c\ub85c \ubc14\ub85c \uc120\ud0dd\ud560 \uc218 \uc788\uc2b5\ub2c8\ub2e4."
        }
      </p>

      {enableTabSearch && stations.length > 0 && (
        <div className="mb-3">
          <label className="label text-xs font-medium text-slate-600">
            역사명 검색 (탭 목록 좁히기)
          </label>
          <input
            type="search"
            className="input mt-1"
            placeholder="예: 길음, 명동, 서울…"
            value={tabQuery}
            disabled={disabled}
            autoComplete="off"
            onChange={(e) => setTabQuery(e.target.value)}
          />
          {tabQuery.trim() && filteredTabs.length === 0 ? (
            <p className="muted mt-1 text-xs">
              일치하는 등록 역이 없습니다. 아래 입력란에 역 이름을 직접 적을 수
              있습니다.
            </p>
          ) : null}
        </div>
      )}

      {stations.length > 0 && (
        <div
          className={
            enableTabSearch
              ? "max-h-52 overflow-y-auto rounded-lg border border-slate-200 bg-white/80 p-2"
              : undefined
          }
        >
          <div className="station-tabs" role="tablist">
            {tabsToShow.map((name) => (
              <button
                key={name}
                type="button"
                role="tab"
                aria-selected={value === name}
                className={`station-tab ${value === name ? "active" : ""}`}
                disabled={disabled}
                onClick={() => selectStation(name)}
              >
                {name}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mt-2 flex flex-wrap gap-2">
        <input
          type="text"
          className="input flex-1"
          placeholder={"\uc608: \uba85\ub3d9\uc5ed, \ud68c\ud604\uc5ed"}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commitCustom(value);
            }
          }}
        />
        <button
          type="button"
          className="btn btn-secondary shrink-0"
          disabled={disabled || !value.trim() || Boolean(isKnown)}
          onClick={() => commitCustom(value)}
        >
          {isKnown ? "\ub4f1\ub85d\ub428" : "\uc0c8 \uc5ed \ub4f1\ub85d"}
        </button>
      </div>

      {value && isKnown && (
        <p className="muted mt-2 text-xs">
          {"\uc120\ud0dd: "}
          <strong>{value}</strong>
        </p>
      )}
    </div>
  );
}
