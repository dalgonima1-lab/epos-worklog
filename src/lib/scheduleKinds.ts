/** 일정 유형: 현장·사무 외 휴무 */
export const ANNUAL_LEAVE_FACILITY = "연차" as const;
export const PUBLIC_HOLIDAY_FACILITY = "공휴일" as const;

export type TimeOffFacility =
  | typeof ANNUAL_LEAVE_FACILITY
  | typeof PUBLIC_HOLIDAY_FACILITY;

export type ScheduleFormKind = "field" | "annual_leave" | "public_holiday";

export function isAnnualLeaveFacility(area?: string): boolean {
  return area?.trim() === ANNUAL_LEAVE_FACILITY;
}

export function isPublicHolidayFacility(area?: string): boolean {
  return area?.trim() === PUBLIC_HOLIDAY_FACILITY;
}

export function isTimeOffFacility(area?: string): boolean {
  return isAnnualLeaveFacility(area) || isPublicHolidayFacility(area);
}

export function scheduleFormKindFromFacility(
  area?: string
): ScheduleFormKind {
  if (isAnnualLeaveFacility(area)) return "annual_leave";
  if (isPublicHolidayFacility(area)) return "public_holiday";
  return "field";
}

export function defaultTimeOffTitle(
  kind: ScheduleFormKind,
  holidayName?: string | null
): string {
  if (kind === "annual_leave") return ANNUAL_LEAVE_FACILITY;
  if (kind === "public_holiday") {
    const name = holidayName?.trim();
    return name ? name : PUBLIC_HOLIDAY_FACILITY;
  }
  return "";
}
