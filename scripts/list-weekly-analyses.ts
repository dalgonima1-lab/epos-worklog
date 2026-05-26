import { config } from "dotenv";
import path from "path";
import { getDb } from "../src/lib/db";

config({ path: path.join(process.cwd(), ".env.local") });

async function main() {
  const db = await getDb();
  const keys = Object.keys(db.weeklyAnalyses ?? {}).sort();
  console.log("weeklyAnalyses keys:", keys.length ? keys.join(", ") : "(없음)");
  for (const k of keys) {
    const r = db.weeklyAnalyses![k];
    console.log(`  ${k} source=${r.source} len=${r.markdown.length}`);
  }
  const may = db.reports.filter((r) => r.date >= "2026-05-01" && r.date <= "2026-05-31");
  const dates = [...new Set(may.map((r) => r.date))].sort();
  console.log("May report dates:", dates.join(", "));
}

main().catch(console.error);
