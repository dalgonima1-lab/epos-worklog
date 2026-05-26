"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
} from "react";
import { StationFacilityPicker } from "@/components/StationFacilityPicker";
import {
  filterMetroStations,
  formatMetroStationValue,
  getMetroLineColor,
  getMetroStationsForLine,
  parseMetroStationValue,
  type MetroLineInfo,
} from "@/lib/metroStations";
import {
  formatStationVisitLabel,
  type StationFacilityArea,
} from "@/lib/stationFacility";

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
  /** 역사 선택 후 작업 장소 (전기실·변전소·역무실) */
  facilityArea?: string;
  onFacilityChange?: (area: StationFacilityArea | "") => void;
  /** 작업 장소 필수 (일일기록) */
  requireFacility?: boolean;
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
  facilityArea = "",
  onFacilityChange,
  requireFacility = false,
}: StationPickerProps) {
  const [lines, setLines] = useState<MetroLineInfo[]>([]);
  const [stationListOpen, setStationListOpen] = useState(false);

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
      .then((d) => setRecentStations(d.recent ?? d.stations ?? []));
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

  const allLineStations = useMemo(() => {
    if (selectedLine === "") return [];
    return getMetroStationsForLine(selectedLine);
  }, [selectedLine]);

  const filteredStations = useMemo(() => {
    if (selectedLine === "") return [];
    const q = stationQuery.trim();
    return q
      ? filterMetroStations(selectedLine, q)
      : allLineStations;
  }, [selectedLine, stationQuery, allLineStations]);

  function setStationValue(name: string) {
    if (name.trim() !== value.trim()) {
      onFacilityChange?.("");
    }
    onChange(name);
  }

  function applyMetroSelection(line: number, stationName: string) {
    const formatted = formatMetroStationValue(line, stationName);
    setStationValue(formatted);
    void registerStation(formatted);
  }

  function handleLineChange(lineStr: string) {
    if (!lineStr) {
      setSelectedLine("");
      setSelectedStation("");
      setStationListOpen(false);
      setStationValue("");
      return;
    }
    const line = Number(lineStr);
    setSelectedLine(line);
    setSelectedStation("");
    setStationQuery("");
    setStationListOpen(false);
    setStationValue("");
  }

  function handleStationPick(stationName: string) {
    if (selectedLine === "") return;
    setSelectedStation(stationName);
    setStationQuery("");
    setStationListOpen(false);
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
    setStationValue(trimmed);
    await registerStation(trimmed);
  }

  const filteredRecent = useMemo(
    () => recentStations.filter((s) => recentTabMatches(s, recentQuery)),
    [recentStations, recentQuery]
  );

  const lineInfo = lines.find((l) => l.line === selectedLine);
  const lineColor =
    selectedLine !== "" ? (lineInfo?.color ?? getMetroLineColor(selectedLine)) : "";
  const metroLineStyle = lineColor
    ? ({ "--metro-line-color": lineColor } as CSSProperties)
    : undefined;

  const valueParsed = parseMetroStationValue(value);
  const valueLineColor =
    valueParsed.line != null ? getMetroLineColor(valueParsed.line) : "";

  const isKnownRecent = value && recentStations.some((s) => s === value);

  function recentTabBorderStyle(name: string): CSSProperties | undefined {
    const { line } = parseMetroStationValue(name);
    if (line == null) return undefined;
    const c = getMetroLineColor(line);
    return {
      borderColor: c,
      borderWidth: 2,
      boxShadow: value === name ? `0 0 0 1px ${c}` : undefined,
    };
  }

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
        <div
          className={`metro-picker-steps${lineColor ? " metro-picker-steps--lined" : ""}`}
          style={metroLineStyle}
        >
          <div className={`metro-step${lineColor ? " metro-step--lined" : ""}`}>
            <span
              className={`metro-step-num${lineColor ? " metro-step-num--lined" : ""}`}
              style={
                lineColor
                  ? { borderColor: lineColor, color: lineColor }
                  : undefined
              }
              aria-hidden
            >
              1
            </span>
            <div className="metro-step-body">
              <label className="label text-sm" htmlFor="metro-line">
                호선 선택
              </label>
              <select
                id="metro-line"
                className={`input mt-1${lineColor ? " metro-input--lined" : ""}`}
                style={lineColor ? { borderColor: lineColor } : undefined}
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
                  style={{
                    backgroundColor: lineInfo.color,
                    borderColor: lineInfo.color,
                  }}
                >
                  {lineInfo.label}
                </span>
              ) : null}
            </div>
          </div>

          <div className={`metro-step${lineColor ? " metro-step--lined" : ""}`}>
            <span
              className={`metro-step-num${lineColor ? " metro-step-num--lined" : ""}`}
              style={
                lineColor
                  ? { borderColor: lineColor, color: lineColor }
                  : undefined
              }
              aria-hidden
            >
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
                  {selectedStation ? (
                    <p className="mt-1 text-sm">
                      선택한 역:{" "}
                      <strong>
                        {formatMetroStationValue(selectedLine, selectedStation)}
                      </strong>
                    </p>
                  ) : null}

                  <button
                    type="button"
                    className={`metro-station-list-toggle mt-2${lineColor ? " metro-station-list-toggle--lined" : ""}`}
                    style={
                      lineColor
                        ? {
                            borderColor: lineColor,
                            color: lineColor,
                            ["--metro-line-color" as string]: lineColor,
                          }
                        : undefined
                    }
                    disabled={disabled}
                    aria-expanded={stationListOpen}
                    aria-controls="metro-station-list-panel"
                    onClick={() => setStationListOpen((open) => !open)}
                  >
                    {stationListOpen
                      ? "역 목록 닫기"
                      : `${lineInfo?.label ?? ""} 역 목록에서 선택 (${allLineStations.length}개)`}
                  </button>

                  {stationListOpen ? (
                    <div
                      id="metro-station-list-panel"
                      className="metro-station-list-panel mt-2"
                    >
                      <input
                        id="metro-station-search"
                        type="search"
                        className={`input${lineColor ? " metro-input--lined" : ""}`}
                        style={lineColor ? { borderColor: lineColor } : undefined}
                        placeholder={`역 이름 검색 (예: 서울, 종로)`}
                        value={stationQuery}
                        disabled={disabled}
                        autoComplete="off"
                        onChange={(e) => setStationQuery(e.target.value)}
                      />
                      <p className="muted mt-2 text-xs">
                        아래 목록에서 역을 눌러 선택하세요.
                        {stationQuery.trim()
                          ? ` · 검색 결과 ${filteredStations.length}개`
                          : ` · 전체 ${allLineStations.length}개`}
                      </p>
                      <div
                        className={`metro-station-list mt-2${lineColor ? " metro-station-list--lined" : ""}`}
                        style={lineColor ? { borderColor: lineColor } : undefined}
                        role="listbox"
                        aria-label={`${lineInfo?.label ?? ""} 역 목록`}
                      >
                        {filteredStations.length === 0 ? (
                          <p className="muted p-3 text-xs text-center">
                            일치하는 역이 없습니다. 검색어를 바꿔 보세요.
                          </p>
                        ) : (
                          filteredStations.map((s) => (
                            <button
                              key={s.name}
                              type="button"
                              role="option"
                              aria-selected={selectedStation === s.name}
                              className={`metro-station-option ${
                                selectedStation === s.name ? "active" : ""
                              }${lineColor ? " metro-station-option--lined" : ""}`}
                              style={
                                lineColor
                                  ? {
                                      borderLeftColor: lineColor,
                                      ...(selectedStation === s.name
                                        ? {
                                            borderColor: lineColor,
                                            boxShadow: `inset 3px 0 0 ${lineColor}`,
                                          }
                                        : {}),
                                    }
                                  : undefined
                              }
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
                    </div>
                  ) : null}
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
                    setStationValue(e.target.value);
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
                style={recentTabBorderStyle(name)}
                disabled={disabled}
                onClick={() => {
                  setStationValue(name);
                  void registerStation(name);
                }}
              >
                {name}
              </button>
            ))}
          </div>
        </div>
      )}

      {value.trim() && onFacilityChange ? (
        <div className="mt-4">
          <StationFacilityPicker
            value={facilityArea}
            onChange={onFacilityChange}
            disabled={disabled}
            accentColor={valueLineColor || lineColor || undefined}
          />
        </div>
      ) : null}

      {value.trim() ? (
        <p
          className={`muted mt-3 text-xs metro-selection-summary${
            valueLineColor ? " metro-selection-summary--lined" : ""
          }`}
          style={
            valueLineColor
              ? { borderColor: valueLineColor, ["--metro-line-color" as string]: valueLineColor }
              : undefined
          }
        >
          선택됨:{" "}
          <strong>
            {formatStationVisitLabel(value, facilityArea) || value}
          </strong>
          {isKnownRecent ? " · 최근 목록에 있음" : ""}
          {requireFacility && !facilityArea ? (
            <span className="text-red-600"> · 작업 장소를 선택해 주세요</span>
          ) : null}
        </p>
      ) : null}
    </div>
  );
}
