"use client";

import type { WeeklySummary } from "@/lib/summary";
import type { DailyReport } from "@/lib/types";
import { photoApiUrl } from "@/lib/photoUrl";
import { formatStationVisitLabel } from "@/lib/stationFacility";
import { formatDateTime, formatWorkDuration } from "@/lib/workTime";

interface WeeklySummaryReportProps {
  summary: WeeklySummary;
  /** 일별 카드 클릭 시 상세 보고서 모달 등 */
  onDayClick?: (memberName: string, report: DailyReport) => void;
}

function photoSrc(
  memberId: string,
  date: string,
  slot: "before" | "after",
  at?: string
): string {
  const base = photoApiUrl(memberId, date, slot);
  return at ? `${base}&t=${encodeURIComponent(at)}` : base;
}

export function WeeklySummaryReport({
  summary,
  onDayClick,
}: WeeklySummaryReportProps) {
  const generated = new Date(summary.generatedAt).toLocaleString("ko-KR");

  return (
    <div className="weekly-summary-report text-slate-900">
      <header className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-600 via-indigo-700 to-slate-900 px-5 py-8 text-white shadow-lg sm:px-8">
        <div className="pointer-events-none absolute -right-8 -top-8 h-40 w-40 rounded-full bg-white/10" />
        <div className="pointer-events-none absolute -bottom-12 left-1/3 h-32 w-32 rounded-full bg-indigo-400/25" />
        <p className="relative text-xs font-semibold uppercase tracking-widest text-indigo-200">
          Weekly summary
        </p>
        <h2 className="relative mt-2 text-2xl font-bold leading-tight tracking-tight sm:text-3xl">
          {summary.teamName}
        </h2>
        <p className="relative mt-3 text-sm text-indigo-100/95">
          기간 <span className="font-semibold text-white">{summary.weekLabel}</span>
        </p>
        <p className="relative mt-1 text-xs text-indigo-200/90">
          생성 {generated} · 근무일 {summary.expectedDays}일 기준
        </p>
      </header>

      <div className="mt-8 space-y-8">
        {summary.members.map((m) => {
          const rate = Math.round(
            (m.submittedDays / Math.max(1, m.expectedDays)) * 100
          );
          const badgeClass =
            rate >= 100
              ? "bg-emerald-100 text-emerald-900 ring-emerald-200"
              : rate >= 60
                ? "bg-amber-100 text-amber-950 ring-amber-200"
                : "bg-red-100 text-red-900 ring-red-200";

          return (
            <section
              key={m.member.id}
              className="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-sm ring-1 ring-slate-100"
            >
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/90 px-4 py-3 sm:px-5">
                <h3 className="text-lg font-bold text-slate-900">
                  {m.member.name}
                </h3>
                <span
                  className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold ring-1 ring-inset ${badgeClass}`}
                >
                  제출 {m.submittedDays}/{m.expectedDays}일 · {rate}%
                </span>
              </div>
              <div className="px-4 py-3 sm:px-5">
                {m.timeOffDates.length > 0 ? (
                  <p className="mb-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                    <span className="font-semibold">휴무:</span>{" "}
                    {m.timeOffDates.join(", ")}
                  </p>
                ) : null}
                {m.missingDates.length > 0 ? (
                  <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
                    <span className="font-semibold">미제출일:</span>{" "}
                    {m.missingDates.join(", ")}
                  </p>
                ) : (
                  <p className="text-sm font-medium text-emerald-800">
                    이번 주 근무일 모두 제출되었습니다.
                  </p>
                )}
              </div>

              <div className="space-y-3 border-t border-slate-100 bg-slate-50/40 px-3 py-4 sm:px-4">
                {m.reports.length === 0 ? (
                  <p className="muted px-2 py-4 text-center text-sm">
                    이 주에 등록된 일일 기록이 없습니다.
                  </p>
                ) : (
                  m.reports.map((r) => {
                    const beforeSrc = r.hasBeforePhoto
                      ? photoSrc(
                          r.memberId,
                          r.date,
                          "before",
                          r.beforePhotoAt
                        )
                      : null;
                    const afterSrc = r.hasAfterPhoto
                      ? photoSrc(r.memberId, r.date, "after", r.afterPhotoAt)
                      : null;

                    const body = (
                      <>
                        <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-100 pb-3">
                          <div>
                            <p className="text-base font-bold text-slate-900">
                              {r.date}
                            </p>
                            {r.stationName ? (
                              <p className="mt-0.5 text-sm font-medium text-blue-800">
                                {formatStationVisitLabel(
                                  r.stationName,
                                  r.facilityArea
                                )}
                              </p>
                            ) : null}
                            {r.processingRole ? (
                              <p className="muted mt-1 text-xs">
                                공종{" "}
                                <strong className="text-slate-700">
                                  {r.processingRole}
                                </strong>
                                {r.workMinutes != null ? (
                                  <>
                                    {" "}
                                    · 작업{" "}
                                    <strong>
                                      {formatWorkDuration(r.workMinutes)}
                                    </strong>
                                  </>
                                ) : null}
                              </p>
                            ) : null}
                            {(r.beforePhotoAt || r.afterPhotoAt) && (
                              <p className="muted mt-1 text-[11px] leading-relaxed">
                                사진 시각: 전{" "}
                                {formatDateTime(r.beforePhotoAt)} · 후{" "}
                                {formatDateTime(r.afterPhotoAt)}
                              </p>
                            )}
                          </div>
                          {onDayClick ? (
                            <span className="shrink-0 text-xs font-semibold text-blue-600">
                              상세 보고서 →
                            </span>
                          ) : null}
                        </div>

                        {(beforeSrc || afterSrc) && (
                          <div className="manager-photo-row mt-3">
                            {beforeSrc ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={beforeSrc}
                                alt="작업 전"
                                className="h-20 w-20 rounded-lg border border-slate-200 object-cover"
                              />
                            ) : null}
                            {afterSrc ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={afterSrc}
                                alt="작업 후"
                                className="h-20 w-20 rounded-lg border border-slate-200 object-cover"
                              />
                            ) : null}
                          </div>
                        )}

                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                          <div className="rounded-lg bg-slate-50 p-3 ring-1 ring-slate-100">
                            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                              금일 수행
                            </p>
                            <p className="mt-1 max-h-40 overflow-y-auto whitespace-pre-wrap text-sm leading-relaxed text-slate-800">
                              {r.done?.trim() || "—"}
                            </p>
                          </div>
                          <div className="rounded-lg bg-slate-50 p-3 ring-1 ring-slate-100">
                            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                              익일 계획
                            </p>
                            <p className="mt-1 max-h-40 overflow-y-auto whitespace-pre-wrap text-sm leading-relaxed text-slate-800">
                              {r.plan?.trim() || "—"}
                            </p>
                          </div>
                        </div>

                        {r.issues?.trim() ? (
                          <div className="mt-3 rounded-lg border border-amber-200/80 bg-amber-50/90 p-3">
                            <p className="text-xs font-bold text-amber-900">
                              이슈 / 지원
                            </p>
                            <p className="mt-1 whitespace-pre-wrap text-sm text-amber-950">
                              {r.issues}
                            </p>
                          </div>
                        ) : null}
                        {r.deficiencies?.trim() ? (
                          <div className="mt-2 rounded-lg border border-red-200/80 bg-red-50/90 p-3">
                            <p className="text-xs font-bold text-red-900">
                              미비사항
                            </p>
                            <p className="mt-1 whitespace-pre-wrap text-sm text-red-950">
                              {r.deficiencies}
                            </p>
                          </div>
                        ) : null}
                      </>
                    );

                    if (onDayClick) {
                      return (
                        <button
                          key={r.id}
                          type="button"
                          className="w-full rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-blue-300 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-400"
                          onClick={() => onDayClick(m.member.name, r)}
                        >
                          {body}
                        </button>
                      );
                    }

                    return (
                      <div
                        key={r.id}
                        className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
                      >
                        {body}
                      </div>
                    );
                  })
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
