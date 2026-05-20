import { promises as fs } from "fs";
import path from "path";

const REF_DIR = path.join(process.cwd(), "data", "references");
const ANALYSIS_DIR = path.join(process.cwd(), "data", "analyses");

export async function saveReferenceAnalysis(
  weekKey: string,
  text: string
): Promise<void> {
  await fs.mkdir(REF_DIR, { recursive: true });
  await fs.writeFile(path.join(REF_DIR, `${weekKey}.txt`), text, "utf-8");
}

export async function loadReferenceAnalysis(
  weekKey: string
): Promise<string | null> {
  try {
    return await fs.readFile(path.join(REF_DIR, `${weekKey}.txt`), "utf-8");
  } catch {
    return null;
  }
}

export async function saveGeneratedAnalysis(
  weekKey: string,
  markdown: string
): Promise<string> {
  await fs.mkdir(ANALYSIS_DIR, { recursive: true });
  const filePath = path.join(ANALYSIS_DIR, `${weekKey}.md`);
  await fs.writeFile(filePath, markdown, "utf-8");
  return filePath;
}

export async function loadGeneratedAnalysis(
  weekKey: string
): Promise<string | null> {
  try {
    return await fs.readFile(
      path.join(ANALYSIS_DIR, `${weekKey}.md`),
      "utf-8"
    );
  } catch {
    return null;
  }
}

export function weekKey(start: string, end: string): string {
  return `${start}_${end}`;
}
