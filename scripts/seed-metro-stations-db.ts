/**
 * Firebase/로컬 DB에 서울 1~9호선 전체 역 카탈로그 반영
 * 묶인 역사명(쉼표 등) 일일기록 정리 포함
 *
 * npx tsx scripts/seed-metro-stations-db.ts
 */
import { config } from "dotenv";
import path from "path";
import { rebuildStationCatalog } from "../src/lib/db";
import { isFirebaseConfigured } from "../src/lib/firebaseAdmin";

config({ path: path.join(process.cwd(), ".env.local") });

async function main() {
  console.log(
    "저장소:",
    isFirebaseConfigured() ? "Firebase Firestore" : "로컬 data/store.json"
  );

  const result = await rebuildStationCatalog();
  console.log(`기존 역 목록: ${result.beforeCount}건`);
  console.log(
    `묶인 역사명 일일기록: ${result.bundledReportsBefore}건 → ${result.reportFixes}건 정리`
  );
  console.log(`카탈로그 반영: ${result.afterCount}건`);
  console.log(`실제 사용 이력: ${result.usedCount}건`);
  console.log("✓ 저장 완료");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
