"use client";

import { useMemo } from "react";
import {
  parseAnalysisMarkdown,
  type ParsedAnalysisReport,
} from "@/lib/parseAnalysisMarkdown";
import { StrategicChecklistPanel } from "@/components/StrategicChecklistPanel";
import { MemberActivityTable } from "@/components/MemberActivityTable";
import type { MemberTable } from "@/lib/parseAnalysisMarkdown";

interface WeeklyAnalysisReportProps {
  markdown: string;
  weekLabel?: string;
  compareWeekLabel?: string;
  source?: "gemini" | "cursor" | "file" | "auto" | "";
}

function InlineText({ text }: { text: string }) {
  const safe = String(text ?? "");
  const parts = safe.split(/(\*\*[^*]+\*\*)/g);
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
          <span className="war-bullet-body whitespace-pre-wrap text-[0.9375rem] leading-[1.65] text-slate-700">
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
  compareWeekLabel,
  source,
}: {
  report: ParsedAnalysisReport;
  weekLabel?: string;
  compareWeekLabel?: string;
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
      {period || weekLabel ? (
        <p className="war-report-period">
          <span className="war-report-period-label">분석 대상</span>
          <span className="war-report-period-value">{period ?? weekLabel}</span>
        </p>
      ) : null}
      {compareWeekLabel ? (
        <p className="war-report-period war-report-period--compare">
          <span className="war-report-period-label">비교 기준</span>
          <span className="war-report-period-value">{compareWeekLabel}</span>
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
          {source === "auto"
            ? "토요일 자동 분석"
            : source === "cursor"
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
  table,
  tableCaption,
}: {
  variant: "positive" | "negative";
  title: string;
  items: string[];
  table?: MemberTable;
  tableCaption?: string;
}) {
  const isPos = variant === "positive";
  let introItems: string[] = [];
  let summaryBullets: string[] = items;

  if (table) {
    if (isPos) {
      introItems = items.length > 0 ? [items[0]] : [];
      summaryBullets = items.length > 1 ? items.slice(1) : [];
    } else {
      introItems = items.filter((i) => /미제출|등록/.test(i));
      summaryBullets = items.filter((i) => !/미제출|등록/.test(i));
    }
  }

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
      {introItems.length > 0 ? (
        <div className="war-member-intro mb-3">
          {introItems.map((item, i) => (
            <p key={i} className="war-prose whitespace-pre-wrap text-sm">
              <InlineText text={item} />
            </p>
          ))}
        </div>
      ) : null}
      {table ? <MemberActivityTable table={table} caption={tableCaption} /> : null}
      {summaryBullets.length > 0 ? (
        <div className={table ? "mt-3" : ""}>
          {table ? (
            <p className="war-member-table-caption mb-2">
              {isPos ? "핵심 성과 요약" : "조치·리스크 요약"}
            </p>
          ) : null}
          <BulletList items={summaryBullets} />
        </div>
      ) : !table ? (
        <BulletList items={items} />
      ) : null}
    </div>
  );
}

export function WeeklyAnalysisReport({
  markdown,
  weekLabel,
  compareWeekLabel,
  source,
}: WeeklyAnalysisReportProps) {
  const report = useMemo(
    () => parseAnalysisMarkdown(String(markdown ?? "")),
    [markdown]
  );

  return (
    <article className="weekly-analysis-report w-full min-w-0">
      <ReportHeader
        report={report}
        weekLabel={weekLabel}
        compareWeekLabel={compareWeekLabel}
        source={source}
      />

      <div className="war-sections">
        {report.sections.map((section, idx) => {
          if (section.kind === "summary") {
            return (
              <SectionCard key={idx} title={section.title} icon="📋" accent="indigo">
                <div className="space-y-4">
                  {section.paragraphs.map((p, i) => (
                    <p key={i} className="war-prose whitespace-pre-wrap">
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
                          <p className="war-summary-member-text whitespace-pre-wrap">
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
                          table={m.positiveTable}
                          tableCaption="주간 활동 요약"
                        />
                        <MemberEvalBlock
                          variant="negative"
                          title="보완이 필요한 부분"
                          items={m.negatives}
                          table={m.negativeTable}
                          tableCaption="미비·이슈 요약"
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
                <StrategicChecklistPanel rows={section.rows} />
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
                      <span className="war-numbered-text whitespace-pre-wrap">
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
                  <p key={i} className="war-prose whitespace-pre-wrap">
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
