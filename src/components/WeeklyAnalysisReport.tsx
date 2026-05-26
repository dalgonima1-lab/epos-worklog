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
    <>
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
    </>
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
      className={`inline-flex min-w-[2rem] justify-center rounded-full px-2.5 py-0.5 text-xs font-bold ring-1 ring-inset ${cls}`}
    >
      {s || "—"}
    </span>
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
    <header className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-violet-700 via-indigo-700 to-slate-900 px-6 py-9 text-white shadow-xl sm:px-10 print:rounded-lg print:py-6">
      <div className="pointer-events-none absolute -right-10 -top-10 h-48 w-48 rounded-full bg-white/10" />
      <div className="pointer-events-none absolute bottom-0 left-0 h-32 w-full bg-gradient-to-t from-black/20 to-transparent" />
      <p className="relative text-xs font-semibold uppercase tracking-[0.2em] text-violet-200">
        Executive Report
      </p>
      <h1 className="relative mt-2 text-2xl font-bold leading-snug tracking-tight sm:text-3xl">
        {report.title}
      </h1>
      {period ? (
        <p className="relative mt-4 text-base text-violet-100">
          분석 기간{" "}
          <span className="font-semibold text-white">{period}</span>
        </p>
      ) : null}
      <dl className="relative mt-5 grid gap-2 text-sm text-indigo-100/95 sm:grid-cols-2">
        {dateLine ? (
          <div>
            <dt className="text-xs uppercase tracking-wide text-violet-300">
              일시
            </dt>
            <dd className="mt-0.5 font-medium text-white">{dateLine}</dd>
          </div>
        ) : null}
        {fromLine ? (
          <div>
            <dt className="text-xs uppercase tracking-wide text-violet-300">
              발신
            </dt>
            <dd className="mt-0.5">
              <InlineText text={fromLine} />
            </dd>
          </div>
        ) : null}
        {refLine ? (
          <div className="sm:col-span-2">
            <dt className="text-xs uppercase tracking-wide text-violet-300">
              참조
            </dt>
            <dd className="mt-0.5">{refLine}</dd>
          </div>
        ) : null}
      </dl>
      {source ? (
        <p className="relative mt-4 inline-flex rounded-full bg-white/15 px-3 py-1 text-xs font-medium backdrop-blur-sm">
          {source === "cursor"
            ? "Cursor 분석"
            : source === "gemini"
              ? "Gemini AI 생성"
              : "저장된 보고서"}
        </p>
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
  const bar =
    accent === "emerald"
      ? "from-emerald-500 to-teal-600"
      : accent === "amber"
        ? "from-amber-500 to-orange-600"
        : accent === "slate"
          ? "from-slate-500 to-slate-700"
          : "from-indigo-500 to-violet-600";

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-sm ring-1 ring-slate-100 print:break-inside-avoid">
      <div
        className={`flex items-center gap-2 border-b border-slate-100 bg-gradient-to-r ${bar} px-5 py-3.5 text-white`}
      >
        {icon ? <span className="text-lg" aria-hidden>{icon}</span> : null}
        <h2 className="text-base font-bold tracking-tight sm:text-lg">
          {title}
        </h2>
      </div>
      <div className="px-5 py-5 sm:px-6">{children}</div>
    </section>
  );
}

export function WeeklyAnalysisReport({
  markdown,
  weekLabel,
  source,
}: WeeklyAnalysisReportProps) {
  const report = useMemo(() => parseAnalysisMarkdown(markdown), [markdown]);

  return (
    <article className="weekly-analysis-report mx-auto max-w-4xl text-slate-800">
      <ReportHeader report={report} weekLabel={weekLabel} source={source} />

      <div className="mt-8 space-y-6 print:mt-6 print:space-y-4">
        {report.sections.map((section, idx) => {
          if (section.kind === "summary") {
            return (
              <SectionCard
                key={idx}
                title={section.title}
                icon="📋"
                accent="indigo"
              >
                <div className="space-y-4 text-[0.95rem] leading-relaxed text-slate-700">
                  {section.paragraphs.map((p, i) => (
                    <p key={i}>
                      <InlineText text={p} />
                    </p>
                  ))}
                  {section.memberBullets.length > 0 ? (
                    <ul className="space-y-2 rounded-lg border border-slate-100 bg-slate-50/80 p-4">
                      {section.memberBullets.map((b, i) => (
                        <li key={i} className="flex gap-2 text-sm">
                          {b.name ? (
                            <span className="shrink-0 font-bold text-indigo-800">
                              {b.name}
                            </span>
                          ) : null}
                          <span>
                            <InlineText text={b.text} />
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              </SectionCard>
            );
          }

          if (section.kind === "members") {
            return (
              <div key={idx} className="space-y-4">
                <h2 className="px-1 text-lg font-bold text-slate-900">
                  {section.title}
                </h2>
                {section.members.map((m) => (
                  <section
                    key={m.name}
                    className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm print:break-inside-avoid"
                  >
                    <div className="border-b border-slate-100 bg-slate-50 px-5 py-3">
                      <h3 className="text-lg font-bold text-slate-900">
                        {m.name}
                      </h3>
                    </div>
                    <div className="grid gap-0 md:grid-cols-2">
                      <div className="border-b border-slate-100 p-5 md:border-b-0 md:border-r">
                        <p className="mb-3 flex items-center gap-2 text-sm font-bold text-emerald-800">
                          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100 text-base">
                            👍
                          </span>
                          잘한 부분
                        </p>
                        <ul className="space-y-2 text-sm leading-relaxed text-slate-700">
                          {m.positives.map((item, i) => (
                            <li key={i} className="flex gap-2">
                              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                              <InlineText text={item} />
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div className="p-5">
                        <p className="mb-3 flex items-center gap-2 text-sm font-bold text-amber-900">
                          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-100 text-base">
                            👎
                          </span>
                          보완이 필요한 부분
                        </p>
                        <ul className="space-y-2 text-sm leading-relaxed text-slate-700">
                          {m.negatives.map((item, i) => (
                            <li key={i} className="flex gap-2">
                              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                              <InlineText text={item} />
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </section>
                ))}
              </div>
            );
          }

          if (section.kind === "checklist") {
            return (
              <SectionCard
                key={idx}
                title={section.title}
                icon="✓"
                accent="emerald"
              >
                <div className="overflow-x-auto rounded-lg border border-slate-200">
                  <table className="w-full min-w-[320px] border-collapse text-sm">
                    <thead>
                      <tr className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                        <th className="px-4 py-3">전략 과제</th>
                        <th className="px-4 py-3 w-24 text-center">상태</th>
                        <th className="px-4 py-3">근거</th>
                      </tr>
                    </thead>
                    <tbody>
                      {section.rows.map((row, i) => (
                        <tr
                          key={i}
                          className="border-t border-slate-100 even:bg-slate-50/50"
                        >
                          <td className="px-4 py-3 font-medium text-slate-900">
                            {row.task}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <StatusBadge status={row.status} />
                          </td>
                          <td className="px-4 py-3 text-slate-600">
                            {row.note}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </SectionCard>
            );
          }

          if (section.kind === "numbered") {
            return (
              <SectionCard
                key={idx}
                title={section.title}
                icon="💡"
                accent="amber"
              >
                <ol className="space-y-3">
                  {section.items.map((item, i) => (
                    <li
                      key={i}
                      className="flex gap-3 rounded-lg border border-amber-100 bg-amber-50/60 px-4 py-3 text-sm leading-relaxed text-slate-800"
                    >
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-200 text-xs font-bold text-amber-950">
                        {i + 1}
                      </span>
                      <span className="pt-0.5">
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
              <SectionCard
                key={idx}
                title={section.title}
                icon="📝"
                accent="slate"
              >
                <ul className="space-y-2 text-sm leading-relaxed text-slate-700">
                  {section.items.map((item, i) => (
                    <li key={i} className="flex gap-2 rounded-md bg-slate-50 px-3 py-2">
                      <span className="text-slate-400">•</span>
                      <InlineText text={item} />
                    </li>
                  ))}
                </ul>
              </SectionCard>
            );
          }

          return (
            <SectionCard key={idx} title={section.title} accent="indigo">
              <div className="space-y-3 text-sm leading-relaxed text-slate-700">
                {section.paragraphs.map((p, i) => (
                  <p key={i}>
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
