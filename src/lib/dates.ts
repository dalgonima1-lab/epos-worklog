export function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function getWeekRange(anchor: Date): { start: string; end: string; label: string } {
  const d = new Date(anchor);
  const day = d.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diffToMonday);
  const friday = new Date(monday);
  friday.setDate(monday.getDate() + 4);

  const start = formatDate(monday);
  const end = formatDate(friday);
  const label = `${start} ~ ${end}`;
  return { start, end, label };
}

export function weekdaysBetween(start: string, end: string): string[] {
  const days: string[] = [];
  const cur = new Date(start + "T12:00:00");
  const last = new Date(end + "T12:00:00");
  while (cur <= last) {
    const dow = cur.getDay();
    if (dow >= 1 && dow <= 5) {
      days.push(formatDate(cur));
    }
    cur.setDate(cur.getDate() + 1);
  }
  return days;
}

export function shiftWeek(anchor: Date, delta: number): Date {
  const d = new Date(anchor);
  d.setDate(d.getDate() + delta * 7);
  return d;
}

/** `YYYY-MM-DD` 두 날짜 사이의 달력 일 수 (시작 ≤ 끝일 때 양수) */
export function calendarDaysBetween(
  startIsoDate: string,
  endIsoDate: string
): number {
  const a = new Date(startIsoDate + "T12:00:00");
  const b = new Date(endIsoDate + "T12:00:00");
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

/** 오늘 기준 상대 표현 (로컬 달력 기준) */
export function relativeCalendarDayLabel(dateStr: string): string {
  const parts = dateStr.split("-").map(Number);
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return dateStr;
  const [y, m, d] = parts;
  const target = new Date(y, m - 1, d);
  const now = new Date();
  const todayStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  );
  const diffDays = Math.round(
    (todayStart.getTime() - target.getTime()) / 86400000
  );
  if (diffDays === 0) return "오늘";
  if (diffDays === 1) return "어제";
  if (diffDays > 1) return `${diffDays}일 전`;
  if (diffDays === -1) return "내일";
  return `${-diffDays}일 후`;
}
