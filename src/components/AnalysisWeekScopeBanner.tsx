"use client";

import type { AnalysisWeekScope } from "@/lib/analysisWeekScope";
import { formatScopeSummary } from "@/lib/analysisWeekScope";

interface AnalysisWeekScopeBannerProps {
  scope: AnalysisWeekScope;
}

export function AnalysisWeekScopeBanner({ scope }: AnalysisWeekScopeBannerProps) {
  const { oneLiner, targetCaption, compareCaption } = formatScopeSummary(scope);

  return (
    <div className="analysis-scope-banner" role="region" aria-label="주간 분석 범위">
      <p className="analysis-scope-oneliner">{oneLiner}</p>
      <div className="analysis-scope-grid">
        <div className="analysis-scope-card analysis-scope-card--target">
          <span className="analysis-scope-badge">분석 대상</span>
          <p className="analysis-scope-card-title">이번에 만드는 보고서</p>
          <p className="analysis-scope-card-dates">{targetCaption}</p>
          <p className="analysis-scope-card-hint">이 기간 월~금 일일 기록 → 보고서 본문</p>
        </div>
        <div className="analysis-scope-arrow" aria-hidden>
          ← 비교
        </div>
        <div className="analysis-scope-card analysis-scope-card--compare">
          <span className="analysis-scope-badge">비교 기준</span>
          <p className="analysis-scope-card-title">이전에 저장된 분석</p>
          <p className="analysis-scope-card-dates">{compareCaption}</p>
          <p className="analysis-scope-card-hint">아래 박스 내용 · 전주 대비·체크리스트 근거</p>
        </div>
      </div>
    </div>
  );
}
