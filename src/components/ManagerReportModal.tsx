"use client";

import { useEffect } from "react";
import type { DailyReport } from "@/lib/types";
import { photoApiUrl } from "@/lib/photoUrl";
import { formatDateTime, formatWorkDuration } from "@/lib/workTime";

function photoSrc(
  memberId: string,
  date: string,
  slot: "before" | "after",
  recordedAt?: string
): string {
  const base = photoApiUrl(memberId, date, slot);
  return recordedAt
    ? `${base}&t=${encodeURIComponent(recordedAt)}`
    : base;
}

export interface ManagerReportModalProps {
  open: boolean;
  onClose: () => void;
  teamName: string;
  memberName: string;
  report: DailyReport;
}

export function ManagerReportModal({
  open,
  onClose,
  teamName,
  memberName,
  report,
}: ManagerReportModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  const beforeSrc = report.hasBeforePhoto
    ? photoSrc(report.memberId, report.date, "before", report.beforePhotoAt)
    : null;
  const afterSrc = report.hasAfterPhoto
    ? photoSrc(report.memberId, report.date, "after", report.afterPhotoAt)
    : null;

  return (
    <div
      className="manager-report-modal-backdrop fixed inset-0 z-50 flex items-end justify-center bg-slate-900/55 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="manager-report-title"
    >
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="보고서 닫기"
        onClick={onClose}
      />
      <div
        className="manager-report-sheet relative z-10 flex max-h-[92vh] w-full max-w-3xl flex-col rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="no-print flex shrink-0 items-center justify-between gap-2 border-b border-slate-200 px-4 py-3">
          <p className="text-sm font-semibold text-slate-700">일일 업무 보고서</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn btn-secondary text-sm"
              title="인쇄 대화상자에서 PDF로 저장을 선택할 수 있습니다."
              onClick={() => window.print()}
            >
              인쇄 / PDF
            </button>
            <button type="button" className="btn btn-primary text-sm" onClick={onClose}>
              닫기
            </button>
          </div>
        </div>

        <div
          id="manager-report-print"
          className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-8 sm:py-6"
        >
          <header className="border-b-2 border-slate-800 pb-4 text-center">
            <h2
              id="manager-report-title"
              className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl"
            >
              일일 업무 보고서
            </h2>
            <p className="muted mt-2 text-sm">{teamName}</p>
          </header>

          <dl className="mt-6 grid gap-3 text-sm sm:grid-cols-2">
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
              <dt className="muted text-xs font-medium uppercase tracking-wide">
                작성자
              </dt>
              <dd className="mt-0.5 font-semibold text-slate-900">{memberName}</dd>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
              <dt className="muted text-xs font-medium uppercase tracking-wide">
                보고 일자
              </dt>
              <dd className="mt-0.5 font-semibold text-slate-900">{report.date}</dd>
            </div>
            {report.stationName ? (
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <dt className="muted text-xs font-medium uppercase tracking-wide">
                  역사
                </dt>
                <dd className="mt-0.5 font-semibold text-slate-900">
                  {report.stationName}
                </dd>
              </div>
            ) : null}
            {report.processingRole ? (
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <dt className="muted text-xs font-medium uppercase tracking-wide">
                  공종
                </dt>
                <dd className="mt-0.5 font-semibold text-slate-900">
                  {report.processingRole}
                </dd>
              </div>
            ) : null}
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 sm:col-span-2">
              <dt className="muted text-xs font-medium uppercase tracking-wide">
                작업 시간 (전·후 사진 시각 기준)
              </dt>
              <dd className="mt-0.5 font-semibold text-slate-900">
                {formatWorkDuration(report.workMinutes)}
                <span className="muted ml-2 font-normal">
                  (전 {formatDateTime(report.beforePhotoAt)} · 후{" "}
                  {formatDateTime(report.afterPhotoAt)})
                </span>
              </dd>
            </div>
          </dl>

          {(beforeSrc || afterSrc) && (
            <section className="mt-8">
              <h3 className="border-b border-slate-300 pb-2 text-base font-bold text-slate-800">
                작업 전·후 사진
              </h3>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                {beforeSrc ? (
                  <figure className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                    <figcaption className="border-b border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700">
                      작업 전 · {formatDateTime(report.beforePhotoAt)}
                    </figcaption>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={beforeSrc}
                      alt="작업 전 현장 사진"
                      className="max-h-72 w-full object-contain"
                    />
                  </figure>
                ) : (
                  <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500">
                    작업 전 사진 없음
                  </div>
                )}
                {afterSrc ? (
                  <figure className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                    <figcaption className="border-b border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700">
                      작업 후 · {formatDateTime(report.afterPhotoAt)}
                    </figcaption>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={afterSrc}
                      alt="작업 후 현장 사진"
                      className="max-h-72 w-full object-contain"
                    />
                  </figure>
                ) : (
                  <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500">
                    작업 후 사진 없음
                  </div>
                )}
              </div>
            </section>
          )}

          <section className="mt-8">
            <h3 className="border-b border-slate-300 pb-2 text-base font-bold text-slate-800">
              금일 수행
            </h3>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-slate-800">
              {report.done?.trim() ? report.done : "—"}
            </p>
          </section>

          <section className="mt-6">
            <h3 className="border-b border-slate-300 pb-2 text-base font-bold text-slate-800">
              익일 계획
            </h3>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-slate-800">
              {report.plan?.trim() ? report.plan : "—"}
            </p>
          </section>

          {report.issues?.trim() ? (
            <section className="mt-6">
              <h3 className="border-b border-amber-200 pb-2 text-base font-bold text-amber-900">
                이슈 / 지원 요청
              </h3>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-amber-950">
                {report.issues}
              </p>
            </section>
          ) : null}

          {report.deficiencies?.trim() ? (
            <section className="mt-6">
              <h3 className="border-b border-red-200 pb-2 text-base font-bold text-red-900">
                미비사항
              </h3>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-red-950">
                {report.deficiencies}
              </p>
            </section>
          ) : null}

          <footer className="muted mt-8 border-t border-slate-200 pt-4 text-center text-xs">
            최종 수정: {formatDateTime(report.updatedAt)}
          </footer>
        </div>
      </div>
    </div>
  );
}
