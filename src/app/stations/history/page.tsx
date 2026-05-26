"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Header } from "@/components/Header";
import { ManagerReportModal } from "@/components/ManagerReportModal";
import { StationPicker } from "@/components/StationPicker";
import {
  calendarDaysBetween,
  relativeCalendarDayLabel,
} from "@/lib/dates";
import type { DailyReport, Member } from "@/lib/types";
import { photoApiUrl } from "@/lib/photoUrl";
import { formatWorkDuration } from "@/lib/workTime";

export default function StationHistoryPage() {
  const [teamName, setTeamName] = useState("EPOS 관리팀");
  const [members, setMembers] = useState<Member[]>([]);
  const [station, setStation] = useState("");
  const [reports, setReports] = useState<DailyReport[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searchedStation, setSearchedStation] = useState("");
  const [reportView, setReportView] = useState<{
    memberName: string;
    report: DailyReport;
  } | null>(null);
  const [recordQuery, setRecordQuery] = useState("");

  useEffect(() => {
    fetch("/api/members")
      .then((r) => r.json())
      .then((d) => {
        setTeamName(d.teamName ?? "EPOS 관리팀");
        setMembers(d.members ?? []);
      })
      .catch(() => {});
  }, []);

  const memberNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const mem of members) {
      m.set(mem.id, mem.name);
    }
    return m;
  }, [members]);

  const visibleReports = useMemo(() => {
    const q = recordQuery.trim().toLowerCase();
    if (!q) return reports;
    return reports.filter((r) => {
      const name = memberNameById.get(r.memberId) ?? r.memberId;
      const blob = [
        r.date,
        name,
        r.stationName,
        r.processingRole,
        r.done,
        r.plan,
        r.issues ?? "",
        r.deficiencies ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return blob.includes(q);
    });
  }, [reports, recordQuery, memberNameById]);

  const showVisitGaps = !recordQuery.trim();

  const loadHistory = useCallback(async () => {
    const q = station.trim();
    if (!q) {
      setError("역사를 선택하거나 입력한 뒤 조회해 주세요.");
      return;
    }
    setError("");
    setLoading(true);
    setSearchedStation(q);
    try {
      const res = await fetch(
        `/api/reports/by-station?station=${encodeURIComponent(q)}`
      );
      const data = (await res.json()) as { reports?: DailyReport[]; error?: string };
      if (!res.ok) {
        setReports([]);
        setRecordQuery("");
        setError(data.error ?? "불러오지 못했습니다.");
        return;
      }
      setReports(data.reports ?? []);
      setRecordQuery("");
    } catch {
      setReports([]);
      setRecordQuery("");
      setError("네트워크 오류입니다.");
    } finally {
      setLoading(false);
    }
  }, [station]);

  return (
    <>
      <Header
        teamName={teamName}
        subtitle="역사별 방문·공종·작업 내역 히스토리"
      />

      <section className="card p-5">
        <h2 className="text-lg font-bold">역사 선택</h2>
        <p className="muted mt-2 text-sm">
          <strong>호선 → 역사명</strong> 순으로 선택한 뒤 조회하세요. 일일 기록에
          저장된 이름과 같으면 찾을 수 있습니다(예:{" "}
          <code className="text-xs">7호선 길음역</code>과{" "}
          <code className="text-xs">길음역</code>도 같은 역으로 인식).
        </p>
        <div className="mt-4">
          <StationPicker value={station} onChange={setStation} disabled={loading} />
        </div>
        <button
          type="button"
          className="btn btn-primary mt-4"
          disabled={loading || !station.trim()}
          onClick={() => void loadHistory()}
        >
          {loading ? "불러오는 중…" : "히스토리 조회"}
        </button>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      </section>

      {searchedStation && !loading && (
        <section className="card mt-4 p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-lg font-bold">
              「{searchedStation}」 방문 기록
            </h2>
            <p className="muted text-sm">
              전체 {reports.length}건
              {recordQuery.trim()
                ? ` · 표시 ${visibleReports.length}건`
                : ""}{" "}
              · 각 카드{" "}
              <strong className="text-slate-600">보고서 보기</strong>
            </p>
          </div>

          {reports.length === 0 ? (
            <p className="muted mt-4 text-sm">
              이 역사명으로 저장된 일일 기록이 없습니다. 일일 기록에서 역사명을
              확인해 보세요.
            </p>
          ) : (
            <>
              <div className="mt-4">
                <label className="label text-sm text-slate-700">
                  방문 기록 검색 (이름·날짜·공종·본문)
                </label>
                <input
                  type="search"
                  className="input mt-1"
                  placeholder="예: 노희찬, 2025-05, 콘크리트, 타일…"
                  value={recordQuery}
                  disabled={loading}
                  autoComplete="off"
                  onChange={(e) => setRecordQuery(e.target.value)}
                />
                {recordQuery.trim() ? (
                  <p className="muted mt-1 text-xs">
                    검색 중에는 &quot;며칠 간격&quot; 표시를 숨깁니다 (목록이
                    건너뛰어지면 간격이 어긋날 수 있음).
                  </p>
                ) : null}
              </div>

              {visibleReports.length === 0 ? (
                <p className="muted mt-4 text-sm">
                  검색어와 일치하는 기록이 없습니다. 검색어를 바꿔 보세요.
                </p>
              ) : (
                <ol className="mt-4 list-none space-y-0 p-0">
                  {visibleReports.map((r, i) => {
                const name = memberNameById.get(r.memberId) ?? r.memberId;
                const newer = i > 0 ? visibleReports[i - 1] : null;
                const gapDays =
                  showVisitGaps && newer != null
                    ? calendarDaysBetween(r.date, newer.date)
                    : null;
                const beforeSrc = r.hasBeforePhoto
                  ? `${photoApiUrl(r.memberId, r.date, "before")}${r.beforePhotoAt ? `&t=${encodeURIComponent(r.beforePhotoAt)}` : ""}`
                  : null;
                const afterSrc = r.hasAfterPhoto
                  ? `${photoApiUrl(r.memberId, r.date, "after")}${r.afterPhotoAt ? `&t=${encodeURIComponent(r.afterPhotoAt)}` : ""}`
                  : null;

                return (
                  <li key={r.id}>
                    {showVisitGaps && gapDays != null && gapDays > 0 ? (
                      <div className="my-3 border-t border-dashed border-slate-300 pt-3 text-center text-xs text-slate-500">
                        다음 방문({newer!.date})까지{" "}
                        <strong className="text-slate-700">{gapDays}일</strong>{" "}
                        간격
                      </div>
                    ) : null}
                    <article className="rounded-xl border border-slate-200 bg-slate-50/80 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="text-base font-bold text-slate-900">
                            {r.date}{" "}
                            <span className="font-normal text-slate-500">
                              ({relativeCalendarDayLabel(r.date)})
                            </span>
                          </p>
                          <p className="mt-1 text-sm text-blue-900">
                            <strong>{name}</strong>
                            {r.processingRole ? (
                              <>
                                {" "}
                                · 공종{" "}
                                <span className="font-semibold">
                                  {r.processingRole}
                                </span>
                              </>
                            ) : null}
                          </p>
                          <p className="muted mt-1 text-xs">
                            작업 시간: {formatWorkDuration(r.workMinutes)}
                          </p>
                        </div>
                        <button
                          type="button"
                          className="btn btn-secondary shrink-0 text-sm"
                          onClick={() =>
                            setReportView({ memberName: name, report: r })
                          }
                        >
                          보고서 보기
                        </button>
                      </div>

                      {(beforeSrc || afterSrc) && (
                        <div className="manager-photo-row mt-3">
                          {beforeSrc ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={beforeSrc} alt="작업 전" title="작업 전" />
                          ) : null}
                          {afterSrc ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={afterSrc} alt="작업 후" title="작업 후" />
                          ) : null}
                        </div>
                      )}

                      <div className="mt-3 text-sm">
                        <p className="font-semibold text-slate-800">금일 수행</p>
                        <p className="mt-1 line-clamp-4 whitespace-pre-wrap text-slate-700">
                          {r.done?.trim() || "—"}
                        </p>
                      </div>
                      <div className="mt-2 text-sm">
                        <p className="font-semibold text-slate-800">익일 계획</p>
                        <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-slate-700">
                          {r.plan?.trim() || "—"}
                        </p>
                      </div>
                      {r.issues?.trim() ? (
                        <p className="mt-2 line-clamp-2 whitespace-pre-wrap text-sm text-amber-900">
                          <span className="font-semibold">이슈:</span> {r.issues}
                        </p>
                      ) : null}
                      {r.deficiencies?.trim() ? (
                        <p className="mt-2 line-clamp-2 whitespace-pre-wrap text-sm text-red-900">
                          <span className="font-semibold">미비:</span>{" "}
                          {r.deficiencies}
                        </p>
                      ) : null}
                    </article>
                  </li>
                );
                  })}
                </ol>
              )}
            </>
          )}
        </section>
      )}

      {reportView && (
        <ManagerReportModal
          open
          teamName={teamName}
          memberName={reportView.memberName}
          report={reportView.report}
          onClose={() => setReportView(null)}
        />
      )}
    </>
  );
}
