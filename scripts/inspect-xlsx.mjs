import XLSX from "xlsx";
import fs from "fs";
import path from "path";

const folder =
  "f:\\01. EPOS\\000000. 진행상황 정리\\26년도 5월3째주";

for (const name of fs.readdirSync(folder)) {
  if (!name.endsWith(".xlsx")) continue;
  const fp = path.join(folder, name);
  console.log("\n===", name, "===");
  const wb = XLSX.readFile(fp, { cellDates: true });
  for (const sn of wb.SheetNames) {
    const ws = wb.Sheets[sn];
    const rows = XLSX.utils.sheet_to_json(ws, {
      header: 1,
      defval: "",
      raw: false,
    });
    console.log("Sheet:", sn, "rows:", rows.length);
    for (let i = 0; i < Math.min(30, rows.length); i++) {
      const r = rows[i];
      const cells = r
        .map((c, j) => (c ? `C${j + 1}:${String(c).slice(0, 80)}` : null))
        .filter(Boolean);
      if (cells.length) console.log(` R${i + 1}`, cells.join(" | "));
    }
  }
}
