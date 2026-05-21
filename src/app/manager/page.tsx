"use client";

import { useEffect, useMemo, useState } from "react";
import { Header } from "@/components/Header";
import { ManagerReportModal } from "@/components/ManagerReportModal";
import { WeeklySummaryReport } from "@/components/WeeklySummaryReport";
import { getWeekRange, shiftWeek } from "@/lib/dates";
import type { WeeklySummary } from "@/lib/summary";
import type { DailyReport } from "@/lib/types";

export default function ManagerPage() {
  const [teamName, setTeamName] = useState("EPOS 관리팀");
  const [anchor, setAnchor] = useState(new Date());
  const [pin, setPin] = useState("");
  const [authed, setAuthed] = useState(false);
  const [summary, setSummary] = useState<WeeklySummary | null>(null);
  const [markdown, setMarkdown] = useState("");
  const [error, setError] = useState("");
  const [reportView, setReportView] = useState<{
    memberName: string;
    report: DailyReport;
  } | null>(null);

  const week = useMemo(() => getWeekRange(anchor), [anchor]);

  useEffect(() => {
    fetch("/api/members")
      .then((r) => r.json())
      .then((d) => setTeamName(d.teamName));
  }, []);

  useEffect(() => {
    if (authed) {
      loadSummary();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anchor, authed]);

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
      if (data.ok) loadSummary();
    } catch {
      setAuthed(false);
      setError("네트워크 오류입니다. 연결을 확인해주세요.");
    }
  }

  async function loadSummary() {
    setError("");
    const jsonRes = await fetch(
      `/api/summary?start=${week.start}&end=${week.end}&pin=${encodeURIComponent(pin)}`
    );
    if (!jsonRes.ok) {
      const err = await jsonRes.json();
      setError(err.error ?? "요약을 불러오지 못했습니다.");
      return;
    }
    const data = await jsonRes.json();
    setSummary(data.summary);

    const mdRes = await fetch(
      `/api/summary?start=${week.start}&end=${week.end}&pin=${encodeURIComponent(pin)}&format=markdown`
    );
    setMarkdown(await mdRes.text());
  }

  function downloadMarkdown() {
    const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `주간요약_${week.start}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <Header teamName={teamName} subtitle="팀장 대시보드 · 주간 요약" />

      {!authed ? (
        <form onSubmit={login} className="card max-w-md space-y-3 p-5">
          <p className="muted text-sm">
            팀장 전용 화면입니다. 초기 PIN은 <strong>1234</strong>입니다. 변경은
            로컬은 <code>data/store.json</code>, Vercel+Firebase는 Firestore
            문서 <code>epos-worklog/main</code>의 <code>managerPin</code>에서
            합니다.
          </p>
          <div>
            <label className="label" htmlFor="pin">
              팀장 PIN
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
            입장
          </button>
        </form>
      ) : (
        <>
          <div className="card mb-4 flex flex-wrap items-center justify-between gap-3 p-4">
            <div>
              <p className="font-semibold">주간 기간</p>
              <p className="muted">{week.label}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setAnchor(shiftWeek(anchor, -1))}
              >
                이전 주
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setAnchor(new Date())}
              >
                이번 주
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setAnchor(shiftWeek(anchor, 1))}
              >
                다음 주
              </button>
              <button type="button" className="btn btn-primary" onClick={loadSummary}>
                새로고침
              </button>
              <a href="/manager/analysis" className="btn btn-primary">
                AI 주간 분석
              </a>
            </div>
          </div>

          {summary && (
            <section className="card mt-4 overflow-hidden p-0">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50 px-4 py-3">
                <div>
                  <h3 className="font-semibold text-slate-900">
                    주간 요약 보고서
                  </h3>
                  <p className="muted text-xs">
                    팀·직원별 제출 현황과 일일 기록을 한 페이지에 정리했습니다.
                    일별 카드를 누르면 사진 포함 상세 보고서가 열립니다.
                  </p>
                </div>
                <div className="no-print flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="btn btn-secondary text-sm"
                    title="브라우저 인쇄에서 PDF 저장 가능"
                    onClick={() => window.print()}
                  >
                    인쇄 / PDF
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary text-sm"
                    disabled={!markdown}
                    onClick={downloadMarkdown}
                  >
                    .md 다운로드
                  </button>
                </div>
              </div>
              <div className="p-4 sm:p-6">
                <WeeklySummaryReport
                  summary={summary}
                  onDayClick={(memberName, report) =>
                    setReportView({ memberName, report })
                  }
                />
              </div>
              {markdown ? (
                <details className="border-t border-slate-100 bg-slate-50/80 px-4 py-3">
                  <summary className="cursor-pointer select-none text-sm font-semibold text-slate-700">
                    Markdown 원문 보기
                  </summary>
                  <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-900 p-4 text-xs text-slate-100">
                    {markdown}
                  </pre>
                </details>
              ) : null}
            </section>
          )}

          {reportView && summary && (
            <ManagerReportModal
              open
              teamName={summary.teamName}
              memberName={reportView.memberName}
              report={reportView.report}
              onClose={() => setReportView(null)}
            />
          )}

        </>
      )}
    </>
  );
}
