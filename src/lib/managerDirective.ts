import type { ManagerDirective } from "./types";

export function formatDirectiveTimestamp(iso: string): string {
  try {
    return new Date(iso).toLocaleString("ko-KR", {
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

/** 보고서 5번 섹션에 첨언·지시를 반영한 표시용 Markdown */
export function mergeDirectiveIntoMarkdown(
  markdown: string,
  directive?: ManagerDirective | null
): string {
  if (!directive?.text?.trim()) return markdown;

  const when = formatDirectiveTimestamp(directive.updatedAt);
  const section = [
    `## 5. 팀장, 대표님 첨언 및 지시사항`,
    ``,
    `**작성:** ${directive.author} · ${when}`,
    ``,
    directive.text.trim(),
  ].join("\n");

  const re = /##\s*5\.\s*[^\n]*[\s\S]*?(?=\n##\s+\d+\.|\n---\s*\n##|$)/i;
  if (re.test(markdown)) {
    return markdown.replace(re, section);
  }

  const trimmed = markdown.trimEnd();
  const sep = trimmed.endsWith("---") ? "\n\n" : "\n\n---\n\n";
  return `${trimmed}${sep}${section}\n`;
}

export function stripDirectiveSection(markdown: string): string {
  const re = /(\n---\s*\n)?##\s*5\.\s*[^\n]*[\s\S]*?(?=\n##\s+\d+\.|$)/i;
  return markdown.replace(re, "").trimEnd();
}
