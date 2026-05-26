"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  formatMetroStationValue,
  parseMetroStationValue,
  type MetroLineInfo,
  type MetroStationInfo,
} from "@/lib/metroStations";

interface StationPickerProps {
  value: string;
  onChange: (name: string) => void;
  disabled?: boolean;
  /** 최근 사용 역 탭 */
  enableRecentTabs?: boolean;
  /** 호선 → 역사명 선택 (서울교통공사 1~9호선) */
  enableMetroPicker?: boolean;
  /** 호선 목록에 없을 때 직접 입력 */
  enableDirectInput?: boolean;
}

function recentTabMatches(name: string, query: string): boolean {
  const q = query.trim().toLowerCase().replace(/\s+/g, "");
  if (!q) return true;
  const n = name.toLowerCase().replace(/\s+/g, "");
  return n.includes(q);
}

export function StationPicker({
  value,
  onChange,
  disabled,
  enableRecentTabs = true,
  enableMetroPicker = true,
  enableDirectInput = true,
}: StationPickerProps) {
  const [lines, setLines] = useState<MetroLineInfo[]>([]);
  const [stations, setStations] = useState<MetroStationInfo[]>([]);
  const [loadingStations, setLoadingStations] = useState(false);

  const [selectedLine, setSelectedLine] = useState<number | "">("");
  const [selectedStation, setSelectedStation] = useState("");
  const [stationQuery, setStationQuery] = useState("");

  const [recentStations, setRecentStations] = useState<string[]>([]);
  const [recentQuery, setRecentQuery] = useState("");
  const [useDirectInput, setUseDirectInput] = useState(false);
  const [directValue, setDirectValue] = useState("");

  const loadRecent = useCallback(() => {
    fetch("/api/stations")
      .then((r) => r.json())
      .then((d) => setRecentStations(d.stations ?? []));
  }, []);

  useEffect(() => {
    if (!enableMetroPicker) return;
    fetch("/api/metro/lines")
      .then((r) => r.json())
      .then((d) => setLines(d.lines ?? []));
  }, [enableMetroPicker]);

  useEffect(() => {
    loadRecent();
  }, [loadRecent]);

  useEffect(() => {
    const parsed = parseMetroStationValue(value);
    if (parsed.line != null && parsed.stationName) {
      setSelectedLine(parsed.line);
      setSelectedStation(parsed.stationName);
      setUseDirectInput(false);
      setDirectValue("");
      return;
    }
    if (value.trim() && parsed.line == null) {
      setUseDirectInput(true);
      setDirectValue(value);
      setSelectedLine("");
      setSelectedStation("");
    } else if (!value.trim()) {
      setSelectedLine("");
      setSelectedStation("");
      setUseDirectInput(false);
      setDirectValue("");
    }
  }, [value]);

  useEffect(() => {
    if (!enableMetroPicker || selectedLine === "" || useDirectInput) {
      setStations([]);
      return;
    }
    setLoadingStations(true);
    const q = stationQuery.trim();
    const url = q
      ? `/api/metro/stations?line=${selectedLine}&q=${encodeURIComponent(q)}`
      : `/api/metro/stations?line=${selectedLine}`;
    fetch(url)
      .then((r) => r.json())
      .then((d) => setStations(d.stations ?? []))
      .finally(() => setLoadingStations(false));
  }, [enableMetroPicker, selectedLine, stationQuery, useDirectInput]);

  function applyMetroSelection(line: number, stationName: string) {
    const formatted = formatMetroStationValue(line, stationName);
    onChange(formatted);
    void registerStation(formatted);
  }

  function handleLineChange(lineStr: string) {
    if (!lineStr) {
      setSelectedLine("");
      setSelectedStation("");
      onChange("");
      return;
    }
    const line = Number(lineStr);
    setSelectedLine(line);
    setSelectedStation("");
    setStationQuery("");
    onChange("");
  }

  function handleStationPick(stationName: string) {
    if (selectedLine === "") return;
    setSelectedStation(stationName);
    setStationQuery("");
    applyMetroSelection(selectedLine, stationName);
  }

  async function registerStation(name: string) {
    const trimmed = name.trim();
    if (!trimmed) return;
    await fetch("/api/stations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: trimmed }),
    });
    loadRecent();
  }

  async function commitDirect() {
    const trimmed = directValue.trim();
    if (!trimmed) return;
    onChange(trimmed);
    await registerStation(trimmed);
  }

  const filteredRecent = useMemo(
    () => recentStations.filter((s) => recentTabMatches(s, recentQuery)),
    [recentStations, recentQuery]
  );

  const lineInfo = lines.find((l) => l.line === selectedLine);
  const isKnownRecent = value && recentStations.some((s) => s === value);

  return (
    <div className="station-picker">
      <label className="label">
        역사명 <span className="text-red-600">*</span>
      </label>
      <p className="muted mb-3 text-xs">
        <strong>1단계 호선</strong> → <strong>2단계 역사명</strong> 순으로
        선택하세요. (서울교통공사 1~9호선 데이터)
      </p>

      {enableMetroPicker && !useDirectInput && (
        <div className="metro-picker-steps">
          <div className="metro-step">
            <span className="metro-step-num" aria-hidden>
              1
            </span>
            <div className="metro-step-body">
              <label className="label text-sm" htmlFor="metro-line">
                호선 선택
              </label>
              <select
                id="metro-line"
                className="input mt-1"
                value={selectedLine === "" ? "" : String(selectedLine)}
                disabled={disabled}
                onChange={(e) => handleLineChange(e.target.value)}
              >
                <option value="">호선을 선택하세요</option>
                {lines.map((l) => (
                  <option key={l.line} value={l.line}>
                    {l.label} ({l.stationCount}개 역)
                  </option>
                ))}
              </select>
              {lineInfo ? (
                <span
                  className="metro-line-chip mt-2"
                  style={{ backgroundColor: lineInfo.color }}
                >
                  {lineInfo.label}
                </span>
              ) : null}
            </div>
          </div>

          <div className="metro-step">
            <span className="metro-step-num" aria-hidden>
              2
            </span>
            <div className="metro-step-body">
              <label className="label text-sm" htmlFor="metro-station-search">
                역사명 선택
              </label>
              {selectedLine === "" ? (
                <p className="muted mt-1 text-xs">먼저 호선을 선택해 주세요.</p>
              ) : (
                <>
                  <input
                    id="metro-station-search"
                    type="search"
                    className="input mt-1"
                    placeholder={`${lineInfo?.label ?? ""} 역 이름 검색 (예: 강남, 길음)`}
                    value={stationQuery}
                    disabled={disabled}
                    autoComplete="off"
                    onChange={(e) => setStationQuery(e.target.value)}
                  />
                  <div
                    className="metro-station-list mt-2"
                    role="listbox"
                    aria-label="역 목록"
                  >
                    {loadingStations ? (
                      <p className="muted p-2 text-xs">역 목록 불러오는 중…</p>
                    ) : stations.length === 0 ? (
                      <p className="muted p-2 text-xs">
                        일치하는 역이 없습니다. 검색어를 바꾸거나 아래 직접
                        입력을 이용하세요.
                      </p>
                    ) : (
                      stations.map((s) => (
                        <button
                          key={s.name}
                          type="button"
                          role="option"
                          aria-selected={selectedStation === s.name}
                          className={`metro-station-option ${
                            selectedStation === s.name ? "active" : ""
                          }`}
                          disabled={disabled}
                          onClick={() => handleStationPick(s.name)}
                        >
                          <span className="font-medium">{s.name}</span>
                          {s.areas?.length ? (
                            <span className="metro-station-area">
                              {s.areas.join(", ")}
                            </span>
                          ) : null}
                        </button>
                      ))
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {enableDirectInput && (
        <div className="mt-3">
          {!useDirectInput ? (
            <button
              type="button"
              className="text-xs text-blue-700 underline"
              disabled={disabled}
              onClick={() => setUseDirectInput(true)}
            >
              호선 목록에 없는 역은 직접 입력
            </button>
          ) : (
            <div className="rounded-lg border border-amber-200 bg-amber-50/80 p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-amber-900">
                  직접 입력
                </span>
                <button
                  type="button"
                  className="text-xs text-blue-700 underline"
                  disabled={disabled}
                  onClick={() => {
                    setUseDirectInput(false);
                    setDirectValue("");
                  }}
                >
                  호선 선택으로 돌아가기
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                <input
                  type="text"
                  className="input flex-1"
                  placeholder="예: 2호선 강남역 또는 길음역"
                  value={directValue}
                  disabled={disabled}
                  onChange={(e) => {
                    setDirectValue(e.target.value);
                    onChange(e.target.value);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void commitDirect();
                    }
                  }}
                />
                <button
                  type="button"
                  className="btn btn-secondary shrink-0"
                  disabled={disabled || !directValue.trim()}
                  onClick={() => void commitDirect()}
                >
                  등록
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {enableRecentTabs && recentStations.length > 0 && (
        <div className="mt-4">
          <label className="label text-xs font-medium text-slate-600">
            최근 사용 역 (바로 선택)
          </label>
          <input
            type="search"
            className="input mt-1"
            placeholder="최근 역 검색…"
            value={recentQuery}
            disabled={disabled}
            autoComplete="off"
            onChange={(e) => setRecentQuery(e.target.value)}
          />
          <div className="station-tabs mt-2 max-h-40 overflow-y-auto" role="tablist">
            {filteredRecent.map((name) => (
              <button
                key={name}
                type="button"
                role="tab"
                aria-selected={value === name}
                className={`station-tab ${value === name ? "active" : ""}`}
                disabled={disabled}
                onClick={() => {
                  onChange(name);
                  void registerStation(name);
                }}
              >
                {name}
              </button>
            ))}
          </div>
        </div>
      )}

      {value.trim() ? (
        <p className="muted mt-3 text-xs">
          선택됨: <strong>{value}</strong>
          {isKnownRecent ? " · 최근 목록에 있음" : ""}
        </p>
      ) : null}
    </div>
  );
}
