import { config } from "dotenv";
import { readFileSync } from "fs";
import path from "path";
import { saveWeeklyAnalysis, getDb } from "../src/lib/db";

config({ path: path.join(process.cwd(), ".env.local") });

async function main() {
  const md = readFileSync(
    path.join(process.cwd(), "data/analyses/2026-05-18_2026-05-22.md"),
    "utf8"
  );
  console.log("md len", md.length);
  await saveWeeklyAnalysis("2026-05-18_2026-05-22", md, "cursor");
  const db = await getDb();
  console.log("keys", Object.keys(db.weeklyAnalyses ?? {}));
}

main().catch((e) => {
  console.error("FAIL", e);
  process.exit(1);
});
