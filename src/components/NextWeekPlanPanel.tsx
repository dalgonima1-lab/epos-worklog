"use client";

import { useEffect, useState } from "react";
import type { Member, MemberWeekPlan } from "@/lib/types";

interface NextWeekPlanPanelProps {
  weekStart: string;
  weekEnd: string;
  weekLabel: string;
  members: Member[];
  /** 이번주 탭에서 차주를 편집할 때 안내 문구 */
  caption?: string;
}

export function NextWeekPlanPanel({
  weekStart,
  weekEnd,
  weekLabel,
  members,
  caption,
}: NextWeekPlanPanelProps) {
  const [plans, setPlans] = useState<Record<string, string>>({});
  const [savedAt, setSavedAt] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState("");
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoaded(false);
    fetch(`/api/week-plans?start=${weekStart}&end=${weekEnd}`)
      .then((r) => r.json())
      .then((data: { plans?: MemberWeekPlan[]; error?: string }) => {
        if (cancelled) return;
        if (data.error) {
          setError(data.error);
          return;
        }
        const textMap: Record<string, string> = {};
        const atMap: Record<string, string> = {};
        for (const p of data.plans ?? []) {
          textMap[p.memberId] = p.text;
          atMap[p.memberId] = p.updatedAt;
        }
        setPlans(textMap);
        setSavedAt(atMap);
        setError("");
      })
      .catch(() => {
        if (!cancelled) setError("차주 계획을 불러오지 못했습니다.");
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [weekStart, weekEnd]);

  async function savePlan(memberId: string) {
    setSavingId(memberId);
    setError("");
    try {
      const res = await fetch("/api/week-plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          start: weekStart,
          end: weekEnd,
          memberId,
          text: plans[memberId] ?? "",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "저장 실패");
        return;
      }
      if (data.plan?.updatedAt) {
        setSavedAt((prev) => ({
          ...prev,
          [memberId]: data.plan.updatedAt,
        }));
      }
    } catch {
      setError("저장 중 오류가 발생했습니다.");
    } finally {
      setSavingId("");
    }
  }

  return (
    <section className="card mt-4 space-y-4 p-4">
      <div>
        <h3 className="font-semibold">차주 계획 ({weekLabel})</h3>
        <p className="muted mt-1 text-xs">
          {caption ??
            "다음 주 일정과 함께 자유 메모를 남기면 AI 주간 분석 보고서 4-1절에 반영됩니다."}
        </p>
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {!loaded ? (
        <p className="muted text-sm">불러오는 중…</p>
      ) : (
        <div className="space-y-3">
          {members.map((m) => (
            <div
              key={m.id}
              className="rounded-lg border border-slate-200 bg-slate-50/60 p-3"
            >
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-semibold text-slate-800">
                  {m.name}
                </span>
                {savedAt[m.id] ? (
                  <span className="text-[11px] text-emerald-700">
                    저장됨 ·{" "}
                    {new Date(savedAt[m.id]).toLocaleString("ko-KR", {
                      month: "numeric",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                ) : null}
              </div>
              <textarea
                className="textarea min-h-[72px] text-sm"
                placeholder="예: 월·화 봉천역 DB, 수요일 A/S 현장…"
                value={plans[m.id] ?? ""}
                onChange={(e) =>
                  setPlans((prev) => ({ ...prev, [m.id]: e.target.value }))
                }
              />
              <button
                type="button"
                className="btn btn-secondary mt-2 text-xs"
                disabled={savingId === m.id}
                onClick={() => void savePlan(m.id)}
              >
                {savingId === m.id ? "저장 중…" : "차주 계획 저장"}
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
