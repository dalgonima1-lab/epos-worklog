"use client";

import Link from "next/link";

export default function AnalysisError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="card mx-auto max-w-lg space-y-4 p-6">
      <h2 className="text-lg font-semibold text-red-700">주간 분석 화면 오류</h2>
      <p className="text-sm text-slate-700">
        보고서를 표시하는 중 문제가 발생했습니다. 새로고침하거나 아래 버튼으로
        다시 시도해 주세요.
      </p>
      {error.message ? (
        <p className="rounded-lg bg-slate-50 px-3 py-2 font-mono text-xs text-slate-600">
          {error.message}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn btn-primary" onClick={() => reset()}>
          다시 시도
        </button>
        <Link href="/manager" className="btn btn-secondary">
          관리자 대시보드
        </Link>
      </div>
    </div>
  );
}
