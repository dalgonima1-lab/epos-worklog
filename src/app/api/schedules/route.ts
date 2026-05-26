import { NextRequest, NextResponse } from "next/server";
import {
  deleteSchedule,
  getSchedulesInRange,
  upsertSchedule,
} from "@/lib/db";
import { formatFirestoreUserError } from "@/lib/firebaseAdmin";

function formatApiError(e: unknown): string {
  if (e instanceof Error) return formatFirestoreUserError(e);
  return formatFirestoreUserError(e);
}

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
  try {
    const schedules = await getSchedulesInRange(start, end);
    return NextResponse.json({ schedules });
  } catch (e) {
    return NextResponse.json({ error: formatApiError(e) }, { status: 500 });
  }
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
      facilityArea: body.facilityArea,
      managementOffice: body.managementOffice,
      note: body.note,
    });
    return NextResponse.json({ schedule });
  } catch (e) {
    return NextResponse.json({ error: formatApiError(e) }, { status: 500 });
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
    return NextResponse.json({ error: formatApiError(e) }, { status: 500 });
  }
}
