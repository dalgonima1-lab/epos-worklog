import { NextRequest, NextResponse } from "next/server";
import { getPhotoBufferFromReport, updatePhotoTimestamp } from "@/lib/db";
import {
  bufferToDataUrl,
  savePhoto,
  shouldStorePhotosInFirestore,
  type PhotoSlot,
} from "@/lib/photos";

const MAX_BYTES = 8 * 1024 * 1024;
const MAX_FIRESTORE_PHOTO_BYTES = 650 * 1024;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const memberId = searchParams.get("memberId");
  const date = searchParams.get("date");
  const slot = searchParams.get("slot") as PhotoSlot | null;

  if (!memberId || !date || (slot !== "before" && slot !== "after")) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const buffer = await getPhotoBufferFromReport(memberId, date, slot);
  if (!buffer) {
    return NextResponse.json({ error: "사진이 없습니다." }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": "private, max-age=3600",
    },
  });
}

export async function POST(request: NextRequest) {
  const form = await request.formData();
  const memberId = String(form.get("memberId") ?? "");
  const date = String(form.get("date") ?? "");
  const slot = String(form.get("slot") ?? "") as PhotoSlot;
  const recordedAt = String(form.get("recordedAt") ?? new Date().toISOString());
  const file = form.get("file");

  if (!memberId || !date || (slot !== "before" && slot !== "after")) {
    return NextResponse.json(
      { error: "memberId, date, slot가 필요합니다." },
      { status: 400 }
    );
  }

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "파일이 없습니다." }, { status: 400 });
  }

  if (!file.type.startsWith("image/")) {
    return NextResponse.json(
      { error: "이미지 파일만 업로드할 수 있습니다." },
      { status: 400 }
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  if (buffer.length > MAX_BYTES) {
    return NextResponse.json(
      { error: "파일 크기는 8MB 이하여야 합니다." },
      { status: 400 }
    );
  }

  let photoDataUrl: string | undefined;

  if (shouldStorePhotosInFirestore()) {
    if (buffer.length > MAX_FIRESTORE_PHOTO_BYTES) {
      return NextResponse.json(
        {
          error:
            "Storage 없이 사용하는 경우 사진은 약 650KB 이하만 업로드할 수 있습니다. 카메라 화질을 낮추거나 이미지를 줄여서 다시 올려 주세요.",
        },
        { status: 400 }
      );
    }
    photoDataUrl = bufferToDataUrl(buffer, file.type || "image/jpeg");
  } else {
    await savePhoto(memberId, date, slot, buffer);
  }

  const report = await updatePhotoTimestamp(
    memberId,
    date,
    slot,
    recordedAt,
    photoDataUrl
  );

  return NextResponse.json({
    ok: true,
    recordedAt: slot === "before" ? report.beforePhotoAt : report.afterPhotoAt,
    workMinutes: report.workMinutes ?? null,
    photoUrl: `/api/reports/photo?memberId=${encodeURIComponent(memberId)}&date=${encodeURIComponent(date)}&slot=${slot}`,
  });
}
