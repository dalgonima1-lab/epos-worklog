import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

/** 샘플: 5월 2주차 EPOS 관리팀 분석 보고서 (제공 PDF 기반) */
export async function GET() {
  try {
    const filePath = path.join(
      process.cwd(),
      "data",
      "reference",
      "sample-weekly-analysis.txt"
    );
    const text = await fs.readFile(filePath, "utf-8");
    return NextResponse.json({ text });
  } catch {
    return NextResponse.json(
      { error: "샘플 파일을 찾을 수 없습니다." },
      { status: 404 }
    );
  }
}
