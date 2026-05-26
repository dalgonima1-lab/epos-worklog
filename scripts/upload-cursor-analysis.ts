/**
 * Cursor 등에서 작성한 Markdown 보고서를 앱 분석 저장소에 등록
 *
 * 권장: 지지난주 저장 분석을 비교 기준으로 지난주 분석을 자동 생성할 때
 *   npm run generate:cursor
 *
 * 수동 업로드 예:
 *   npx tsx scripts/upload-cursor-analysis.ts 2026-05-18 2026-05-22 data/analyses/2026-05-18_2026-05-22.md
 */
import { promises as fs } from "fs";
import path from "path";
import { saveGeneratedAnalysis, weekKey } from "../src/lib/references";

async function main() {
  const [start, end, fileArg] = process.argv.slice(2);
  if (!start || !end || !fileArg) {
    console.error(
      "사용법: npx tsx scripts/upload-cursor-analysis.ts <start> <end> <markdown파일>"
    );
    process.exit(1);
  }

  const filePath = path.isAbsolute(fileArg)
    ? fileArg
    : path.join(process.cwd(), fileArg);
  const markdown = await fs.readFile(filePath, "utf-8");
  const key = weekKey(start, end);
  const saved = await saveGeneratedAnalysis(key, markdown, "cursor");

  console.log(`✓ 저장 완료: ${saved}`);
  console.log(`  앱에서: /manager/analysis (기준 주 ${start} ~ ${end}, PIN 입력 후 조회)`);
  console.log(`  Vercel 배포 시: git push 후 해당 md 파일이 포함되어야 합니다.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
