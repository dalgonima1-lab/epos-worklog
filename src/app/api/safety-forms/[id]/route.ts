import { promises as fs } from "fs";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { getSafetyPrecheckTemplateById } from "@/lib/safetyPrecheck";

async function resolveTemplateFile(id: string) {
  const tpl = getSafetyPrecheckTemplateById(id);
  if (!tpl) return { tpl: null, filePath: "" };
  const filePath = path.normalize(tpl.sourcePath);
  return { tpl, filePath };
}

export async function HEAD(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const { tpl, filePath } = await resolveTemplateFile(id);
  if (!tpl) {
    return NextResponse.json({ error: "양식을 찾을 수 없습니다." }, { status: 404 });
  }
  try {
    await fs.access(filePath);
    return new NextResponse(null, { status: 200 });
  } catch {
    return NextResponse.json(
      {
        error:
          "양식 파일을 열지 못했습니다. F 드라이브 경로 연결 상태를 확인해 주세요.",
      },
      { status: 404 }
    );
  }
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const { tpl, filePath } = await resolveTemplateFile(id);
  if (!tpl) {
    return NextResponse.json({ error: "양식을 찾을 수 없습니다." }, { status: 404 });
  }
  try {
    const file = await fs.readFile(filePath);
    return new NextResponse(new Uint8Array(file), {
      headers: {
        "Content-Type": "application/x-hwp",
        "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(
          tpl.sourceName
        )}`,
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return NextResponse.json(
      {
        error:
          "양식 파일을 열지 못했습니다. F 드라이브 경로 연결 상태를 확인해 주세요.",
      },
      { status: 404 }
    );
  }
}
