import { NextRequest, NextResponse } from "next/server";
import {
  deleteSchedule,
  deleteSchedulesByVisitGroup,
  getSchedulesInRange,
  upsertSchedule,
} from "@/lib/db";
import type { ScheduleEntry } from "@/lib/types";
import { createVisitGroupId } from "@/lib/visitGroup";
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

function resolveMemberIds(body: {
  memberId?: string;
  memberIds?: string[];
}): string[] {
  const fromList = Array.isArray(body.memberIds)
    ? body.memberIds.map((id) => String(id).trim()).filter(Boolean)
    : [];
  if (fromList.length) return [...new Set(fromList)];
  const single = String(body.memberId ?? "").trim();
  return single ? [single] : [];
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const memberIds = resolveMemberIds(body);
    if (!memberIds.length) {
      return NextResponse.json(
        { error: "담당자를 1명 이상 선택해 주세요." },
        { status: 400 }
      );
    }

    const replaceVisitGroupId = String(body.replaceVisitGroupId ?? "").trim();
    const date = String(body.date ?? "").trim();
    if (replaceVisitGroupId && date) {
      await deleteSchedulesByVisitGroup(date, replaceVisitGroupId);
    }

    const maintenanceBulk = Boolean(body.maintenanceBulk);
    const maintenanceStationNames = body.maintenanceStationNames as
      | string[]
      | undefined;

    const stationNamesEarly = body.stationNames as string[] | undefined;
    const multiStation =
      Array.isArray(stationNamesEarly) && stationNamesEarly.length > 1;
    const sharedVisitGroupId =
      (body.visitGroupId as string | undefined)?.trim() ||
      (memberIds.length > 1 || multiStation ? createVisitGroupId() : undefined);

    if (maintenanceBulk) {
      const schedules: ScheduleEntry[] = [];
      for (const memberId of memberIds) {
        const schedule = await upsertSchedule({
          date: body.date ?? "",
          memberId,
          title: body.title ?? "",
          stationName: body.stationName,
          facilityArea: body.facilityArea,
          managementOffice: body.managementOffice,
          note: body.note,
          visitGroupId: sharedVisitGroupId,
          maintenanceStationNames: Array.isArray(maintenanceStationNames)
            ? maintenanceStationNames
            : undefined,
          maintenanceVisitTargets: body.maintenanceVisitTargets,
        });
        schedules.push(schedule);
      }
      return NextResponse.json({
        schedules,
        visitGroupId: sharedVisitGroupId,
      });
    }

    const stationNames = body.stationNames as string[] | undefined;
    const groupId =
      sharedVisitGroupId ??
      ((body.visitGroupId as string | undefined) ?? createVisitGroupId());
    const titles = body.titles as string[] | undefined;
    if (Array.isArray(stationNames) && stationNames.length > 0) {
      const schedules: ScheduleEntry[] = [];
      const facilityAreas = body.facilityAreas as string[] | undefined;
      const visitGroupId =
        groupId ??
        (memberIds.length > 1 || stationNames.length > 1
          ? createVisitGroupId()
          : undefined);
      for (const memberId of memberIds) {
        let idx = 0;
        for (const name of stationNames) {
          const trimmed = String(name).trim();
          if (!trimmed) continue;
          const schedule = await upsertSchedule({
            date: body.date ?? "",
            memberId,
            title: titles?.[idx] ?? body.title ?? trimmed,
            stationName: trimmed,
            facilityArea: facilityAreas?.[idx] ?? body.facilityArea,
            managementOffice: body.managementOffice,
            note: body.note,
            visitGroupId,
          });
          schedules.push(schedule);
          idx += 1;
        }
      }
      return NextResponse.json({ schedules, visitGroupId });
    }

    const visitGroupId =
      sharedVisitGroupId ??
      (memberIds.length > 1 ? createVisitGroupId() : undefined);
    const schedules: ScheduleEntry[] = [];
    for (const memberId of memberIds) {
      const schedule = await upsertSchedule({
        id: memberIds.length === 1 ? body.id : undefined,
        date: body.date,
        memberId,
        title: body.title,
        stationName: body.stationName,
        facilityArea: body.facilityArea,
        managementOffice: body.managementOffice,
        note: body.note,
        visitGroupId,
      });
      schedules.push(schedule);
    }
    return NextResponse.json({
      schedule: schedules[0],
      schedules,
      visitGroupId,
    });
  } catch (e) {
    return NextResponse.json({ error: formatApiError(e) }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  const visitGroupId = searchParams.get("visitGroupId")?.trim();
  const date = searchParams.get("date")?.trim();
  try {
    if (visitGroupId && date) {
      const removed = await deleteSchedulesByVisitGroup(date, visitGroupId);
      return NextResponse.json({ ok: true, removed });
    }
    if (!id) {
      return NextResponse.json(
        { error: "id 또는 visitGroupId+date가 필요합니다." },
        { status: 400 }
      );
    }
    await deleteSchedule(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: formatApiError(e) }, { status: 500 });
  }
}
