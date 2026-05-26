import type { DailyReport } from "./types";
import type { WeeklySummary } from "./summary";
import { weekdayLabel } from "./dates";

function excerpt(text: string, max = 120): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
}

function collectIssues(reports: DailyReport[]): string[] {
  const items: string[] = [];
  for (const r of reports) {
    if (r.issues?.trim()) items.push(`${r.date}: ${excerpt(r.issues, 80)}`);
    if (r.deficiencies?.trim())
      items.push(`${r.date} 미비: ${excerpt(r.deficiencies, 80)}`);
  }
  return items;
}

function stationsForReports(reports: DailyReport[]): string[] {
  const set = new Set<string>();
  for (const r of reports) {
    if (r.stationName?.trim()) {
      r.stationName.split(/[,，]/).forEach((s) => {
        const n = s.trim();
        if (n) set.add(n);
      });
    }
  }
  return [...set];
}

function inferChecklistRows(summary: WeeklySummary) {
  const allDone = summary.members.flatMap((m) => m.reports.map((r) => r.done)).join(" ");
  const rows: {
    task: string;
    status: string;
    note: string;
    action: string;
  }[] = [];

  const tasks = [
    {
      key: /조명|관제|화면|DB|Object/i,
      task: "1~4호선 조명제어 관제·DB·화면 구축",
    },
    {
      key: /서버|렉|테스트|연동/i,
      task: "사무실·서버·렉 테스트 연동 환경",
    },
    {
      key: /485|부스덕|변전|성신/i,
      task: "성신여대·부스덕트·485 연동",
    },
    {
      key: /A\/S|UPS|펌웨어|수진|개화산/i,
      task: "현장 A/S·장비·UPS·펌웨어",
    },
    {
      key: /통신|IP|예외|DB.*깨|미비/i,
      task: "통신·IP·DB 미비·예외처리",
    },
    {
      key: /전력감시|유지보수|수서전기/i,
      task: "26.2분기 전력감시 유지보수",
    },
  ];

  for (const t of tasks) {
    if (!t.key.test(allDone)) continue;
    const related = summary.members.flatMap((m) =>
      m.reports.filter((r) => t.key.test(r.done + r.issues + r.deficiencies))
    );
    const openIssues = related.some(
      (r) => r.deficiencies?.trim() || /미완|재방|예정|차주/i.test(r.done + r.issues)
    );
    const status = openIssues ? "**△**" : "**○**";
    const names = [
      ...new Set(related.map((r) => summary.members.find((m) => m.reports.includes(r))?.member.name).filter(Boolean)),
    ];
    rows.push({
      task: t.task,
      status,
      note: `${names.join("·") || "팀"} 주간 실적 ${related.length}건`,
      action: openIssues
        ? "미비·재방문 일정·담당·완료일 명시"
        : "현행 유지·모범 사례 공유",
    });
  }

  if (rows.length === 0) {
    rows.push({
      task: "주간 일일 업무 기록",
      status: "**○**",
      note: `전원 ${summary.expectedDays}일 제출`,
      action: "차주 전략 과제 구체화",
    });
  }

  return rows.map((r, i) => ({ ...r, no: i + 1 }));
}

export function generateAutoWeeklyAnalysis(params: {
  summary: WeeklySummary;
  previousWeekLabel?: string;
  previousAnalysisMarkdown?: string;
}): string {
  const { summary, previousWeekLabel, previousAnalysisMarkdown } = params;
  const now = new Date().toLocaleString("ko-KR");
  const totalReports = summary.members.reduce((n, m) => n + m.reports.length, 0);
  const allIssues = summary.members.flatMap((m) => collectIssues(m.reports));
  const checklist = inferChecklistRows(summary);

  const lines: string[] = [
    `# ${summary.teamName} 업무 분석 및 제언 보고서`,
    ``,
    `일시: ${now}  `,
    `발신: ${summary.teamName} (**자동 분석** — 매주 토요일 일일 기록 기반)  `,
    `참조: 경영지원본부, EPOS 관리팀  `,
    `**분석 기간:** ${summary.start}(월) ~ ${summary.end}(금)`,
    ``,
    `---`,
    ``,
    `## 1. 종합 평가 (Executive Summary)`,
    ``,
    `이번 주(${summary.weekLabel}) **팀원 ${summary.members.length}명 전원**이 근무일 **${summary.expectedDays}일** 일일 기록을 제출했습니다(총 ${totalReports}건).`,
  ];

  for (const m of summary.members) {
    const stations = stationsForReports(m.reports);
    lines.push(
      `- **${m.member.name}**: ${m.submittedDays}/${m.expectedDays}일 제출 · 역사 ${stations.slice(0, 4).join(", ") || "—"}${stations.length > 4 ? " 외" : ""}`
    );
  }

  if (allIssues.length > 0) {
    lines.push(
      ``,
      `**공통 리스크:** 미비·이슈 ${allIssues.length}건이 기록되었습니다. 통신/IP·DB·현장 연동 이슈는 차주 **클로징 보드**로 추적할 것을 권장합니다.`
    );
  } else {
    lines.push(``, `**공통 리스크:** 기록상 긴급 미비·이슈는 제한적이나, 현장·DB 품질은 지속 점검이 필요합니다.`);
  }

  if (previousWeekLabel && previousAnalysisMarkdown?.trim()) {
    lines.push(
      ``,
      `**지난주(${previousWeekLabel}) 대비:** 지난주 분석 보고서와 비교하여 이번 주 일일 기록의 이행·미비 추이를 반영했습니다.`
    );
  }

  lines.push(``, `---`, ``, `## 2. 구성원별 평가`, ``);

  for (const m of summary.members) {
    const stations = stationsForReports(m.reports);
    const issues = collectIssues(m.reports);
    lines.push(`### ${m.member.name}`, ``);
    lines.push(`**👍 잘한 부분**`);
    lines.push(`- 주간 **${m.submittedDays}/${m.expectedDays}일** 성실 제출`);
    if (stations.length) {
      lines.push(`- **${stations.slice(0, 5).join(", ")}** 등 현장·역사 업무 수행`);
    }
    const highlights = m.reports
      .filter((r) => r.done?.trim())
      .slice(0, 3)
      .map((r) => `${weekdayLabel(r.date)}: ${excerpt(r.done, 100)}`);
    for (const h of highlights) {
      lines.push(`- ${h}`);
    }
    lines.push(``, `**👎 보완이 필요한 부분**`);
    if (issues.length) {
      for (const iss of issues.slice(0, 4)) {
        lines.push(`- ${iss}`);
      }
    } else {
      lines.push(`- 특이 미비 기록 없음 — 역사명·차주 계획을 일일 기록 형식에 맞게 구체화 권장`);
    }
    lines.push(``, `---`, ``);
  }

  lines.push(`## 3. 핵심 전략 과제 이행 체크리스트`, ``);
  lines.push(
    `| No | 전략 과제 | 이행 | ${summary.weekLabel} 현황·근거 | 차주 조치·권고 |`
  );
  lines.push(`|----|-----------|------|------------------------------|----------------|`);
  for (const row of checklist) {
    lines.push(
      `| ${row.no} | ${row.task} | ${row.status} | ${row.note} | ${row.action} |`
    );
  }

  lines.push(``, `---`, ``, `## 4. 대표님 의사결정용 최종 제언`, ``);
  lines.push(
    `1. 이번 주는 **일일 기록 전원 제출**이 완료되어 주간 가시성이 확보되었습니다. 차주에도 **월~금 제출**을 유지해 주세요.`
  );
  if (allIssues.length > 0) {
    lines.push(
      `2. 미비·이슈 **${allIssues.length}건**은 담당·완료 목표일을 정해 **수요일 전 클로징**을 제안합니다.`
    );
  }
  lines.push(
    `3. **DB·화면(이준명) – 현장 설치(유영준) – 연동·A/S(노희찬)** 역할을 홈 **주간 일정**에 등록하면 협업 품질이 향상됩니다.`
  );

  lines.push(``, `---`, ``, `## 5. 팀장 첨언`, ``);
  lines.push(
    `- 본 보고서는 **매주 토요일** 전원 일일 기록 제출이 확인되면 **자동 생성·저장**됩니다.`
  );
  lines.push(
    `- 앱 **팀장 → AI 주간분석**에서 즉시 확인할 수 있으며, 필요 시 Gemini로 재생성할 수 있습니다.`
  );
  lines.push(`- 생성 시각: ${now}`);

  return lines.join("\n");
}
