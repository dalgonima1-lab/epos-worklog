export const KOREA_TIMEZONE = "Asia/Seoul";

const DEFAULT_DATETIME: Intl.DateTimeFormatOptions = {
  timeZone: KOREA_TIMEZONE,
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
};

/** ISO·Date → 한국 표준시(KST) 표기 */
export function formatKoreanDateTime(
  value: string | Date,
  options: Intl.DateTimeFormatOptions = DEFAULT_DATETIME
): string {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) {
    return typeof value === "string" ? value : "—";
  }
  return date.toLocaleString("ko-KR", options);
}

/** 현재 시각을 KST로 표기 (보고서 일시 등) */
export function koreanNowLabel(
  options: Intl.DateTimeFormatOptions = DEFAULT_DATETIME
): string {
  return formatKoreanDateTime(new Date(), options);
}
