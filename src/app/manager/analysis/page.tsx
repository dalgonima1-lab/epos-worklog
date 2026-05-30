"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AnalysisWeekScopeBanner } from "@/components/AnalysisWeekScopeBanner";
import { Header } from "@/components/Header";
import { WeeklyAnalysisReport } from "@/components/WeeklyAnalysisReport";
import {
  formatScopeSummary,
  getAnalysisWeekScope,
} from "@/lib/analysisWeekScope";
import { getWeekRange, shiftWeek } from "@/lib/dates";

export default function ManagerAnalysisPage() {
  const [teamName, setTeamName] = useState("epos \uad00\ub9ac\ud300");
  /** 기본: 지난주 분석 (비교 = 지지난주 저장 보고서) */
  const [anchor, setAnchor] = useState(() => shiftWeek(new Date(), -1));
  const [pin, setPin] = useState("");
  const [authed, setAuthed] = useState(false);
  const [error, setError] = useState("");

  const [previousAnalysis, setPreviousAnalysis] = useState("");
  const [previousAnalysisHint, setPreviousAnalysisHint] = useState("");
  const [strategicChecklist, setStrategicChecklist] = useState("");
  const [managerNotes, setManagerNotes] = useState("");
  const [analysis, setAnalysis] = useState("");
  const [analysisNotice, setAnalysisNotice] = useState("");
  const [analysisSource, setAnalysisSource] = useState<
    "gemini" | "cursor" | "file" | "auto" | ""
  >("");
  const [autoRunning, setAutoRunning] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [meta, setMeta] = useState<{
    scopeSummary?: string;
    targetWeek: string;
    compareWeek: string;
    reportCount: number;
  } | null>(null);

  const scope = useMemo(() => getAnalysisWeekScope(anchor), [anchor]);
  const { targetWeek: week, compareWeek } = scope;
  const scopeText = useMemo(() => formatScopeSummary(scope), [scope]);

  useEffect(() => {
    fetch("/api/members")
      .then((r) => r.json())
      .then((d) => setTeamName(d.teamName));
  }, []);

  useEffect(() => {
    if (!authed || !pin) return;
    fetch(
      `/api/analysis/reference?start=${compareWeek.start}&end=${compareWeek.end}&pin=${encodeURIComponent(pin)}`
    )
      .then((r) => r.json())
      .then((d) => {
        if (d.text) {
          setPreviousAnalysis(d.text);
          setPreviousAnalysisHint(
            d.source === "analysis"
              ? `비교 기준(${scopeText.compareCaption}) — 저장된 주간 분석을 불러왔습니다.`
              : d.source === "reference"
                ? `비교 기준(${scopeText.compareCaption}) — 직접 붙여넣은 참고 보고서입니다.`
                : ""
          );
        } else {
          setPreviousAnalysis("");
          setPreviousAnalysisHint(
            `비교 기준 주(${scopeText.compareCaption})에 저장된 분석이 없습니다. ` +
              `아래에 PDF·txt를 붙여넣거나, 그 주차 분석을 먼저 만든 뒤 이용하세요.`
          );
        }
      });
    fetch(
      `/api/analysis/weekly?start=${week.start}&end=${week.end}&pin=${encodeURIComponent(pin)}`
    )
      .then((r) => r.json())
      .then((d) => {
        if (d.markdown) {
          setAnalysis(d.markdown);
          setAnalysisSource(d.source ?? "file");
          setAnalysisNotice(
            d.source === "auto"
              ? "매주 토요일 자동 저장된 주간 분석입니다."
              : d.source === "cursor"
                ? "저장된 Cursor 주간 분석입니다."
                : ""
          );
        } else {
          setAnalysis("");
          setAnalysisSource("");
          setAnalysisNotice("");
        }
      });
  }, [
    authed,
    pin,
    week.start,
    week.end,
    compareWeek.start,
    compareWeek.end,
    scopeText.compareCaption,
  ]);

  async function login(e: React.FormEvent) {
    e.preventDefault();
    const submitted = pin.trim();
    setPin(submitted);
    setError("");
    try {
      const res = await fetch("/api/auth/manager", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: submitted }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
      };
      if (!res.ok) {
        setAuthed(false);
        setError(
          data.error ??
            `서버 오류(HTTP ${res.status}). 새로고침 후 다시 시도해주세요.`
        );
        return;
      }
      setAuthed(Boolean(data.ok));
      setError(data.ok ? "" : (data.error ?? "PIN이 올바르지 않습니다."));
    } catch {
      setAuthed(false);
      setError("네트워크 오류입니다. 연결을 확인해주세요.");
    }
  }

  async function loadSampleReference() {
    const res = await fetch("/api/analysis/sample");
    const data = await res.json();
    if (data.text) setPreviousAnalysis(data.text);
    else setError(data.error ?? "\uc0d8\ud50c \ubd88\ub7ec\uc624\uae30 \uc2e4\ud328");
  }

  async function saveReference() {
    const res = await fetch("/api/analysis/reference", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pin,
        start: compareWeek.start,
        end: compareWeek.end,
        text: previousAnalysis,
      }),
    });
    if (res.ok) setError("");
    else {
      const d = await res.json();
      setError(d.error ?? "\uc800\uc7a5 \uc2e4\ud328");
    }
  }

  async function handleReferenceFile(file: File) {
    const text = await file.text();
    setPreviousAnalysis(text);
  }

  async function loadSavedAnalysis() {
    setError("");
    setAnalysisNotice("");
    setAnalysis("");
    const res = await fetch(
      `/api/analysis/weekly?start=${week.start}&end=${week.end}&pin=${encodeURIComponent(pin)}`
    );
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "저장된 분석을 불러오지 못했습니다.");
      return;
    }
    if (!data.markdown) {
      setError(
        `${week.label} 주차에 저장된 분석이 없습니다. ` +
          "상단에서 주차를 맞춘 뒤 다시 시도하세요. (예: 5월 3주차 = 2026-05-18 ~ 05-22)"
      );
      return;
    }
    setAnalysis(data.markdown);
    setAnalysisSource(data.source ?? "file");
    setAnalysisNotice(
      data.source === "cursor"
        ? "저장된 Cursor 주간 분석입니다."
        : "저장된 주간 분석입니다."
    );
  }

  async function generateAnalysis() {
    setGenerating(true);
    setError("");
    setAnalysisNotice("");
    try {
      const res = await fetch("/api/analysis/weekly", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pin,
          start: week.start,
          end: week.end,
          anchorDate: week.end,
          previousAnalysisText: previousAnalysis,
          managerNotes,
          strategicChecklist,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "분석 생성 실패");
        return;
      }
      setAnalysis(data.markdown);
      setMeta(data.meta ?? null);
      setAnalysisSource(data.source ?? (data.fromCache ? "cursor" : "gemini"));
      if (data.notice) setAnalysisNotice(data.notice);
      else if (data.fromCache) {
        setAnalysisNotice(
          "Gemini 대신 저장해 둔 주간 분석을 표시했습니다."
        );
      }
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setGenerating(false);
    }
  }

  function downloadAnalysis() {
    const blob = new Blob([analysis], {
      type: "text/markdown;charset=utf-8",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `주간분석_${week.start}.md`;
    a.click();
  }

  function printReport() {
    window.print();
  }

  async function runAutoAnalysis(force = false, partial = false) {
    setAutoRunning(true);
    setError("");
    try {
      const res = await fetch("/api/analysis/auto-run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pin,
          force,
          partial,
          start: week.start,
          end: week.end,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? data.reason ?? "자동 분석 실행 실패");
        return;
      }
      if (data.ok) {
        await loadSavedAnalysis();
        setAnalysisNotice(
          data.message ??
            `자동 분석을 저장했습니다 (${data.source === "gemini" ? "Gemini" : "자동"})`
        );
      } else {
        setError(
          data.reason ??
            "등록된 일일 기록이 없거나 이미 저장된 분석이 있습니다."
        );
      }
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setAutoRunning(false);
    }
  }

  return (
    <>
      <Header
        teamName={teamName}
        subtitle="주간 업무 분석 및 제언 (Gemini 또는 Cursor 저장본)"
      />

      <p className="muted mb-4 text-sm">
        <Link href="/manager" className="text-blue-700 underline">
          {"\u2190 \ud300\uc7a5 \ub300\uc2dc\ubcf4\ub4dc"}
        </Link>
      </p>

      {!authed ? (
        <form onSubmit={login} className="card max-w-md space-y-3 p-5">
          <p className="muted text-sm">
            {"Gemini·Cursor가 「비교 기준 주」에 저장된 보고서와 「분석 대상 주」 일일 기록을 대조해 "}
            <strong>
              {"\uc798\ud55c \uc810, \ubd80\uc871\ud55c \uc810, \ud300\uc7a5 \ucca8\uc5b8"}
            </strong>
            {"\uc744 \uc815\ub9ac\ud569\ub2c8\ub2e4."}
          </p>
          <div>
            <label className="label" htmlFor="pin">
              {"\ud300\uc7a5 PIN"}
            </label>
            <input
              id="pin"
              type="password"
              className="input"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button type="submit" className="btn btn-primary">
            {"\uc785\uc7a5"}
          </button>
        </form>
      ) : (
        <>
          <AnalysisWeekScopeBanner scope={scope} />

          <div className="card mb-4 flex flex-wrap items-center justify-between gap-3 p-4">
            <div>
              <p className="font-semibold">주차 이동</p>
              <p className="muted text-sm">
                「이전 주」「이번 주」로{" "}
                <strong>분석 대상</strong>만 바뀝니다. 비교 기준은 항상 그
                직전 주입니다.
              </p>
              <p className="mt-2 text-xs font-medium text-indigo-800">
                <strong>토요일 09:00</strong> — 등록 일정 전원 제출 시 전체 분석 저장
                <br />
                <strong>일요일 09:00</strong> — 미완료 시 <strong>등록분만</strong>{" "}
                분석 저장 · 수동 실행도 동일하게 등록된 일정·기록만 반영
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setAnchor(shiftWeek(anchor, -1))}
              >
                {"\uc774\uc804 \uc8fc"}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setAnchor(new Date())}
              >
                {"\uc774\ubc88 \uc8fc"}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => runAutoAnalysis(false, true)}
                disabled={autoRunning}
                title="등록된 일정·일일 기록만 반영 (공휴·미등록일 제외)"
              >
                {autoRunning ? "분석 중…" : "자동 분석·저장 (등록분)"}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => runAutoAnalysis(true, true)}
                disabled={autoRunning}
                title="기존 분석을 덮어쓰고 등록분만 다시 저장"
              >
                {autoRunning ? "분석 중…" : "다시 저장 (등록분)"}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={loadSavedAnalysis}
              >
                저장된 분석 보기
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={generateAnalysis}
                disabled={generating}
              >
                {generating
                  ? "분석 요청 중…"
                  : "Gemini로 새로 생성 (실패 시 저장본)"}
              </button>
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <section className="card space-y-3 p-4">
              <h3 className="font-semibold">
                1. 비교 기준 보고서 · {scopeText.compareCaption}
              </h3>
              <p className="muted text-xs">
                {scopeText.targetRelative} 분석 시 참고하는{" "}
                <strong>{scopeText.compareRelative}</strong> 저장본입니다.
                붙여넣기/업로드하거나, 해당 주에 저장된 분석이 있으면 자동으로
                채워집니다.
              </p>
              {previousAnalysisHint ? (
                <p className="text-xs text-violet-800">{previousAnalysisHint}</p>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn btn-secondary text-sm"
                  onClick={loadSampleReference}
                >
                  {"\uc0d8\ud50c \ubd88\ub7ec\uc624\uae30 (5\uc6d4 2\uc8fc\ucc28)"}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary text-sm"
                  onClick={saveReference}
                >
                  비교 기준 보고서 저장
                </button>
                <label className="btn btn-secondary cursor-pointer text-sm">
                  {".txt / .md \uc5c5\ub85c\ub4dc"}
                  <input
                    type="file"
                    accept=".txt,.md,text/plain,text/markdown"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleReferenceFile(f);
                    }}
                  />
                </label>
              </div>
              <textarea
                className="textarea min-h-[200px] font-mono text-xs"
                placeholder={`${scopeText.compareRelative}(${compareWeek.label}) 업무 분석·제언 보고서 전체를 붙여넣기…`}
                value={previousAnalysis}
                onChange={(e) => setPreviousAnalysis(e.target.value)}
              />
            </section>

            <section className="card space-y-3 p-4">
              <h3 className="font-semibold">
                {"2. \ud300\uc7a5 \ucca8\uc5b8 \ubc0f \uc9c0\uc2dc \uc0ac\ud56d"}
              </h3>
              <div>
                <label className="label">
                  {`첨언·추가 지시 (${scopeText.targetRelative} 보고서에 반영)`}
                </label>
                <textarea
                  className="textarea min-h-[120px]"
                  placeholder={
                    "\uc608: \ubd09\ucc9c\uc5ed DB \uc774\uc288 \uc7ac\ubc1c \ubc29\uc9c0\ub97c \uc704\ud574 \uba87\uc77c \ub0b4 \ub9e4\ub274\uc5bc \ud654..."
                  }
                  value={managerNotes}
                  onChange={(e) => setManagerNotes(e.target.value)}
                />
              </div>
              <div>
                <label className="label">
                  {
                    "\uc9c0\ub09c\uc8fc \ud575\uc2ec \uc804\ub7b5 \uacfc\uc81c (\uccb4\ud06c\ub9ac\uc2a4\ud2b8\uc6a9, \uc120\ud0dd)"
                  }
                </label>
                <textarea
                  className="textarea min-h-[100px] text-sm"
                  placeholder={
                    "\uc608: [\ucd5c\uc6d0\uc81c] \ud604\uc7a5 \uc2e4\ubb34 \ucd95\uc18c\n[\ub178\ud76c\ucc2c] \ubc18\ubcf5 \uc5d0\ub7ec \ub9e4\ub274\uc5bc\ud654..."
                  }
                  value={strategicChecklist}
                  onChange={(e) => setStrategicChecklist(e.target.value)}
                />
              </div>
            </section>
          </div>

          {analysisNotice && (
            <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              {analysisNotice}
            </p>
          )}

          {error && (
            <p className="mt-3 text-sm text-red-600">{error}</p>
          )}

          {meta && (
            <p className="muted mt-3 text-sm">
              {meta.scopeSummary ?? (
                <>
                  분석 대상 {meta.targetWeek} 일일 기록 {meta.reportCount}건 ·
                  비교 기준 {meta.compareWeek}
                </>
              )}
            </p>
          )}

          {analysis && (
            <section className="mt-6 w-full min-w-0 print:mt-0">
              <div className="no-print mb-4 flex flex-col gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm font-medium text-slate-700">
                  아래는 인쇄·공유용 보고서 화면입니다.
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={printReport}
                  >
                    인쇄 / PDF 저장
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={downloadAnalysis}
                  >
                    Markdown 다운로드
                  </button>
                </div>
              </div>
              <WeeklyAnalysisReport
                markdown={analysis}
                weekLabel={scopeText.targetCaption}
                compareWeekLabel={scopeText.compareCaption}
                source={analysisSource}
              />
            </section>
          )}
        </>
      )}
    </>
  );
}
