export type PhotoSlot = "before" | "after";

export function photoApiUrl(
  memberId: string,
  date: string,
  slot: PhotoSlot
): string {
  return `/api/reports/photo?memberId=${encodeURIComponent(memberId)}&date=${encodeURIComponent(date)}&slot=${slot}`;
}
