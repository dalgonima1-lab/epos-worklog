/**
 * 로컬에서 토요일 자동 분석과 동일 로직 실행
 * npx tsx scripts/run-weekly-auto.ts
 * npx tsx scripts/run-weekly-auto.ts --force
 */
import { config } from "dotenv";
import path from "path";
import { runWeeklyAutoAnalysis } from "../src/lib/runWeeklyAutoAnalysis";

config({ path: path.join(process.cwd(), ".env.local") });

const force = process.argv.includes("--force");

runWeeklyAutoAnalysis({ force, tryGemini: true })
  .then((r) => {
    console.log(JSON.stringify(r, null, 2));
    process.exit(r.ok ? 0 : 1);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
