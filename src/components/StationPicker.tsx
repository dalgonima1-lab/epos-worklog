"use client";

import { useCallback, useEffect, useState } from "react";

interface StationPickerProps {
  value: string;
  onChange: (name: string) => void;
  disabled?: boolean;
}

export function StationPicker({ value, onChange, disabled }: StationPickerProps) {
  const [stations, setStations] = useState<string[]>([]);

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

      {stations.length > 0 && (
        <div className="station-tabs" role="tablist">
          {stations.map((name) => (
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
