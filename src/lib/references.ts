import { promises as fs } from "fs";
import path from "path";
import { loadWeeklyAnalysis, saveWeeklyAnalysis } from "./db";
import { shouldMirrorAnalysisToDisk } from "./localDataFiles";
import type { WeeklyAnalysisRecord } from "./types";

const REF_DIR = path.join(process.cwd(), "data", "references");
const ANALYSIS_DIR = path.join(process.cwd(), "data", "analyses");

export async function saveReferenceAnalysis(
  key: string,
  text: string
): Promise<void> {
  await saveWeeklyAnalysis(key, text, "cursor");
  if (!shouldMirrorAnalysisToDisk()) return;
  await fs.mkdir(REF_DIR, { recursive: true });
  await fs.writeFile(path.join(REF_DIR, `${key}.txt`), text, "utf-8");
}

/** 팀장이 붙여넣은 지난주 참고 txt */
export async function loadReferenceAnalysis(
  key: string
): Promise<string | null> {
  if (shouldMirrorAnalysisToDisk()) {
    try {
      return await fs.readFile(path.join(REF_DIR, `${key}.txt`), "utf-8");
    } catch {
      /* Firestore/DB fallback below */
    }
  }
  const fromDb = await loadWeeklyAnalysis(key);
  if (fromDb?.markdown?.trim() && fromDb.source === "cursor") {
    return fromDb.markdown;
  }
  return null;
}

/**
 * 지난주 분석 보고서 (비교용).
 * 1) references/*.txt 또는 DB(cursor)  2) 해당 주 저장된 주간 분석
 */
export async function loadPriorWeekAnalysisText(
  key: string
): Promise<{ text: string; source: "reference" | "analysis" | "" }> {
  const pasted = await loadReferenceAnalysis(key);
  if (pasted?.trim()) {
    return { text: pasted.trim(), source: "reference" };
  }
  const generated = await loadGeneratedAnalysis(key);
  if (generated?.markdown?.trim()) {
    return { text: generated.markdown.trim(), source: "analysis" };
  }
  return { text: "", source: "" };
}

export async function saveGeneratedAnalysis(
  weekKey: string,
  markdown: string,
  source: WeeklyAnalysisRecord["source"] = "gemini"
): Promise<string> {
  await saveWeeklyAnalysis(weekKey, markdown, source);
  if (!shouldMirrorAnalysisToDisk()) {
    return weekKey;
  }
  await fs.mkdir(ANALYSIS_DIR, { recursive: true });
  const filePath = path.join(ANALYSIS_DIR, `${weekKey}.md`);
  await fs.writeFile(filePath, markdown, "utf-8");
  return filePath;
}

export async function loadGeneratedAnalysis(
  weekKey: string
): Promise<{ markdown: string; source: WeeklyAnalysisRecord["source"] } | null> {
  const fromDb = await loadWeeklyAnalysis(weekKey);
  if (fromDb?.markdown) {
    return { markdown: fromDb.markdown, source: fromDb.source };
  }

  if (!shouldMirrorAnalysisToDisk()) {
    return null;
  }

  try {
    const markdown = await fs.readFile(
      path.join(ANALYSIS_DIR, `${weekKey}.md`),
      "utf-8"
    );
    return { markdown, source: "file" };
  } catch {
    return null;
  }
}

export function weekKey(start: string, end: string): string {
  return `${start}_${end}`;
}
