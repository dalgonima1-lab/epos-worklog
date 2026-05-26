"use client";

import { useMemo } from "react";
import {
  parseAnalysisMarkdown,
  type ParsedAnalysisReport,
} from "@/lib/parseAnalysisMarkdown";

interface WeeklyAnalysisReportProps {
  markdown: string;
  weekLabel?: string;
  source?: "gemini" | "cursor" | "file" | "";
}

function InlineText({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <span className="war-inline break-keep [overflow-wrap:anywhere]">
      {parts.map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return (
            <strong key={i} className="font-semibold text-slate-900">
              {part.slice(2, -2)}
            </strong>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const s = status.trim();
  const ok = /○|완료|양호/i.test(s);
  const warn = /△|진행|일부/i.test(s);
  const bad = /[Xx✕]|미흡|부족/i.test(s);
  const cls = ok
    ? "bg-emerald-100 text-emerald-900 ring-emerald-200"
    : warn
      ? "bg-amber-100 text-amber-950 ring-amber-200"
      : bad
        ? "bg-red-100 text-red-900 ring-red-200"
        : "bg-slate-100 text-slate-800 ring-slate-200";

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full px-2.5 py-0.5 text-xs font-bold ring-1 ring-inset ${cls}`}
    >
      {s || "—"}
    </span>
  );
}

/** 라벨 + 본문 2열 (모바일에서도 줄 맞춤) */
function MetaGrid({ children }: { children: React.ReactNode }) {
  return <dl className="war-meta-grid">{children}</dl>;
}

function MetaItem({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="war-meta-item">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

/** 불릿: 마커 열 + 본문 열 */
function BulletList({
  items,
  marker = "dot",
}: {
  items: string[];
  marker?: "dot" | "num";
}) {
  return (
    <ul className="war-bullet-list">
      {items.map((item, i) => (
        <li key={i} className="war-bullet-row">
          <span className="war-bullet-marker" aria-hidden>
            {marker === "num" ? i + 1 : "•"}
          </span>
          <span className="war-bullet-body text-[0.9375rem] leading-[1.65] text-slate-700">
            <InlineText text={item} />
          </span>
        </li>
      ))}
    </ul>
  );
}

function ReportHeader({
  report,
  weekLabel,
  source,
}: {
  report: ParsedAnalysisReport;
  weekLabel?: string;
  source?: string;
}) {
  const period =
    report.meta.find((m) => /기간|period/i.test(m.label))?.value ?? weekLabel;
  const dateLine = report.meta.find((m) => /일시/.test(m.label))?.value;
  const fromLine = report.meta.find((m) => /발신/.test(m.label))?.value;
  const refLine = report.meta.find((m) => /참조/.test(m.label))?.value;

  return (
    <header className="war-report-header">
      <p className="war-report-eyebrow">Executive Report</p>
      <h1 className="war-report-title">{report.title}</h1>
      {period ? (
        <p className="war-report-period">
          <span className="war-report-period-label">분석 기간</span>
          <span className="war-report-period-value">{period}</span>
        </p>
      ) : null}
      <MetaGrid>
        {dateLine ? <MetaItem label="일시">{dateLine}</MetaItem> : null}
        {fromLine ? (
          <MetaItem label="발신">
            <InlineText text={fromLine} />
          </MetaItem>
        ) : null}
        {refLine ? (
          <MetaItem label="참조">
            <span className="break-keep [overflow-wrap:anywhere]">{refLine}</span>
          </MetaItem>
        ) : null}
      </MetaGrid>
      {source ? (
        <span className="war-source-badge">
          {source === "cursor"
            ? "Cursor 분석"
            : source === "gemini"
              ? "Gemini AI 생성"
              : "저장된 보고서"}
        </span>
      ) : null}
    </header>
  );
}

function SectionCard({
  children,
  title,
  icon,
  accent = "indigo",
}: {
  children: React.ReactNode;
  title: string;
  icon?: string;
  accent?: "indigo" | "emerald" | "amber" | "slate";
}) {
  return (
    <section className={`war-section war-section--${accent}`}>
      <div className="war-section-head">
        {icon ? <span className="war-section-icon" aria-hidden>{icon}</span> : null}
        <h2 className="war-section-title">{title}</h2>
      </div>
      <div className="war-section-body">{children}</div>
    </section>
  );
}

function MemberEvalBlock({
  variant,
  title,
  items,
}: {
  variant: "positive" | "negative";
  title: string;
  items: string[];
}) {
  const isPos = variant === "positive";
  return (
    <div
      className={
        isPos ? "war-member-block war-member-block--pos" : "war-member-block war-member-block--neg"
      }
    >
      <p className="war-member-block-title">
        <span className="war-member-block-emoji" aria-hidden>
          {isPos ? "👍" : "👎"}
        </span>
        {title}
      </p>
      <BulletList items={items} />
    </div>
  );
}

function ChecklistTable({
  rows,
}: {
  rows: { task: string; status: string; note: string }[];
}) {
  return (
    <>
      <div className="war-checklist-cards lg:hidden">
        {rows.map((row, i) => (
          <article key={i} className="war-checklist-card">
            <p className="war-checklist-card-task">{row.task}</p>
            <div className="war-checklist-card-meta">
              <StatusBadge status={row.status} />
              <span className="war-checklist-card-note">{row.note}</span>
            </div>
          </article>
        ))}
      </div>
      <div className="war-checklist-table-wrap hidden lg:block">
        <table className="war-checklist-table">
          <thead>
            <tr>
              <th>전략 과제</th>
              <th className="w-[5.5rem] text-center">상태</th>
              <th className="w-[38%]">근거</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i}>
                <td>{row.task}</td>
                <td className="text-center align-middle">
                  <StatusBadge status={row.status} />
                </td>
                <td className="text-slate-600">{row.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

export function WeeklyAnalysisReport({
  markdown,
  weekLabel,
  source,
}: WeeklyAnalysisReportProps) {
  const report = useMemo(() => parseAnalysisMarkdown(markdown), [markdown]);

  return (
    <article className="weekly-analysis-report w-full min-w-0">
      <ReportHeader report={report} weekLabel={weekLabel} source={source} />

      <div className="war-sections">
        {report.sections.map((section, idx) => {
          if (section.kind === "summary") {
            return (
              <SectionCard key={idx} title={section.title} icon="📋" accent="indigo">
                <div className="space-y-4">
                  {section.paragraphs.map((p, i) => (
                    <p key={i} className="war-prose">
                      <InlineText text={p} />
                    </p>
                  ))}
                  {section.memberBullets.length > 0 ? (
                    <div className="war-summary-members">
                      {section.memberBullets.map((b, i) => (
                        <div key={i} className="war-summary-member-card">
                          {b.name ? (
                            <p className="war-summary-member-name">{b.name}</p>
                          ) : null}
                          <p className="war-summary-member-text">
                            <InlineText text={b.text} />
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              </SectionCard>
            );
          }

          if (section.kind === "members") {
            return (
              <SectionCard key={idx} title={section.title} icon="👥" accent="indigo">
                <div className="war-members-stack">
                  {section.members.map((m) => (
                    <div key={m.name} className="war-member-card">
                      <h3 className="war-member-name">{m.name}</h3>
                      <div className="war-member-eval-stack">
                        <MemberEvalBlock
                          variant="positive"
                          title="잘한 부분"
                          items={m.positives}
                        />
                        <MemberEvalBlock
                          variant="negative"
                          title="보완이 필요한 부분"
                          items={m.negatives}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </SectionCard>
            );
          }

          if (section.kind === "checklist") {
            return (
              <SectionCard key={idx} title={section.title} icon="✓" accent="emerald">
                <ChecklistTable rows={section.rows} />
              </SectionCard>
            );
          }

          if (section.kind === "numbered") {
            return (
              <SectionCard key={idx} title={section.title} icon="💡" accent="amber">
                <ol className="war-numbered-list">
                  {section.items.map((item, i) => (
                    <li key={i} className="war-numbered-item">
                      <span className="war-numbered-badge">{i + 1}</span>
                      <span className="war-numbered-text">
                        <InlineText text={item} />
                      </span>
                    </li>
                  ))}
                </ol>
              </SectionCard>
            );
          }

          if (section.kind === "bullets") {
            return (
              <SectionCard key={idx} title={section.title} icon="📝" accent="slate">
                <BulletList items={section.items} />
              </SectionCard>
            );
          }

          return (
            <SectionCard key={idx} title={section.title} accent="indigo">
              <div className="space-y-3">
                {section.paragraphs.map((p, i) => (
                  <p key={i} className="war-prose">
                    <InlineText text={p} />
                  </p>
                ))}
              </div>
            </SectionCard>
          );
        })}
      </div>
    </article>
  );
}
