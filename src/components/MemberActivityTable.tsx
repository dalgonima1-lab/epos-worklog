"use client";

import type { MemberTable } from "@/lib/parseAnalysisMarkdown";

function InlineBold({ text }: { text: string }) {
  const safe = String(text ?? "");
  const parts = safe.split(/(\*\*[^*]+\*\*)/g);
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

export function MemberActivityTable({
  table,
  caption,
}: {
  table: MemberTable;
  caption?: string;
}) {
  if (table.rows.length === 0) return null;

  return (
    <div className="war-member-table-wrap">
      {caption ? <p className="war-member-table-caption">{caption}</p> : null}
      <div className="war-member-table-scroll">
        <table className="war-member-table">
          <thead>
            <tr>
              {table.headers.map((h, i) => (
                <th key={i}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row, ri) => (
              <tr key={ri}>
                {row.map((cell, ci) => (
                  <td key={ci} className="whitespace-pre-wrap">
                    <InlineBold text={String(cell ?? "")} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
