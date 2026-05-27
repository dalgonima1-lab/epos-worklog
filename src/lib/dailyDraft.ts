const DRAFT_PREFIX = "epos-daily-draft:";
const MEMBER_KEY = "epos-daily-last-member";

export type DailyDraftPayload = Record<string, unknown>;

export function draftKey(memberId: string, date: string): string {
  return `${DRAFT_PREFIX}${memberId}:${date}`;
}

export function saveDailyDraft(
  memberId: string,
  date: string,
  payload: DailyDraftPayload
): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(draftKey(memberId, date), JSON.stringify(payload));
  } catch {
    /* quota */
  }
}

export function loadDailyDraft(
  memberId: string,
  date: string
): DailyDraftPayload | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(draftKey(memberId, date));
    if (!raw) return null;
    return JSON.parse(raw) as DailyDraftPayload;
  } catch {
    return null;
  }
}

export function clearDailyDraft(memberId: string, date: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(draftKey(memberId, date));
  } catch {
    /* ignore */
  }
}

export function saveLastMemberId(memberId: string): void {
  if (typeof window === "undefined" || !memberId) return;
  try {
    localStorage.setItem(MEMBER_KEY, memberId);
  } catch {
    /* ignore */
  }
}

export function loadLastMemberId(): string {
  if (typeof window === "undefined") return "";
  try {
    return localStorage.getItem(MEMBER_KEY) ?? "";
  } catch {
    return "";
  }
}
