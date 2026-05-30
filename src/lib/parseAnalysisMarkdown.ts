/** 주간 분석 Markdown → 보고서 UI용 구조 */

export interface AnalysisMetaLine {
  label: string;
  value: string;
}

export interface MemberTable {
  headers: string[];
  rows: string[][];
}

export interface MemberEvaluation {
  name: string;
  positives: string[];
  negatives: string[];
  positiveTable?: MemberTable;
  negativeTable?: MemberTable;
}

export type ChecklistLevel = "ok" | "warn" | "bad" | "unknown";

export interface ChecklistRow {
  index: number;
  task: string;
  status: string;
  note: string;
  /** 4열 이상 표에서 추가 근거·조치 */
  action?: string;
  level: ChecklistLevel;
  statusLabel: string;
  statusDetail: string;
  actionHint: string;
}

export interface ChecklistSummary {
  total: number;
  ok: number;
  warn: number;
  bad: number;
  unknown: number;
  completionRate: number;
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

function resolveChecklistStatus(raw: string): Pick<
  ChecklistRow,
  "level" | "statusLabel" | "statusDetail" | "actionHint"
> {
  const s = stripBoldMarkers(raw);
  if (/○|우수|완료|양호|달성/i.test(s)) {
    return {
      level: "ok",
      statusLabel: "우수 (○)",
      statusDetail: "계획 대비 목표를 달성했거나 핵심 산출물이 확인됨",
      actionHint: "현행 방식 유지 · 타 역사·공종에 모범 사례 전파",
    };
  }
  if (/△|보통|진행|일부|지연/i.test(s)) {
    return {
      level: "warn",
      statusLabel: "보통 (△)",
      statusDetail: "진행 중이거나 일부만 완료 · 리스크·미비가 남아 있음",
      actionHint: "차주 마일스톤·담당자·완료 목표일을 일일 기록에 명시",
    };
  }
  if (/[Xx✕×✗]|미흡|부족|미완|미달/i.test(s)) {
    return {
      level: "bad",
      statusLabel: "미흡 (X)",
      statusDetail: "목표 대비 지연·미착수 · 팀장 개입이 필요한 수준",
      actionHint: "원인 분석 후 리소스·일정 재배치 · 주 1회 클로징 점검",
    };
  }
  return {
    level: "unknown",
    statusLabel: s || "미평가",
    statusDetail: "이행 등급이 표기되지 않았거나 기준 외 표기",
    actionHint: "이행 여부(○/△/X)와 근거를 보완 기록",
  };
}

function enrichChecklistRow(
  cells: string[],
  index: number
): ChecklistRow | null {
  if (cells.length < 2) return null;

  const hasLeadingNo = /^\d+[.)]?$/.test(cells[0] ?? "");
  const off = hasLeadingNo ? 1 : 0;
  const task = cells[off] ?? "";
  const status = cells[off + 1] ?? "";
  const note = cells[off + 2] ?? "";
  const action = cells[off + 3] ?? "";

  const taskClean = stripBoldMarkers(task);
  const statusClean = stripBoldMarkers(status);
  const noteClean = stripBoldMarkers(note);
  const actionClean = stripBoldMarkers(action);

  if (!taskClean || /전략|과제|상태|근거|이행|^No$/i.test(taskClean)) {
    return null;
  }

  const resolved = resolveChecklistStatus(statusClean);
  const actionHint = actionClean || resolved.actionHint;

  return {
    index,
    task: taskClean,
    status: statusClean,
    note: noteClean,
    action: actionClean || undefined,
    ...resolved,
    actionHint,
  };
}

function parseTable(sectionBody: string): ChecklistRow[] {
  const rows: ChecklistRow[] = [];
  let n = 0;
  for (const line of sectionBody.split("\n")) {
    const t = line.trim();
    if (!t.startsWith("|") || t.includes("---")) continue;
    const cells = t
      .split("|")
      .map((c) => c.trim())
      .filter(Boolean);
    const row = enrichChecklistRow(cells, n + 1);
    if (row) {
      rows.push(row);
      n++;
    }
  }
  return rows;
}

export function summarizeChecklist(rows: ChecklistRow[]): ChecklistSummary {
  const ok = rows.filter((r) => r.level === "ok").length;
  const warn = rows.filter((r) => r.level === "warn").length;
  const bad = rows.filter((r) => r.level === "bad").length;
  const unknown = rows.filter((r) => r.level === "unknown").length;
  const total = rows.length;
  const completionRate =
    total > 0 ? Math.round(((ok + warn * 0.5) / total) * 100) : 0;
  return { total, ok, warn, bad, unknown, completionRate };
}

function parseMarkdownTableLines(lines: string[]): MemberTable | null {
  const tableLines = lines.filter((l) => l.trim().startsWith("|"));
  if (tableLines.length < 2) return null;

  const parsed = tableLines
    .map((line) =>
      line
        .split("|")
        .map((c) => c.trim())
        .filter(Boolean)
    )
    .filter((cells) => cells.length > 0 && !/^[-:]+$/.test(cells.join("")));

  if (parsed.length < 2) return null;

  const headers = parsed[0].map((c) => stripBoldMarkers(c));
  const rows = parsed.slice(1).map((cells) => cells.map((c) => stripBoldMarkers(c)));
  if (rows.length === 0) return null;

  return { headers, rows };
}

function parseMembers(sectionBody: string): MemberEvaluation[] {
  const members: MemberEvaluation[] = [];
  const chunks = sectionBody.split(/^###\s+/m).filter(Boolean);

  for (const chunk of chunks) {
    const lines = chunk.split("\n");
    const name = lines[0]?.trim().replace(/^■\s*/, "") ?? "";
    if (!name) continue;

    let mode: "pos" | "neg" | null = null;
    const positives: string[] = [];
    const negatives: string[] = [];
    let tableBuffer: string[] = [];

    const flushTable = () => {
      if (tableBuffer.length === 0) return;
      const table = parseMarkdownTableLines(tableBuffer);
      tableBuffer = [];
      if (!table) return;
      if (mode === "pos" && !members[members.length - 1]?.positiveTable) {
        members[members.length - 1].positiveTable = table;
      } else if (mode === "neg") {
        members[members.length - 1].negativeTable = table;
      }
    };

    members.push({
      name,
      positives,
      negatives,
    });

    for (let i = 1; i < lines.length; i++) {
      const raw = lines[i];
      const line = raw.trim();
      if (!line || line === "---") {
        flushTable();
        continue;
      }
      if (/👍|잘한\s*부분/.test(line)) {
        flushTable();
        mode = "pos";
        continue;
      }
      if (/👎|보완|부족/.test(line)) {
        flushTable();
        mode = "neg";
        continue;
      }
      if (/^#{1,6}\s/.test(line)) continue;
      if (line.startsWith("|")) {
        tableBuffer.push(line);
        continue;
      }
      flushTable();

      const bullet = parseBullet(line);
      if (bullet && typeof bullet === "object" && "name" in bullet) {
        const entry = bullet.text.trim()
          ? `**${bullet.name}**: ${bullet.text.trim()}`
          : `**${bullet.name}**:`;
        if (mode === "pos") positives.push(entry);
        else if (mode === "neg") negatives.push(entry);
        continue;
      }
      if (typeof bullet === "string") {
        if (mode === "pos") positives.push(bullet);
        else if (mode === "neg") negatives.push(bullet);
        continue;
      }
      if (mode && /^\s{2,}\S/.test(raw)) {
        const cont = raw.trim();
        if (!cont) continue;
        if (mode === "pos" && positives.length > 0) {
          positives[positives.length - 1] += `\n${cont}`;
        } else if (mode === "neg" && negatives.length > 0) {
          negatives[negatives.length - 1] += `\n${cont}`;
        }
      }
    }
    flushTable();
  }
  return members;
}

function parseSimpleBulletList(sectionBody: string): string[] {
  const lines = sectionBody.split("\n");
  const items: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const t = line.trim();
    if (!t || t === "---") continue;

    const bullet = parseBullet(t);
    if (bullet && typeof bullet === "object" && "name" in bullet) {
      const entry = bullet.text.trim()
        ? `**${bullet.name}**: ${bullet.text.trim()}`
        : `**${bullet.name}**:`;
      items.push(entry);
      continue;
    }
    if (typeof bullet === "string") {
      items.push(bullet);
      continue;
    }
    if (/^\s{2,}\S/.test(line) && items.length > 0) {
      items[items.length - 1] += `\n${t}`;
    }
  }

  return items;
}

function parseNumberedList(sectionBody: string): string[] {
  const lines = sectionBody.split("\n");
  const items: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const t = line.trim();
    if (!t) continue;

    const m = t.match(/^\d+\.\s+(.+)$/);
    if (m) {
      items.push(m[1].trim());
      continue;
    }
    if (/^\s{2,}\S/.test(line) && items.length > 0) {
      items[items.length - 1] += `\n${t}`;
    }
  }

  return items;
}

function parseSummary(sectionBody: string): {
  paragraphs: string[];
  memberBullets: { name: string; text: string }[];
} {
  const paragraphs: string[] = [];
  const memberBullets: { name: string; text: string }[] = [];
  let buf = "";
  const lines = sectionBody.split("\n");

  const flush = () => {
    const p = buf.trim();
    if (p) paragraphs.push(p);
    buf = "";
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const t = line.trim();
    if (!t || t === "---") {
      flush();
      continue;
    }
    const named = parseBullet(t);
    if (named && typeof named === "object" && "name" in named) {
      flush();
      memberBullets.push({ name: named.name, text: named.text });
      continue;
    }
    if (t.startsWith("- ") || t.startsWith("* ")) {
      flush();
      const item = parseBullet(t);
      if (typeof item === "string") memberBullets.push({ name: "", text: item });
      continue;
    }
    if (/^\s{2,}\S/.test(line) && memberBullets.length > 0) {
      const last = memberBullets[memberBullets.length - 1];
      last.text += (last.text ? "\n" : "") + t;
      continue;
    }
    buf += (buf ? " " : "") + t;
  }
  flush();
  return { paragraphs, memberBullets };
}

function classifySection(title: string): AnalysisSection["kind"] {
  if (/종합|Executive|요약/.test(title)) return "summary";
  if (/구성원|팀원별|멤버별|성과.*보완|보완.*과제/.test(title)) return "members";
  if (/체크|전략|과제/.test(title)) return "checklist";
  if (/제언|권고|결론/.test(title)) return "numbered";
  if (/첨언|비고/.test(title)) return "bullets";
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
      return { kind, title, items: parseNumberedList(body) };
    }
    if (kind === "bullets") {
      return { kind, title, items: parseSimpleBulletList(body) };
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
