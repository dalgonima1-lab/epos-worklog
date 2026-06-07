import { NextRequest, NextResponse } from "next/server";
import {
  getFirestoreStorageDiagnostics,
  verifyManagerPin,
} from "@/lib/db";
import { isFirebaseConfigured } from "@/lib/firebaseAdmin";

/** 레거시 단일 문서 → reports/schedules 서브컬렉션 마이그레이션 (최초 1회) */
export async function POST(request: NextRequest) {
  if (!isFirebaseConfigured()) {
    return NextResponse.json(
      { error: "Firebase가 설정되지 않았습니다." },
      { status: 400 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const pin = String(body.pin ?? request.headers.get("x-manager-pin") ?? "");
  const ok = await verifyManagerPin(pin);
  if (!ok) {
    return NextResponse.json(
      { error: "관리자 PIN이 올바르지 않습니다." },
      { status: 403 }
    );
  }

  const diagnostics = await getFirestoreStorageDiagnostics();
  return NextResponse.json({
    ok: true,
    migrated: diagnostics?.storageVersion === 2,
    ...diagnostics,
  });
}
