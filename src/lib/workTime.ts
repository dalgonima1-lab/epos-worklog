import { formatKoreanDateTime } from "./koreanTime";

/** 작업 전·후 시각으로 작업 시간(분) 산정 */
export function calcWorkMinutes(
  beforeAt?: string | null,
  afterAt?: string | null
): number | null {
  if (!beforeAt || !afterAt) return null;
  const start = new Date(beforeAt).getTime();
  const end = new Date(afterAt).getTime();
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return null;
  return Math.round((end - start) / 60_000);
}

export function formatWorkDuration(minutes: number | null | undefined): string {
  if (minutes == null) return "—";
  if (minutes < 60) return `${minutes}분`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}시간 ${m}분` : `${h}시간`;
}

export function formatDateTime(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return formatKoreanDateTime(d, {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}
