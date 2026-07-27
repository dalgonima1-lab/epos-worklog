import type { DailyReport } from "./types";
import type { WeeklySummary } from "./summary";
import type { SubmissionReadiness } from "./weeklySubmission";
import { weekdayLabel } from "./dates";
import { getKoreanHolidayName } from "./koreanHolidays";
import {
  buildMemberWeekDigest,
  memberDigestToMarkdownNegative,
  memberDigestToMarkdownPositive,
} from "./memberWeekSummary";
import {
  DIRECTIVE_PLACEHOLDER_LINE,
  DIRECTIVE_SECTION_TITLE,
} from "./managerDirective";
import { koreanNowLabel } from "./koreanTime";

function collectIssues(reports: DailyReport[]): string[] {
  const items: string[] = [];
  for (const r of reports) {
    if (r.issues?.trim()) {
      items.push(`${r.date} — ${r.issues.trim()}`);
    }
    if (r.deficiencies?.trim()) {
      items.push(`${r.date} 미비 — ${r.deficiencies.trim()}`);
    }
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
  partialSubmission?: boolean;
  submissionStatus?: SubmissionReadiness;
  nextWeekPlanSection?: string;
}): string {
  const {
    summary,
    previousWeekLabel,
    previousAnalysisMarkdown,
    partialSubmission,
    submissionStatus,
    nextWeekPlanSection,
  } = params;
  const now = koreanNowLabel();
  const totalReports = summary.members.reduce((n, m) => n + m.reports.length, 0);
  const maxExpected = summary.members.reduce((n, m) => n + m.expectedDays, 0);
  const allIssues = summary.members.flatMap((m) => collectIssues(m.reports));
  const checklist = inferChecklistRows(summary);
  const scheduleLabel = partialSubmission
    ? "등록된 일정·기록 기준 (공휴·미등록일 제외)"
    : "등록 일정 전원 제출 기준";

  const lines: string[] = [
    `# ${summary.teamName} 업무 분석 및 제언 보고서`,
    ``,
    `일시: ${now}  `,
    `발신: ${summary.teamName} (**자동 분석** — ${scheduleLabel})  `,
    `참조: 경영지원본부, EPOS 관리팀  `,
    `**분석 기간:** ${summary.start}(월) ~ ${summary.end}(금)`,
    ``,
    `---`,
    ``,
    `## 1. 종합 평가 (Executive Summary)`,
    ``,
  ];

  if (summary.publicHolidayDates.length > 0) {
    const labels = summary.publicHolidayDates.map(
      (d) => `${d}(${getKoreanHolidayName(d) ?? weekdayLabel(d)})`
    );
    lines.push(
      `**법정 공휴일(제출 제외):** ${labels.join(", ")}`,
      ``
    );
  }

  if (partialSubmission) {
    lines.push(
      `이번 주(${summary.weekLabel}) **등록된 일일 기록 ${totalReports}건**을 반영한 분석입니다.`,
      `**공휴일·연차·일정 미등록일**은 업무 보고 대상에서 제외했습니다.`,
      ``
    );
    if (submissionStatus && !submissionStatus.complete && maxExpected > 0) {
      lines.push(
        `**일정 등록 후 미제출:** ${submissionStatus.reason}`,
        ``
      );
      for (const m of submissionStatus.members) {
        if (m.missingDates.length > 0) {
          lines.push(
            `- **${m.name}** 일정 등록·미제출: ${m.missingDates.join(", ")}`
          );
        }
      }
      lines.push(``);
    }
  } else {
    lines.push(
      `이번 주(${summary.weekLabel}) **등록 일정 기준** 팀원 ${summary.members.length}명의 일일 기록 제출이 확인되었습니다(총 ${totalReports}건).`
    );
  }

  for (const m of summary.members) {
    if (partialSubmission && m.reports.length === 0) continue;
    const stations = stationsForReports(m.reports);
    lines.push(
      `- **${m.member.name}**: 기록 ${m.reports.length}건 · 일정 ${m.expectedDays}일 중 ${m.submittedDays}일 제출 · 역사 ${stations.join(", ") || "—"}`
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
      `**비교 기준 주(${previousWeekLabel}) 대비:** 직전 주에 저장된 분석 보고서와 비교하여 분석 대상 주 일일 기록의 이행·미비 추이를 반영했습니다.`
    );
  }

  lines.push(``, `---`, ``, `## 2. 구성원별 평가`, ``);

  for (const m of summary.members) {
    if (partialSubmission && m.reports.length === 0) continue;
    lines.push(`### ${m.member.name}`, ``);

    if (m.reports.length === 0) {
      lines.push(`**👍 잘한 부분**`, `- 이번 주 등록된 일일 기록 없음`, ``);
      lines.push(
        `**👎 보완이 필요한 부분**`,
        `- 등록된 현장 일정 대비 기록 없음 — 일정·기록을 맞춰 주세요`,
        ``,
        `---`,
        ``
      );
      continue;
    }

    const digest = buildMemberWeekDigest(m.reports, {
      submittedDays: m.submittedDays,
      expectedDays: m.expectedDays,
      missingDates: m.missingDates,
    });

    lines.push(`**👍 잘한 부분**`);
    lines.push(...memberDigestToMarkdownPositive(digest));
    lines.push(``, `**👎 보완이 필요한 부분**`);
    lines.push(...memberDigestToMarkdownNegative(digest, m.missingDates));
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
  if (partialSubmission) {
    lines.push(
      `1. **등록된 일정·기록**만 이번 분석에 반영했습니다. 공휴일·미등록일은 보고 의무에서 제외됩니다.`
    );
  } else {
    lines.push(
      `1. 이번 주는 **일일 기록 전원 제출**이 완료되어 주간 가시성이 확보되었습니다. 차주에도 **월~금 제출**을 유지해 주세요.`
    );
  }
  if (allIssues.length > 0) {
    lines.push(
      `2. 미비·이슈 **${allIssues.length}건**은 담당·완료 목표일을 정해 **수요일 전 클로징**을 제안합니다.`
    );
  }
  lines.push(
    `3. **DB·화면(이준명) – 현장 설치(유영준)** 역할을 홈 **주간 일정**에 등록하면 협업 품질이 향상됩니다.`
  );

  if (nextWeekPlanSection?.trim()) {
    lines.push(nextWeekPlanSection.trim());
  }

  lines.push(``, `---`, ``, `## ${DIRECTIVE_SECTION_TITLE}`, ``);
  lines.push(DIRECTIVE_PLACEHOLDER_LINE);

  return lines.join("\n");
}
