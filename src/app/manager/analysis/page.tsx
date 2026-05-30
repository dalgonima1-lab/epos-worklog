"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AnalysisWeekScopeBanner } from "@/components/AnalysisWeekScopeBanner";
import { Header } from "@/components/Header";
import { ManagerDirectivePanel } from "@/components/ManagerDirectivePanel";
import { WeeklyAnalysisReport } from "@/components/WeeklyAnalysisReport";
import {
  formatScopeSummary,
  getAnalysisWeekScope,
} from "@/lib/analysisWeekScope";
import { shiftWeek } from "@/lib/dates";
import { mergeDirectiveIntoMarkdown, formatDirectiveTimestamp } from "@/lib/managerDirective";
import type { ManagerDirective } from "@/lib/types";

export default function ManagerAnalysisPage() {
  const [teamName, setTeamName] = useState("epos \uad00\ub9ac\ud300");
  /** 기본: 이번 주 분석 (비교 = 지난주 저장 보고서) */
  const [anchor, setAnchor] = useState(() => new Date());
  const [pin, setPin] = useState("");
  const [authed, setAuthed] = useState(false);
  const [error, setError] = useState("");

  const [previousAnalysis, setPreviousAnalysis] = useState("");
  const [previousAnalysisHint, setPreviousAnalysisHint] = useState("");
  const [strategicChecklist, setStrategicChecklist] = useState("");
  const [managerNotes, setManagerNotes] = useState("");
  const [baseAnalysis, setBaseAnalysis] = useState("");
  const [managerDirective, setManagerDirective] =
    useState<ManagerDirective | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [analysisNotice, setAnalysisNotice] = useState("");
  const [analysisSource, setAnalysisSource] = useState<
    "gemini" | "cursor" | "file" | "auto" | ""
  >("");
  const [autoRunning, setAutoRunning] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [referenceSavedHint, setReferenceSavedHint] = useState("");
  const [viewingCompareReport, setViewingCompareReport] = useState(false);
  const [meta, setMeta] = useState<{
    scopeSummary?: string;
    targetWeek: string;
    compareWeek: string;
    reportCount: number;
  } | null>(null);

  const scope = useMemo(() => getAnalysisWeekScope(anchor), [anchor]);
  const { targetWeek: week, compareWeek } = scope;
  const scopeText = useMemo(() => formatScopeSummary(scope), [scope]);
  const displayAnalysis = useMemo(
    () => mergeDirectiveIntoMarkdown(baseAnalysis, managerDirective),
    [baseAnalysis, managerDirective]
  );
  const hasReport = Boolean(baseAnalysis.trim());

  async function loadCompareReference() {
    if (!pin) return false;
    const res = await fetch(
      `/api/analysis/reference?start=${compareWeek.start}&end=${compareWeek.end}&pin=${encodeURIComponent(pin)}`
    );
    const data = (await res.json().catch(() => ({}))) as {
      text?: string;
      source?: string;
      error?: string;
      weekLabel?: string;
    };

    if (!res.ok) {
      setPreviousAnalysis("");
      setPreviousAnalysisHint(
        data.error ??
          `비교 기준 주(${scopeText.compareCaption}) 불러오기 실패`
      );
      return false;
    }

    if (data.text?.trim()) {
      setPreviousAnalysis(data.text);
      setPreviousAnalysisHint(
        data.source === "analysis"
          ? `비교 기준(${scopeText.compareCaption}) — 저장된 주간 분석을 불러왔습니다.`
          : data.source === "reference"
            ? `비교 기준(${scopeText.compareCaption}) — 저장된 참고 보고서입니다.`
            : `비교 기준(${scopeText.compareCaption}) — ${data.weekLabel ?? ""}`
      );
      return true;
    }

    setPreviousAnalysis("");
    setPreviousAnalysisHint(
      `비교 기준 주(${scopeText.compareCaption})에 저장된 분석이 없습니다. ` +
        `「${compareWeek.label}」 주차에서 「자동 분석·저장」을 먼저 실행하거나, ` +
        `아래에 지난주 보고서를 붙여넣은 뒤 「비교 기준 보고서 저장」을 눌러 주세요.`
    );
    return false;
  }

  useEffect(() => {
    fetch("/api/members")
      .then((r) => r.json())
      .then((d) => setTeamName(d.teamName));
  }, []);

  useEffect(() => {
    if (!authed || !pin) return;

    let cancelled = false;

    async function loadTargetAnalysis() {
      const res = await fetch(
        `/api/analysis/weekly?start=${week.start}&end=${week.end}&pin=${encodeURIComponent(pin)}`
      );
      const data = (await res.json().catch(() => ({}))) as {
        markdown?: string;
        source?: string;
        managerDirective?: ManagerDirective | null;
      };
      if (cancelled) return;
      setViewingCompareReport(false);
      if (data.markdown?.trim()) {
        setBaseAnalysis(String(data.markdown));
        setManagerDirective(data.managerDirective ?? null);
        setAnalysisSource(
          (data.source as typeof analysisSource) || "file"
        );
        setAnalysisNotice(
          data.source === "auto"
            ? "매주 토요일 자동 저장된 주간 분석입니다."
            : data.source === "cursor"
              ? "저장된 Cursor 주간 분석입니다."
              : ""
        );
      } else {
        setBaseAnalysis("");
        setManagerDirective(null);
        setAnalysisSource("");
        setAnalysisNotice("");
      }
    }

    void loadCompareReference();
    void loadTargetAnalysis();
    setReferenceSavedHint("");
    setEditMode(false);

    return () => {
      cancelled = true;
    };
  }, [
    authed,
    pin,
    week.start,
    week.end,
    compareWeek.start,
    compareWeek.end,
    compareWeek.label,
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
    if (!previousAnalysis.trim()) {
      setError("비교 기준 보고서 내용을 붙여넣은 뒤 저장해 주세요.");
      return;
    }
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
    if (res.ok) {
      setError("");
      setReferenceSavedHint(
        `✓ ${scopeText.compareCaption} 비교 기준 보고서를 저장했습니다. 이번 주 분석 시 자동으로 사용됩니다.`
      );
    } else {
      const d = await res.json();
      setError(d.error ?? "저장 실패");
      setReferenceSavedHint("");
    }
  }

  async function handleReferenceFile(file: File) {
    const text = await file.text();
    setPreviousAnalysis(text);
  }

  async function loadSavedAnalysis(): Promise<boolean> {
    setError("");
    setViewingCompareReport(false);
    setAnalysisNotice("");
    const res = await fetch(
      `/api/analysis/weekly?start=${week.start}&end=${week.end}&pin=${encodeURIComponent(pin)}`
    );
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "저장된 분석을 불러오지 못했습니다.");
      return false;
    }
    if (!data.markdown) {
      setBaseAnalysis("");
      setManagerDirective(null);
      return false;
    }
    setBaseAnalysis(String(data.markdown ?? ""));
    setManagerDirective(data.managerDirective ?? null);
    setAnalysisSource(data.source ?? "file");
    setAnalysisNotice(
      data.source === "cursor"
        ? "저장된 Cursor 주간 분석입니다."
        : `분석 대상 주(${scopeText.targetCaption}) 저장본입니다.`
    );
    return true;
  }

  async function loadCompareReportView() {
    setError("");
    setViewingCompareReport(true);
    const res = await fetch(
      `/api/analysis/reference?start=${compareWeek.start}&end=${compareWeek.end}&pin=${encodeURIComponent(pin)}`
    );
    const data = (await res.json().catch(() => ({}))) as {
      text?: string;
      source?: string;
      error?: string;
    };
    if (!res.ok) {
      setError(data.error ?? "비교 기준 보고서를 불러오지 못했습니다.");
      return;
    }
    const text = data.text?.trim() || previousAnalysis.trim();
    if (!text) {
      setError(
        `${scopeText.compareCaption}(지난주)에 저장된 분석이 없습니다. ` +
          `왼쪽 칸에 붙여넣고 「비교 기준 보고서 저장」을 누르거나, ` +
          `해당 주차로 이동해 「자동 분석·저장」을 실행해 주세요.`
      );
      return;
    }
    if (data.text?.trim()) setPreviousAnalysis(data.text);
    setBaseAnalysis(text);
    setAnalysisSource(data.source === "analysis" ? "auto" : "file");
    setAnalysisNotice(
      `지난주·비교 기준(${scopeText.compareCaption}) 저장본 미리보기입니다. ` +
        `이번 주 분석을 보려면 「분석 대상 주 보기」를 누르세요.`
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
      if (!data.markdown?.trim()) {
        setError("분석 결과가 비어 있습니다. 다시 시도해 주세요.");
        return;
      }
      setBaseAnalysis(String(data.markdown));
      setMeta(data.meta ?? null);
      setAnalysisSource(data.source ?? (data.fromCache ? "cursor" : "gemini"));
      if (data.notice) setAnalysisNotice(data.notice);
      else if (data.fromCache) {
        setAnalysisNotice(
          "Gemini 대신 저장해 둔 주간 분석을 표시했습니다."
        );
      }
      setEditMode(false);
      await loadSavedAnalysis();
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setGenerating(false);
    }
  }

  function downloadAnalysis() {
    const blob = new Blob([displayAnalysis], {
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
        setEditMode(false);
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
          {"\u2190 \uad00\ub9ac\uc790 \ub300\uc2dc\ubcf4\ub4dc"}
        </Link>
      </p>

      {!authed ? (
        <form onSubmit={login} className="card max-w-md space-y-3 p-5">
          <p className="muted text-sm">
            {"로그인 후 해당 주의 저장된 보고서가 먼저 표시됩니다. "}
            <strong>
              {"첨언·지시는 보고서 화면에서 저장하고, 보고서 갱신은 「다시 분석하기」에서 진행합니다."}
            </strong>
          </p>
          <div>
            <label className="label" htmlFor="pin">
              {"\uad00\ub9ac\uc790 PIN"}
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
      ) : editMode ? (
        <>
          <AnalysisWeekScopeBanner scope={scope} />

          <div className="card mb-4 flex flex-wrap items-center justify-between gap-3 p-4">
            <div>
              <p className="font-semibold">보고서 다시 분석하기</p>
              <p className="muted text-sm">
                비교 기준(지난주)을 맞춘 뒤 자동 분석·Gemini로 보고서를 생성·갱신합니다.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setEditMode(false);
                  setError("");
                }}
              >
                ← 보고서 보기
              </button>
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
              >
                {autoRunning ? "분석 중…" : "자동 분석·저장 (등록분)"}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => runAutoAnalysis(true, true)}
                disabled={autoRunning}
              >
                {autoRunning ? "분석 중…" : "다시 저장 (등록분)"}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => void loadSavedAnalysis()}
              >
                분석 대상 주 보기
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={loadCompareReportView}
              >
                지난주(비교) 보기
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

          <section className="card mb-4 space-y-3 p-4">
            <h3 className="font-semibold">
              ① 비교 기준 보고서 · {scopeText.compareCaption}
            </h3>
            <p className="muted text-xs">
              {scopeText.targetRelative} 분석 시 참고하는{" "}
              <strong>{scopeText.compareRelative}</strong> 저장본입니다.
            </p>
            {previousAnalysisHint ? (
              <p className="text-xs text-violet-800">{previousAnalysisHint}</p>
            ) : null}
            {referenceSavedHint ? (
              <p className="text-xs font-medium text-emerald-800">{referenceSavedHint}</p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="btn btn-secondary text-sm"
                onClick={() => void loadCompareReference()}
              >
                저장된 지난주 불러오기
              </button>
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
              className="textarea min-h-[160px] font-mono text-xs"
              placeholder={`${scopeText.compareRelative}(${compareWeek.label}) 업무 분석·제언 보고서 전체를 붙여넣기…`}
              value={previousAnalysis}
              onChange={(e) => setPreviousAnalysis(e.target.value)}
            />
          </section>

          {analysisNotice && (
            <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              {analysisNotice}
            </p>
          )}

          {error && (
            <p className="mb-3 text-sm text-red-600">{error}</p>
          )}

          {meta && (
            <p className="muted mb-3 text-sm">
              {meta.scopeSummary ?? (
                <>
                  분석 대상 {meta.targetWeek} 일일 기록 {meta.reportCount}건 ·
                  비교 기준 {meta.compareWeek}
                </>
              )}
            </p>
          )}

          <section className="card mb-4 w-full min-w-0 space-y-4 p-4">
            <h3 className="font-semibold">
              ② 생성 미리보기 · {viewingCompareReport ? scopeText.compareCaption : scopeText.targetCaption}
            </h3>
            {baseAnalysis ? (
              <WeeklyAnalysisReport
                markdown={baseAnalysis}
                weekLabel={
                  viewingCompareReport
                    ? scopeText.compareCaption
                    : scopeText.targetCaption
                }
                compareWeekLabel={
                  viewingCompareReport ? undefined : scopeText.compareCaption
                }
                source={analysisSource}
              />
            ) : (
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center">
                <p className="text-sm text-slate-600">
                  아직 생성된 보고서가 없습니다.
                </p>
              </div>
            )}
          </section>

          <section className="card space-y-4 p-4">
            <h3 className="font-semibold">Gemini 생성 옵션 (선택)</h3>
            <p className="muted text-xs">
              Gemini 재생성 시 아래 내용을 프롬프트에 포함합니다. 첨언·지시는
              보고서 화면에서 별도 저장하는 것을 권장합니다.
            </p>
            <div>
              <label className="label">첨언 및 지시사항 (프롬프트용)</label>
              <textarea
                className="textarea min-h-[100px]"
                value={managerNotes}
                onChange={(e) => setManagerNotes(e.target.value)}
              />
            </div>
            <div>
              <label className="label">지난주 핵심 전략 과제 (선택)</label>
              <textarea
                className="textarea min-h-[100px] text-sm"
                value={strategicChecklist}
                onChange={(e) => setStrategicChecklist(e.target.value)}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="btn btn-primary"
                onClick={generateAnalysis}
                disabled={generating}
              >
                {generating ? "생성 중…" : "Gemini로 생성·저장"}
              </button>
            </div>
          </section>
        </>
      ) : (
        <>
          <AnalysisWeekScopeBanner scope={scope} />

          <div className="card mb-4 flex flex-wrap items-center justify-between gap-3 p-4">
            <div>
              <p className="font-semibold">
                {scopeText.targetCaption} 주간 분석 보고서
              </p>
              <p className="muted text-sm">
                저장된 보고서를 확인하고, 아래에서 첨언·지시를 작성하세요.
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
                className="btn btn-primary"
                onClick={() => setEditMode(true)}
              >
                {hasReport ? "보고서 다시 분석하기" : "보고서 생성하기"}
              </button>
            </div>
          </div>

          {managerDirective?.text?.trim() ? (
            <p className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
              <strong>첨언·지시사항이 반영된 보고서입니다.</strong>{" "}
              {managerDirective.author} ·{" "}
              {formatDirectiveTimestamp(managerDirective.updatedAt)} 저장
            </p>
          ) : null}

          {analysisNotice && (
            <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              {analysisNotice}
            </p>
          )}

          {error && (
            <p className="mb-3 text-sm text-red-600">{error}</p>
          )}

          <section className="card mb-4 w-full min-w-0 space-y-4 p-4">
            {hasReport ? (
              <>
                <div className="no-print flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm font-medium text-slate-700">
                    인쇄·공유용 보고서 화면
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
                  markdown={displayAnalysis}
                  weekLabel={scopeText.targetCaption}
                  compareWeekLabel={scopeText.compareCaption}
                  source={analysisSource}
                />
              </>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center">
                <p className="text-sm text-slate-600">
                  {scopeText.targetCaption}에 저장된 보고서가 없습니다.
                </p>
                <p className="muted mt-1 text-xs">
                  「보고서 생성하기」로 분석·저장을 진행해 주세요.
                </p>
                <button
                  type="button"
                  className="btn btn-primary mt-4"
                  onClick={() => setEditMode(true)}
                >
                  보고서 생성하기
                </button>
              </div>
            )}
          </section>

          {hasReport ? (
            <ManagerDirectivePanel
              pin={pin}
              weekStart={week.start}
              weekEnd={week.end}
              weekCaption={scopeText.targetCaption}
              directive={managerDirective}
              onSaved={(saved) => {
                setManagerDirective(saved);
              }}
            />
          ) : null}
        </>
      )}
    </>
  );
}
