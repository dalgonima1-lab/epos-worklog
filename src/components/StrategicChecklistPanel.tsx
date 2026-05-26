"use client";

import type { ChecklistRow } from "@/lib/parseAnalysisMarkdown";
import { summarizeChecklist } from "@/lib/parseAnalysisMarkdown";

function StatusPill({ row }: { row: ChecklistRow }) {
  const cls =
    row.level === "ok"
      ? "war-status-pill war-status-pill--ok"
      : row.level === "warn"
        ? "war-status-pill war-status-pill--warn"
        : row.level === "bad"
          ? "war-status-pill war-status-pill--bad"
          : "war-status-pill war-status-pill--unknown";

  return (
    <div className={cls}>
      <span className="war-status-pill-symbol" aria-hidden>
        {row.level === "ok" ? "○" : row.level === "warn" ? "△" : row.level === "bad" ? "X" : "?"}
      </span>
      <div className="war-status-pill-text">
        <span className="war-status-pill-label">{row.statusLabel}</span>
        <span className="war-status-pill-desc">{row.statusDetail}</span>
      </div>
    </div>
  );
}

function SummaryBar({ summary }: { summary: ReturnType<typeof summarizeChecklist> }) {
  const { total, ok, warn, bad, completionRate } = summary;
  const okPct = total ? Math.round((ok / total) * 100) : 0;
  const warnPct = total ? Math.round((warn / total) * 100) : 0;
  const badPct = total ? Math.round((bad / total) * 100) : 0;

  return (
    <div className="war-checklist-summary">
      <div className="war-checklist-summary-head">
        <div>
          <p className="war-checklist-summary-title">주간 이행 현황 요약</p>
          <p className="war-checklist-summary-sub">
            전략 과제 {total}건 · 종합 이행도{" "}
            <strong className="text-emerald-800">{completionRate}%</strong>
            <span className="text-slate-500"> (○ 100% + △ 50% 반영)</span>
          </p>
        </div>
      </div>

      <div className="war-checklist-stat-grid">
        <div className="war-checklist-stat war-checklist-stat--ok">
          <span className="war-checklist-stat-num">{ok}</span>
          <span className="war-checklist-stat-label">우수 ○</span>
        </div>
        <div className="war-checklist-stat war-checklist-stat--warn">
          <span className="war-checklist-stat-num">{warn}</span>
          <span className="war-checklist-stat-label">보통 △</span>
        </div>
        <div className="war-checklist-stat war-checklist-stat--bad">
          <span className="war-checklist-stat-num">{bad}</span>
          <span className="war-checklist-stat-label">미흡 X</span>
        </div>
      </div>

      <div className="war-checklist-progress" role="img" aria-label={`이행 분포: 우수 ${ok}건, 보통 ${warn}건, 미흡 ${bad}건`}>
        <div className="war-checklist-progress-track">
          {okPct > 0 ? (
            <div
              className="war-checklist-progress-seg war-checklist-progress-seg--ok"
              style={{ width: `${okPct}%` }}
            />
          ) : null}
          {warnPct > 0 ? (
            <div
              className="war-checklist-progress-seg war-checklist-progress-seg--warn"
              style={{ width: `${warnPct}%` }}
            />
          ) : null}
          {badPct > 0 ? (
            <div
              className="war-checklist-progress-seg war-checklist-progress-seg--bad"
              style={{ width: `${badPct}%` }}
            />
          ) : null}
        </div>
        <div className="war-checklist-progress-legend">
          <span>○ {okPct}%</span>
          <span>△ {warnPct}%</span>
          <span>X {badPct}%</span>
        </div>
      </div>
    </div>
  );
}

export function StrategicChecklistPanel({ rows }: { rows: ChecklistRow[] }) {
  const summary = summarizeChecklist(rows);

  return (
    <div className="war-checklist-panel">
      <SummaryBar summary={summary} />

      <div className="war-checklist-legend">
        <p className="war-checklist-legend-title">이행 등급 기준</p>
        <ul className="war-checklist-legend-list">
          <li>
            <strong className="text-emerald-700">○ 우수</strong> — 목표 달성·산출물 확인
          </li>
          <li>
            <strong className="text-amber-800">△ 보통</strong> — 진행 중·일부 미완·리스크 잔존
          </li>
          <li>
            <strong className="text-red-700">X 미흡</strong> — 지연·미착수·팀장 개입 필요
          </li>
        </ul>
      </div>

      <div className="war-checklist-detail-cards md:hidden">
        {rows.map((row) => (
          <article
            key={row.index}
            className={`war-checklist-detail-card war-checklist-detail-card--${row.level}`}
          >
            <div className="war-checklist-detail-card-head">
              <span className="war-checklist-detail-no">{row.index}</span>
              <h4 className="war-checklist-detail-task">{row.task}</h4>
            </div>
            <StatusPill row={row} />
            <dl className="war-checklist-detail-dl">
              <div>
                <dt>현황·근거</dt>
                <dd>{row.note || "—"}</dd>
              </div>
              <div>
                <dt>차주 조치·권고</dt>
                <dd>{row.actionHint}</dd>
              </div>
            </dl>
          </article>
        ))}
      </div>

      <div className="war-checklist-detail-table-wrap hidden md:block">
        <table className="war-checklist-detail-table">
          <thead>
            <tr>
              <th className="w-12 text-center">No</th>
              <th className="min-w-[12rem]">전략 과제</th>
              <th className="w-[11rem]">이행 등급</th>
              <th>현황·근거 (일일 기록 기반)</th>
              <th className="min-w-[10rem]">차주 조치·권고</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.index}
                className={`war-checklist-detail-row war-checklist-detail-row--${row.level}`}
              >
                <td className="text-center font-bold text-slate-500">{row.index}</td>
                <td className="font-semibold text-slate-900">{row.task}</td>
                <td>
                  <StatusPill row={row} />
                </td>
                <td className="text-slate-700">{row.note || "—"}</td>
                <td className="text-sm text-slate-600">{row.actionHint}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
