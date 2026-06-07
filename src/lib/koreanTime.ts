export const KOREA_TIMEZONE = "Asia/Seoul";

/** 한국 시간 24시간제 (예: 2026. 6. 7. 20:06) */
export const KOREAN_DATETIME_OPTIONS: Intl.DateTimeFormatOptions = {
  timeZone: KOREA_TIMEZONE,
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
};

/** ISO·Date → 한국 표준시(KST) 24시간 표기 */
export function formatKoreanDateTime(
  value: string | Date,
  options: Intl.DateTimeFormatOptions = KOREAN_DATETIME_OPTIONS
): string {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) {
    return typeof value === "string" ? value : "—";
  }
  return date.toLocaleString("ko-KR", options);
}

/** 현재 시각을 KST 24시간으로 표기 (보고서 일시 등) */
export function koreanNowLabel(
  options: Intl.DateTimeFormatOptions = KOREAN_DATETIME_OPTIONS
): string {
  return formatKoreanDateTime(new Date(), options);
}

/** 저장된 분석 Markdown 상단 일시 줄을 KST 기준으로 갱신 */
export function refreshAnalysisMarkdownDateLine(
  markdown: string,
  iso: string
): string {
  const when = formatKoreanDateTime(iso);
  const lines = markdown.split("\n");
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*일시\s*[:：]/.test(lines[i]!)) {
      lines[i] = `일시: ${when}  `;
      return lines.join("\n");
    }
  }
  return markdown;
}
