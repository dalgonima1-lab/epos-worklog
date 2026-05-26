/**
 * 로컬에서 토요일 자동 분석과 동일 로직 실행
 * npx tsx scripts/run-weekly-auto.ts           # 토요일 루틴(전원 제출)
 * npx tsx scripts/run-weekly-auto.ts --sunday    # 일요일 루틴(제출분만)
 * npx tsx scripts/run-weekly-auto.ts --force
 */
import { config } from "dotenv";
import path from "path";
import { runWeeklyAutoAnalysis } from "../src/lib/runWeeklyAutoAnalysis";

config({ path: path.join(process.cwd(), ".env.local") });

const force = process.argv.includes("--force");
const sunday = process.argv.includes("--sunday");

runWeeklyAutoAnalysis({
  schedule: sunday ? "sunday" : "saturday",
  force,
  tryGemini: true,
})
  .then((r) => {
    console.log(JSON.stringify(r, null, 2));
    process.exit(r.ok ? 0 : 1);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
