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
const SUBSTITUTE_SUFFIX = " 대체공휴일";

/** 캘린더 칸에 긴 이름이 줄바꿈되지 않도록 짧게 표시 */
const HOLIDAY_BASE_SHORT: Record<string, string> = {
  부처님오신날: "부처님",
  국회의원선거일: "선거",
};

export interface CalendarHolidayDisplay {
  shortLabel: string;
  fullName: string;
  isSubstitute: boolean;
}

export function formatCalendarHolidayDisplay(
  fullName: string
): CalendarHolidayDisplay {
  const full = fullName.trim();
  if (full.endsWith(SUBSTITUTE_SUFFIX)) {
    const base = full.slice(0, -SUBSTITUTE_SUFFIX.length);
    const shortBase = HOLIDAY_BASE_SHORT[base] ?? base;
    return {
      shortLabel: `${shortBase}·대체`,
      fullName: full,
      isSubstitute: true,
    };
  }
  const shortLabel = HOLIDAY_BASE_SHORT[full] ?? full;
  return { shortLabel, fullName: full, isSubstitute: false };
}

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
