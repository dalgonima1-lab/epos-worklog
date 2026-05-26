import holidayData from "@/data/korean-public-holidays.json";

export interface KoreanHoliday {
  date: string;
  name: string;
}

const HOLIDAYS = holidayData as Record<string, string>;

/** 해당 날짜가 법정 공휴일이면 이름 반환 */
export function getKoreanHolidayName(dateStr: string): string | null {
  const name = HOLIDAYS[dateStr.trim()];
  return name?.trim() || null;
}

export function isKoreanPublicHoliday(dateStr: string): boolean {
  return Boolean(getKoreanHolidayName(dateStr));
}

/** `start`~`end` (YYYY-MM-DD) 범위의 공휴일 목록 */
export function koreanHolidaysInRange(
  start: string,
  end: string
): KoreanHoliday[] {
  const out: KoreanHoliday[] = [];
  for (const [date, name] of Object.entries(HOLIDAYS)) {
    if (date >= start && date <= end) {
      out.push({ date, name });
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}
