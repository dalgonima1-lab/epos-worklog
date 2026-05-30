import { promises as fs } from "fs";
import path from "path";
import {
  loadWeeklyAnalysis,
  resolveWeeklyAnalysis,
  saveWeeklyAnalysis,
} from "./db";
import { shouldMirrorAnalysisToDisk } from "./localDataFiles";
import type { WeeklyAnalysisRecord } from "./types";

const REF_DIR = path.join(process.cwd(), "data", "references");
const ANALYSIS_DIR = path.join(process.cwd(), "data", "analyses");

export async function saveReferenceAnalysis(
  key: string,
  text: string
): Promise<void> {
  const trimmed = text.trim();
  if (!trimmed) return;
  await saveWeeklyAnalysis(key, trimmed, "cursor");
  if (!shouldMirrorAnalysisToDisk()) return;
  await fs.mkdir(REF_DIR, { recursive: true });
  await fs.writeFile(path.join(REF_DIR, `${key}.txt`), trimmed, "utf-8");
}

/** 팀장이 붙여넣은 지난주 참고 txt */
export async function loadReferenceAnalysis(
  key: string
): Promise<string | null> {
  if (shouldMirrorAnalysisToDisk()) {
    try {
      const text = await fs.readFile(path.join(REF_DIR, `${key}.txt`), "utf-8");
      if (text.trim()) return text;
    } catch {
      /* DB fallback below */
    }
  }
  const fromDb = await loadWeeklyAnalysis(key);
  if (fromDb?.markdown?.trim() && fromDb.source === "cursor") {
    return fromDb.markdown;
  }
  return null;
}

/**
 * 비교 기준 주간 분석·참고 보고서.
 * 1) DB(Firestore) — auto·gemini·cursor 등 저장본
 * 2) references/*.txt / analyses/*.md (로컬 개발)
 */
export async function loadPriorWeekAnalysisText(
  key: string,
  weekStart?: string,
  weekEnd?: string
): Promise<{ text: string; source: "reference" | "analysis" | "" }> {
  if (weekStart && weekEnd) {
    const resolved = await resolveWeeklyAnalysis(weekStart, weekEnd);
    if (resolved?.record.markdown?.trim()) {
      const source =
        resolved.record.source === "cursor" ? "reference" : "analysis";
      return { text: resolved.record.markdown.trim(), source };
    }
  } else {
    const fromDb = await loadWeeklyAnalysis(key);
    if (fromDb?.markdown?.trim()) {
      const source = fromDb.source === "cursor" ? "reference" : "analysis";
      return { text: fromDb.markdown.trim(), source };
    }
  }

  const pasted = await loadReferenceAnalysis(key);
  if (pasted?.trim()) {
    return { text: pasted.trim(), source: "reference" };
  }

  if (!shouldMirrorAnalysisToDisk()) {
    return { text: "", source: "" };
  }

  try {
    const markdown = await fs.readFile(
      path.join(ANALYSIS_DIR, `${key}.md`),
      "utf-8"
    );
    if (markdown.trim()) {
      return { text: markdown.trim(), source: "analysis" };
    }
  } catch {
    /* not on disk */
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
  weekKey: string,
  weekStart?: string,
  weekEnd?: string
): Promise<{
  markdown: string;
  source: WeeklyAnalysisRecord["source"];
  managerDirective?: WeeklyAnalysisRecord["managerDirective"];
} | null> {
  if (weekStart && weekEnd) {
    const resolved = await resolveWeeklyAnalysis(weekStart, weekEnd);
    if (resolved?.record.markdown?.trim()) {
      return {
        markdown: resolved.record.markdown,
        source: resolved.record.source,
        managerDirective: resolved.record.managerDirective,
      };
    }
  }

  const fromDb = await loadWeeklyAnalysis(weekKey);
  if (fromDb?.markdown?.trim()) {
    return {
      markdown: fromDb.markdown,
      source: fromDb.source,
      managerDirective: fromDb.managerDirective,
    };
  }

  if (!shouldMirrorAnalysisToDisk()) {
    return null;
  }

  try {
    const markdown = await fs.readFile(
      path.join(ANALYSIS_DIR, `${weekKey}.md`),
      "utf-8"
    );
    if (markdown.trim()) {
      return { markdown, source: "file" };
    }
  } catch {
    return null;
  }
  return null;
}

export function weekKey(start: string, end: string): string {
  return `${start}_${end}`;
}
