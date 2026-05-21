"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  formatDate,
  getWeekRange,
  shiftWeek,
  weekdayLabel,
  weekdaysBetween,
} from "@/lib/dates";
import type { DailyReport, Member, ScheduleEntry } from "@/lib/types";

type WeekTab = -1 | 0 | 1;

const WEEK_TABS: { offset: WeekTab; label: string }[] = [
  { offset: -1, label: "저번주" },
  { offset: 0, label: "이번주" },
  { offset: 1, label: "다음주" },
];

interface HomeWeekCalendarProps {
  teamName: string;
}

function reportHasContent(r: DailyReport): boolean {
  return Boolean(
    r.stationName?.trim() ||
      r.processingRole?.trim() ||
      r.done?.trim() ||
      r.plan?.trim() ||
      r.hasBeforePhoto ||
      r.hasAfterPhoto
  );
}

export function HomeWeekCalendar({ teamName }: HomeWeekCalendarProps) {
  const router = useRouter();
  const [weekTab, setWeekTab] = useState<WeekTab>(0);
  const [anchor] = useState(() => new Date());
  const [members, setMembers] = useState<Member[]>([]);
  const [schedules, setSchedules] = useState<ScheduleEntry[]>([]);
  const [reports, setReports] = useState<DailyReport[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ScheduleEntry | null>(null);
  const [formDate, setFormDate] = useState(formatDate(new Date()));
  const [formMemberId, setFormMemberId] = useState("");
  const [formTitle, setFormTitle] = useState("");
  const [formStation, setFormStation] = useState("");
  const [formNote, setFormNote] = useState("");
  const [saving, setSaving] = useState(false);

  const weekAnchor = useMemo(
    () => shiftWeek(anchor, weekTab),
    [anchor, weekTab]
  );
  const week = useMemo(() => getWeekRange(weekAnchor), [weekAnchor]);
  const days = useMemo(
    () => weekdaysBetween(week.start, week.end),
    [week.start, week.end]
  );

  const memberNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const mem of members) m.set(mem.id, mem.name);
    return m;
  }, [members]);

  const reportByKey = useMemo(() => {
    const m = new Map<string, DailyReport>();
    for (const r of reports) {
      m.set(`${r.memberId}:${r.date}`, r);
    }
    return m;
  }, [reports]);

  const loadWeek = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [schedRes, repRes] = await Promise.all([
        fetch(
          `/api/schedules?start=${encodeURIComponent(week.start)}&end=${encodeURIComponent(week.end)}`
        ),
        fetch(
          `/api/reports?start=${encodeURIComponent(week.start)}&end=${encodeURIComponent(week.end)}`
        ),
      ]);
      const schedData = await schedRes.json();
      const repData = await repRes.json();
      if (!schedRes.ok) {
        setError(schedData.error ?? "일정을 불러오지 못했습니다.");
        return;
      }
      setSchedules(schedData.schedules ?? []);
      setReports(repData.reports ?? []);
    } catch {
      setError("네트워크 오류입니다.");
    } finally {
      setLoading(false);
    }
  }, [week.start, week.end]);

  useEffect(() => {
    fetch("/api/members")
      .then((r) => r.json())
      .then((d) => {
        const list = (d.members ?? []) as Member[];
        setMembers(list);
        if (!formMemberId && list.length) {
          setFormMemberId(list[0].id);
        }
      })
      .catch(() => {});
  }, [formMemberId]);

  useEffect(() => {
    void loadWeek();
  }, [loadWeek]);

  function openAdd(date: string) {
    setEditing(null);
    setFormDate(date);
    setFormTitle("");
    setFormStation("");
    setFormNote("");
    if (!formMemberId && members.length) {
      setFormMemberId(members[0].id);
    }
    setModalOpen(true);
  }

  function openEdit(entry: ScheduleEntry) {
    setEditing(entry);
    setFormDate(entry.date);
    setFormMemberId(entry.memberId);
    setFormTitle(entry.title);
    setFormStation(entry.stationName ?? "");
    setFormNote(entry.note ?? "");
    setModalOpen(true);
  }

  function goDaily(
    date: string,
    memberId: string,
    stationName?: string
  ) {
    const q = new URLSearchParams({ date, memberId });
    if (stationName?.trim()) {
      q.set("station", stationName.trim());
    }
    router.push(`/daily?${q.toString()}`);
  }

  async function saveSchedule(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/schedules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editing?.id,
          date: formDate,
          memberId: formMemberId,
          title: formTitle,
          stationName: formStation,
          note: formNote,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "저장 실패");
        return;
      }
      setModalOpen(false);
      setError("");
      await loadWeek();
    } catch {
      setError("저장 중 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  }

  async function removeSchedule(id: string) {
    if (!confirm("이 일정을 삭제할까요?")) return;
    const res = await fetch(`/api/schedules?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    if (res.ok) await loadWeek();
  }

  return (
    <>
      <section className="card overflow-hidden p-0">
        <div className="border-b border-slate-100 bg-gradient-to-r from-indigo-50/90 to-slate-50 px-4 py-4 sm:px-5">
          <h2 className="text-lg font-bold tracking-tight text-slate-900">
            주간 일정
          </h2>
          <p className="muted mt-1 text-sm">
            {teamName} · 일정을 누르면 해당 날짜·담당자의{" "}
            <strong className="text-slate-700">일일 기록</strong>으로 이동합니다.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {WEEK_TABS.map((tab) => (
              <button
                key={tab.offset}
                type="button"
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                  weekTab === tab.offset
                    ? "bg-indigo-600 text-white shadow-md"
                    : "bg-white text-slate-600 ring-1 ring-slate-200 hover:text-indigo-600"
                }`}
                onClick={() => setWeekTab(tab.offset)}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <p className="muted mt-2 text-xs">{week.label}</p>
        </div>

        {error && (
          <p className="px-4 py-2 text-sm text-red-600 sm:px-5">{error}</p>
        )}

        {loading ? (
          <p className="muted px-4 py-8 text-center text-sm sm:px-5">
            불러오는 중…
          </p>
        ) : (
          <div className="grid gap-3 p-3 sm:grid-cols-5 sm:p-4">
            {days.map((date) => {
              const daySchedules = schedules.filter((s) => s.date === date);
              const isToday = date === formatDate(new Date());
              return (
                <div
                  key={date}
                  className={`flex min-h-[10rem] flex-col rounded-xl border p-2.5 sm:p-3 ${
                    isToday
                      ? "border-indigo-300 bg-indigo-50/50 ring-1 ring-indigo-200"
                      : "border-slate-200 bg-slate-50/60"
                  }`}
                >
                  <div className="mb-2 flex items-center justify-between gap-1">
                    <div>
                      <p className="text-xs font-bold text-indigo-600">
                        {weekdayLabel(date)}
                      </p>
                      <p className="text-sm font-semibold text-slate-900">
                        {date.slice(5).replace("-", "/")}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="rounded-lg bg-white px-2 py-1 text-xs font-semibold text-indigo-600 ring-1 ring-indigo-200 hover:bg-indigo-50"
                      onClick={() => openAdd(date)}
                    >
                      + 추가
                    </button>
                  </div>

                  <div className="flex flex-1 flex-col gap-2">
                    {daySchedules.length === 0 ? (
                      <p className="muted flex flex-1 items-center justify-center text-center text-xs">
                        일정 없음
                      </p>
                    ) : (
                      daySchedules.map((s) => {
                        const report = reportByKey.get(
                          `${s.memberId}:${s.date}`
                        );
                        const hasRecord = report && reportHasContent(report);
                        return (
                          <div
                            key={s.id}
                            className="rounded-lg border border-white bg-white p-2 shadow-sm ring-1 ring-slate-100"
                          >
                            <button
                              type="button"
                              className="w-full text-left"
                              onClick={() =>
                                goDaily(s.date, s.memberId, s.stationName)
                              }
                            >
                              <p className="line-clamp-2 text-xs font-bold text-slate-900">
                                {s.title}
                              </p>
                              <p className="mt-0.5 text-[11px] text-slate-600">
                                {memberNameById.get(s.memberId) ?? s.memberId}
                              </p>
                              {s.stationName ? (
                                <p className="mt-0.5 text-[11px] text-blue-700">
                                  {s.stationName}
                                </p>
                              ) : null}
                              <span
                                className={`mt-1.5 inline-block rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                                  hasRecord
                                    ? "bg-emerald-100 text-emerald-800"
                                    : "bg-slate-100 text-slate-600"
                                }`}
                              >
                                {hasRecord ? "기록 있음" : "기록 작성"}
                              </span>
                            </button>
                            <div className="mt-1.5 flex gap-1 border-t border-slate-100 pt-1.5">
                              <button
                                type="button"
                                className="text-[10px] font-medium text-slate-500 hover:text-indigo-600"
                                onClick={() => openEdit(s)}
                              >
                                수정
                              </button>
                              <button
                                type="button"
                                className="text-[10px] font-medium text-red-600 hover:text-red-700"
                                onClick={() => void removeSchedule(s.id)}
                              >
                                삭제
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <Link href="/daily" className="card feature-card block">
          <h2 className="text-base font-bold">일일 기록 바로가기</h2>
          <p className="muted mt-2 text-sm">오늘 날짜로 업무 기록 작성</p>
        </Link>
        <Link href="/manager" className="card feature-card block">
          <h2 className="text-base font-bold">팀장 대시보드</h2>
          <p className="muted mt-2 text-sm">주간 제출 현황·요약 보고서</p>
        </Link>
      </div>

      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
        >
          <button
            type="button"
            className="absolute inset-0"
            aria-label="닫기"
            onClick={() => setModalOpen(false)}
          />
          <form
            className="relative z-10 w-full max-w-md rounded-2xl bg-white p-5 shadow-xl"
            onSubmit={(e) => void saveSchedule(e)}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold">
              {editing ? "일정 수정" : "일정 추가"}
            </h3>
            <div className="mt-4 space-y-3">
              <div>
                <label className="label">날짜</label>
                <input
                  type="date"
                  className="input"
                  value={formDate}
                  onChange={(e) => setFormDate(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="label">담당자</label>
                <select
                  className="select"
                  value={formMemberId}
                  onChange={(e) => setFormMemberId(e.target.value)}
                  required
                >
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">일정 제목</label>
                <input
                  className="input"
                  placeholder="예: 길음역 타일 마감"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="label">역사 (선택)</label>
                <input
                  className="input"
                  placeholder="예: 길음역"
                  value={formStation}
                  onChange={(e) => setFormStation(e.target.value)}
                />
              </div>
              <div>
                <label className="label">메모 (선택)</label>
                <textarea
                  className="textarea min-h-[72px]"
                  value={formNote}
                  onChange={(e) => setFormNote(e.target.value)}
                />
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="submit"
                className="btn btn-primary"
                disabled={saving}
              >
                {saving ? "저장 중…" : "일정 저장"}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={saving || !formDate || !formMemberId}
                onClick={() => {
                  setModalOpen(false);
                  goDaily(formDate, formMemberId, formStation);
                }}
              >
                일일 기록 작성
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setModalOpen(false)}
              >
                취소
              </button>
            </div>
            {formStation.trim() ? (
              <p className="muted mt-2 text-xs">
                「일일 기록 작성」 시 역사 <strong>{formStation.trim()}</strong>
                가 자동으로 채워집니다.
              </p>
            ) : null}
          </form>
        </div>
      )}
    </>
  );
}
