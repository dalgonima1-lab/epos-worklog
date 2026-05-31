"use client";

import { useEffect, useState } from "react";
import { formatDirectiveTimestamp } from "@/lib/managerDirective";
import type { ManagerDirective } from "@/lib/types";

const AUTHORS = ["팀장", "대표님"] as const;

interface ManagerDirectivePanelProps {
  pin: string;
  weekStart: string;
  weekEnd: string;
  weekCaption: string;
  directive: ManagerDirective | null;
  onSaved: (directive: ManagerDirective) => void;
}

export function ManagerDirectivePanel({
  pin,
  weekStart,
  weekEnd,
  weekCaption,
  directive,
  onSaved,
}: ManagerDirectivePanelProps) {
  const [author, setAuthor] = useState<string>(AUTHORS[0]);
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [savedFlash, setSavedFlash] = useState(false);

  useEffect(() => {
    if (directive) {
      setAuthor(directive.author);
      setText(directive.text);
    } else {
      setAuthor(AUTHORS[0]);
      setText("");
    }
  }, [directive, weekStart, weekEnd]);

  async function saveDirective() {
    const trimmed = text.trim();
    if (!trimmed) {
      setError("첨언·지시 내용을 입력해 주세요.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/analysis/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pin,
          start: weekStart,
          end: weekEnd,
          author,
          text: trimmed,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        managerDirective?: ManagerDirective;
        error?: string;
      };
      if (!res.ok) {
        setError(data.error ?? "저장 실패");
        return;
      }
      const saved = data.managerDirective!;
      onSaved(saved);
      setSavedFlash(true);
      window.setTimeout(() => setSavedFlash(false), 3000);
    } catch {
      setError("네트워크 오류입니다.");
    } finally {
      setSaving(false);
    }
  }

  const hasSaved = Boolean(directive?.text?.trim());

  return (
    <section className="card space-y-4 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold">팀장, 대표님 첨언 및 지시사항</h3>
          <p className="muted mt-1 text-xs">
            {weekCaption} 보고서(1~4장)를 확인한 뒤 팀장·대표님이 직접 작성합니다.
            저장하면 보고서 5번 섹션·인쇄/PDF·다운로드에 반영됩니다.
          </p>
        </div>
        {hasSaved ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
            <span aria-hidden>●</span> 업데이트됨
          </span>
        ) : null}
      </div>

      {hasSaved ? (
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
          <span className="font-medium">{directive!.author}</span>
          <span className="muted"> · </span>
          <span>{formatDirectiveTimestamp(directive!.updatedAt)}</span>
          <span className="muted"> 에 저장</span>
        </div>
      ) : null}

      <div>
        <label className="label" htmlFor="directive-author">
          작성자
        </label>
        <select
          id="directive-author"
          className="input max-w-xs"
          value={author}
          onChange={(e) => setAuthor(e.target.value)}
        >
          {AUTHORS.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="label" htmlFor="directive-text">
          첨언 및 지시사항
        </label>
        <textarea
          id="directive-text"
          className="textarea min-h-[140px]"
          placeholder="예: 봉천역 DB 이슈 재발 방지를 위해 며칠 내 매뉴얼화…"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {savedFlash ? (
        <p className="text-sm font-medium text-emerald-700">
          ✓ 첨언·지시사항을 저장했습니다. 보고서에 반영되었습니다.
        </p>
      ) : null}

      <button
        type="button"
        className="btn btn-primary"
        onClick={() => void saveDirective()}
        disabled={saving || !text.trim()}
      >
        {saving ? "저장 중…" : hasSaved ? "첨언·지시 수정 저장" : "첨언·지시 저장"}
      </button>
    </section>
  );
}
