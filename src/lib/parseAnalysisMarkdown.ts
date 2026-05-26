/** 주간 분석 Markdown → 보고서 UI용 구조 */

export interface AnalysisMetaLine {
  label: string;
  value: string;
}

export interface MemberEvaluation {
  name: string;
  positives: string[];
  negatives: string[];
}

export interface ChecklistRow {
  task: string;
  status: string;
  note: string;
}

export type AnalysisSection =
  | {
      kind: "summary";
      title: string;
      paragraphs: string[];
      memberBullets: { name: string; text: string }[];
    }
  | { kind: "members"; title: string; members: MemberEvaluation[] }
  | { kind: "checklist"; title: string; rows: ChecklistRow[] }
  | { kind: "numbered"; title: string; items: string[] }
  | { kind: "bullets"; title: string; items: string[] }
  | { kind: "prose"; title: string; paragraphs: string[] };

export interface ParsedAnalysisReport {
  title: string;
  meta: AnalysisMetaLine[];
  sections: AnalysisSection[];
}

function stripBoldMarkers(text: string): string {
  return text.replace(/\*\*([^*]+)\*\*/g, "$1").trim();
}

function parseMetaLine(line: string): AnalysisMetaLine | null {
  const t = line.trim();
  if (!t || t === "---") return null;
  const bold = t.match(/^\*\*([^*]+)\*\*\s*[:：]?\s*(.*)$/);
  if (bold) return { label: bold[1].trim(), value: bold[2].trim() };
  const plain = t.match(/^([^:：]+)[:：]\s*(.+)$/);
  if (plain) return { label: plain[1].trim(), value: plain[2].trim() };
  return null;
}

function parseBullet(line: string): { name: string; text: string } | string | null {
  const m = line.match(/^-\s+\*\*([^*]+)\*\*\s*[:：]?\s*(.*)$/);
  if (m) return { name: m[1].trim(), text: m[2].trim() };
  const plain = line.match(/^-\s+(.+)$/);
  if (plain) return plain[1].trim();
  const num = line.match(/^\d+\.\s+(.+)$/);
  if (num) return num[1].trim();
  return null;
}

function parseTable(sectionBody: string): ChecklistRow[] {
  const rows: ChecklistRow[] = [];
  for (const line of sectionBody.split("\n")) {
    const t = line.trim();
    if (!t.startsWith("|") || t.includes("---")) continue;
    const cells = t
      .split("|")
      .map((c) => c.trim())
      .filter(Boolean);
    if (cells.length < 2) continue;
    if (/전략|과제|상태|근거/i.test(cells[0])) continue;
    rows.push({
      task: stripBoldMarkers(cells[0] ?? ""),
      status: stripBoldMarkers(cells[1] ?? ""),
      note: stripBoldMarkers(cells[2] ?? ""),
    });
  }
  return rows;
}

function parseMembers(sectionBody: string): MemberEvaluation[] {
  const members: MemberEvaluation[] = [];
  const chunks = sectionBody.split(/^###\s+/m).filter(Boolean);

  for (const chunk of chunks) {
    const lines = chunk.split("\n");
    const name = lines[0]?.trim() ?? "";
    if (!name) continue;

    let mode: "pos" | "neg" | null = null;
    const positives: string[] = [];
    const negatives: string[] = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line || line === "---") continue;
      if (/👍|잘한\s*부분/.test(line)) {
        mode = "pos";
        continue;
      }
      if (/👎|보완|부족/.test(line)) {
        mode = "neg";
        continue;
      }
      const bullet = parseBullet(line);
      if (typeof bullet === "string") {
        if (mode === "pos") positives.push(bullet);
        else if (mode === "neg") negatives.push(bullet);
      }
    }

    members.push({ name, positives, negatives });
  }
  return members;
}

function parseSummary(sectionBody: string): {
  paragraphs: string[];
  memberBullets: { name: string; text: string }[];
} {
  const paragraphs: string[] = [];
  const memberBullets: { name: string; text: string }[] = [];
  let buf = "";

  const flush = () => {
    const p = buf.trim();
    if (p) paragraphs.push(p);
    buf = "";
  };

  for (const line of sectionBody.split("\n")) {
    const t = line.trim();
    if (!t || t === "---") {
      flush();
      continue;
    }
    const named = parseBullet(t);
    if (named && typeof named === "object" && "name" in named) {
      flush();
      memberBullets.push(named);
      continue;
    }
    if (t.startsWith("- ") || t.startsWith("* ")) {
      flush();
      const item = parseBullet(t);
      if (typeof item === "string") memberBullets.push({ name: "", text: item });
      continue;
    }
    buf += (buf ? " " : "") + t;
  }
  flush();
  return { paragraphs, memberBullets };
}

function classifySection(title: string): AnalysisSection["kind"] {
  if (/구성원|멤버|평가/.test(title)) return "members";
  if (/체크|전략|과제/.test(title)) return "checklist";
  if (/제언|권고|결론/.test(title)) return "numbered";
  if (/첨언|비고/.test(title)) return "bullets";
  if (/종합|Executive|요약/.test(title)) return "summary";
  return "prose";
}

export function parseAnalysisMarkdown(md: string): ParsedAnalysisReport {
  const normalized = md.replace(/\r\n/g, "\n").trim();
  const lines = normalized.split("\n");

  let title = "주간 업무 분석 및 제언 보고서";
  const meta: AnalysisMetaLine[] = [];
  const headerEnd = lines.findIndex((l) => /^##\s+/.test(l));
  const headerLines =
    headerEnd >= 0 ? lines.slice(0, headerEnd) : lines.slice(0, 12);

  for (const line of headerLines) {
    const t = line.trim();
    if (t.startsWith("# ")) {
      title = t.slice(2).trim();
      continue;
    }
    const m = parseMetaLine(t);
    if (m) meta.push(m);
  }

  const sectionBlocks: { title: string; body: string }[] = [];
  const sectionRegex = /^##\s+(.+)$/gm;
  let match: RegExpExecArray | null;
  const starts: { index: number; title: string }[] = [];

  while ((match = sectionRegex.exec(normalized)) !== null) {
    starts.push({ index: match.index, title: match[1].trim() });
  }

  for (let i = 0; i < starts.length; i++) {
    const start = starts[i];
    const end = starts[i + 1]?.index ?? normalized.length;
    const body = normalized
      .slice(start.index + normalized.slice(start.index).indexOf("\n") + 1, end)
      .replace(/^##\s+.+$/m, "")
      .trim();
    sectionBlocks.push({ title: start.title, body });
  }

  const sections: AnalysisSection[] = sectionBlocks.map(({ title, body }) => {
    const kind = classifySection(title);
    if (kind === "members") {
      return { kind, title, members: parseMembers(body) };
    }
    if (kind === "checklist") {
      return { kind, title, rows: parseTable(body) };
    }
    if (kind === "numbered") {
      const items: string[] = [];
      for (const line of body.split("\n")) {
        const m = line.match(/^\d+\.\s+(.+)$/);
        if (m) items.push(m[1].trim());
      }
      return { kind, title, items };
    }
    if (kind === "bullets") {
      const items: string[] = [];
      for (const line of body.split("\n")) {
        const b = parseBullet(line.trim());
        if (typeof b === "string") items.push(b);
      }
      return { kind, title, items };
    }
    if (kind === "summary") {
      const { paragraphs, memberBullets } = parseSummary(body);
      return { kind, title, paragraphs, memberBullets };
    }
    const paragraphs = body
      .split(/\n{2,}/)
      .map((p) => p.replace(/\n/g, " ").trim())
      .filter(Boolean);
    return { kind: "prose", title, paragraphs };
  });

  return { title, meta, sections };
}
