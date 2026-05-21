import { NextRequest, NextResponse } from "next/server";
import {
  deleteSchedule,
  getSchedulesInRange,
  upsertSchedule,
} from "@/lib/db";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const start = searchParams.get("start");
  const end = searchParams.get("end");
  if (!start || !end) {
    return NextResponse.json(
      { error: "start, end 파라미터가 필요합니다." },
      { status: 400 }
    );
  }
  const schedules = await getSchedulesInRange(start, end);
  return NextResponse.json({ schedules });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const schedule = await upsertSchedule({
      id: body.id,
      date: body.date,
      memberId: body.memberId,
      title: body.title,
      stationName: body.stationName,
      note: body.note,
    });
    return NextResponse.json({ schedule });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "저장 실패";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest) {
  const id = new URL(request.url).searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id가 필요합니다." }, { status: 400 });
  }
  try {
    await deleteSchedule(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "삭제 실패";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
