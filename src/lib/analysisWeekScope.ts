import { getWeekRange, shiftWeek } from "./dates";

export interface WeekRange {
  start: string;
  end: string;
  label: string;
}

export interface AnalysisWeekScope {
  /** 이번에 작성·조회하는 보고서의 주 (월~금 일일 기록) */
  targetWeek: WeekRange;
  /** 그 바로 전 주 — 저장된 분석 보고서를 비교 기준으로 사용 */
  compareWeek: WeekRange;
}

/** 화면 기준일(anchor)이 속한 주를 분석 대상으로, 그 직전 주를 비교 기준으로 */
export function getAnalysisWeekScope(anchor: Date): AnalysisWeekScope {
  const targetWeek = getWeekRange(anchor);
  const compareWeek = getWeekRange(shiftWeek(anchor, -1));
  return { targetWeek, compareWeek };
}

/** start~end 분석 대상 주에 대한 비교 기준 주 (항상 직전 주) */
export function getCompareWeekForTarget(
  targetEnd: string
): WeekRange {
  const anchor = new Date(targetEnd + "T12:00:00");
  return getWeekRange(shiftWeek(anchor, -1));
}

/** 오늘 달력 기준 상대 이름 (이번 주 / 지난주 / 지지난주 / N주 전) */
export function relativeWeekName(
  weekStart: string,
  today: Date = new Date()
): string {
  const thisStart = getWeekRange(today).start;
  if (weekStart === thisStart) return "이번 주";

  for (let n = 1; n <= 8; n++) {
    const start = getWeekRange(shiftWeek(today, -n)).start;
    if (weekStart === start) {
      if (n === 1) return "지난주";
      if (n === 2) return "지지난주";
      return `${n}주 전`;
    }
  }
  return "";
}

export function formatScopeSummary(
  scope: AnalysisWeekScope,
  today: Date = new Date()
): {
  targetRelative: string;
  compareRelative: string;
  oneLiner: string;
  targetCaption: string;
  compareCaption: string;
} {
  const targetRelative =
    relativeWeekName(scope.targetWeek.start, today) || "선택한 주";
  const compareRelative =
    relativeWeekName(scope.compareWeek.start, today) || "직전 주";

  return {
    targetRelative,
    compareRelative,
    oneLiner: `「${compareRelative}」(${scope.compareWeek.label})에 저장된 분석 보고서를 기준으로, 「${targetRelative}」(${scope.targetWeek.label}) 일일 기록을 분석합니다.`,
    targetCaption: `${targetRelative} · ${scope.targetWeek.label}`,
    compareCaption: `${compareRelative} · ${scope.compareWeek.label}`,
  };
}
