"use client";

import { useEffect, useMemo, useState } from "react";
import { Header } from "@/components/Header";
import { ManagerReportModal } from "@/components/ManagerReportModal";
import { getWeekRange, shiftWeek } from "@/lib/dates";
import { photoApiUrl } from "@/lib/photoUrl";
import type { WeeklySummary } from "@/lib/summary";
import type { DailyReport } from "@/lib/types";
import { formatWorkDuration } from "@/lib/workTime";

export default function ManagerPage() {
  const [teamName, setTeamName] = useState("epos 관리팀");
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
            <div className="space-y-3">
              {summary.members.map((m) => {
                const rate = Math.round(
                  (m.submittedDays / m.expectedDays) * 100
                );
                const badge =
                  rate >= 100
                    ? "badge-ok"
                    : rate >= 60
                      ? "badge-warn"
                      : "badge-danger";
                return (
                  <article key={m.member.id} className="card p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="text-lg font-bold">{m.member.name}</h3>
                      <span className={`badge ${badge}`}>
                        {m.submittedDays}/{m.expectedDays}일 ({rate}%)
                      </span>
                    </div>
                    {m.missingDates.length > 0 && (
                      <p className="muted mt-2 text-sm">
                        미제출: {m.missingDates.join(", ")}
                      </p>
                    )}
                    <p className="muted mt-1 text-xs">
                      날짜별 카드를 누르면 사진 포함 보고서 형식으로 큰 화면에서
                      볼 수 있습니다.
                    </p>
                    <div className="mt-3 space-y-3">
                      {m.reports.map((r) => (
                        <button
                          key={r.id}
                          type="button"
                          className="w-full rounded-lg border border-slate-200 bg-slate-50 p-3 text-left text-sm transition hover:border-blue-300 hover:bg-blue-50/50 focus:outline-none focus:ring-2 focus:ring-blue-400"
                          onClick={() =>
                            setReportView({ memberName: m.member.name, report: r })
                          }
                        >
                          <p className="flex flex-wrap items-center justify-between gap-2 font-semibold">
                            <span>
                              {r.date}
                              {r.stationName && (
                                <span className="ml-2 text-sm font-normal text-blue-800">
                                  {r.stationName}
                                </span>
                              )}
                            </span>
                            <span className="text-xs font-medium text-blue-600">
                              보고서 보기 →
                            </span>
                          </p>
                          {r.processingRole && (
                            <p className="muted mt-1 text-xs">
                              공종: <strong>{r.processingRole}</strong>
                              {r.workMinutes != null && (
                                <>
                                  {" "}
                                  · 작업{" "}
                                  {formatWorkDuration(r.workMinutes)}
                                </>
                              )}
                            </p>
                          )}
                          {(r.hasBeforePhoto || r.hasAfterPhoto) && (
                            <div className="manager-photo-row">
                              {r.hasBeforePhoto && (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={`${photoApiUrl(
                                    r.memberId,
                                    r.date,
                                    "before"
                                  )}${r.beforePhotoAt ? `&t=${encodeURIComponent(r.beforePhotoAt)}` : ""}`}
                                  alt="작업 전"
                                  title="작업 전"
                                />
                              )}
                              {r.hasAfterPhoto && (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={`${photoApiUrl(
                                    r.memberId,
                                    r.date,
                                    "after"
                                  )}${r.afterPhotoAt ? `&t=${encodeURIComponent(r.afterPhotoAt)}` : ""}`}
                                  alt="작업 후"
                                  title="작업 후"
                                />
                              )}
                            </div>
                          )}
                          <p className="mt-2 whitespace-pre-wrap">
                            <span className="font-medium">금일:</span> {r.done}
                          </p>
                          <p className="mt-1 whitespace-pre-wrap">
                            <span className="font-medium">익일:</span> {r.plan}
                          </p>
                          {r.issues && (
                            <p className="mt-1 whitespace-pre-wrap text-amber-800">
                              <span className="font-medium">이슈:</span>{" "}
                              {r.issues}
                            </p>
                          )}
                          {r.deficiencies && (
                            <p className="mt-1 whitespace-pre-wrap text-red-800">
                              <span className="font-medium">미비사항:</span>{" "}
                              {r.deficiencies}
                            </p>
                          )}
                        </button>
                      ))}
                    </div>
                  </article>
                );
              })}
            </div>
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

          {markdown && (
            <section className="card mt-4 p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-semibold">주간 요약본 (Markdown)</h3>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={downloadMarkdown}
                >
                  .md 다운로드
                </button>
              </div>
              <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-900 p-4 text-xs text-slate-100">
                {markdown}
              </pre>
            </section>
          )}
        </>
      )}
    </>
  );
}
