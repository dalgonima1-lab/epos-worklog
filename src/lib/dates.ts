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
