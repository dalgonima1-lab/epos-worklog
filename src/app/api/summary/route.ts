import { NextRequest, NextResponse } from "next/server";
import {
  getDb,
  getMembers,
  getReportsInRange,
  getSchedulesInRange,
  verifyManagerPin,
} from "@/lib/db";
import {
  buildWeeklySummary,
  summaryToCsv,
  summaryToMarkdown,
} from "@/lib/summary";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const start = searchParams.get("start");
  const end = searchParams.get("end");
  const pin = searchParams.get("pin");
  const format = searchParams.get("format") ?? "json";

  if (!start || !end || !pin) {
    return NextResponse.json(
      { error: "start, end, pin 파라미터가 필요합니다." },
      { status: 400 }
    );
  }

  const ok = await verifyManagerPin(pin);
  if (!ok) {
    return NextResponse.json({ error: "관리자 PIN이 올바르지 않습니다." }, { status: 403 });
  }

  const db = await getDb();
  const members = await getMembers();
  const [reports, schedules] = await Promise.all([
    getReportsInRange(start, end),
    getSchedulesInRange(start, end),
  ]);
  const weekLabel = `${start} ~ ${end}`;

  const summary = buildWeeklySummary(
    db.teamName,
    weekLabel,
    start,
    end,
    members,
    reports,
    schedules
  );

  if (format === "csv") {
    const csv = summaryToCsv(summary);
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="weekly_${start}.csv"`,
      },
    });
  }

  if (format === "markdown") {
    const markdown = summaryToMarkdown(summary);
    return new NextResponse(markdown, {
      headers: { "Content-Type": "text/markdown; charset=utf-8" },
    });
  }

  return NextResponse.json({ summary });
}
