import { DIRECTIVE_PLACEHOLDER_LINE } from "./managerDirective";
import { koreanNowLabel } from "./koreanTime";

export function buildAnalysisPrompt(params: {
  teamName: string;
  weekTitle: string;
  currentWeekLabel: string;
  previousWeekLabel: string;
  currentWeekData: string;
  previousWeekData: string;
  previousAnalysisText: string;
  /** 분석 생성 시 참고할 내부 메모 (보고서 본문·5번 섹션에 넣지 말 것) */
  generationNotes?: string;
  /** 차주 일정·계획 (4-1절 작성용) */
  nextWeekPlanData?: string;
  strategicChecklist: string;
}): string {
  const {
    teamName,
    weekTitle,
    currentWeekLabel,
    previousWeekLabel,
    currentWeekData,
    previousWeekData,
    previousAnalysisText,
    generationNotes,
    nextWeekPlanData,
    strategicChecklist,
  } = params;

  return `당신은 EPOS 관리팀의 주간 업무 분석 전문가입니다.
대표님·경영진 보고용 「업무 분석 및 제언 보고서」를 작성합니다.

## 보고서 형식 (반드시 준수)
아래 구조와 톤으로 Markdown 보고서를 작성하세요. 이모지(👍 👎)를 사용합니다.

# ${weekTitle}

일시: ${koreanNowLabel()}  
발신: ${teamName} (AI 통합 전략 분석)  
참조: 경영지원본부, 개발부, EPOS 관리팀

## 1. 종합 평가 (Executive Summary)
- **분석 대상 주**(${currentWeekLabel}) 팀 전체 성과를 3~5문장으로 요약
- **비교 기준 주**(${previousWeekLabel})에 저장된 분석·제언·전략 과제 대비 체질 개선 여부 평가
- 긍정적 변화와 리스크를 균형 있게 기술

## 2. 구성원별 성과 및 보완 과제 정밀 분석
각 팀원마다 아래 형식 (일일 기록 원문을 그대로 붙여넣지 말 것):

### ■ {이름} ({한 줄 역할/포지션 요약})

**👍 잘한 부분**
먼저 1줄로 제출·역사 현황을 요약한 bullet 한 개를 쓴 뒤, **주간 활동 요약** Markdown 표를 작성:
| 일자 | 역사·장소 | 공종 | 핵심 성과 |
각 행은 해당 날짜 업무를 1~2문장으로 압축·재작성 (원문 복사 금지)
이어서 **핵심 성과 요약** bullet 3~5개 — 업무 유형(관제·DB, 현장, A/S, 유지보수 등)별로 묶어 성과만 기술

**👎 보완이 필요한 부분**
미비·이슈가 있으면 **미비·이슈 요약** Markdown 표:
| 일자 | 구분 | 내용 |
구분: 이슈 / 미비 / 유지보수 특이
bullet 2~4개로 반복·리스크·차주 조치 방향 요약 (원문 복사 금지)

## 3. 핵심 전략 과제 이행 여부 체크리스트
반드시 아래 5열 Markdown 표를 사용 (각 행마다 근거·조치를 구체적으로):
| No | 전략 과제 | 이행 | ${currentWeekLabel} 현황·근거 | 차주 조치·권고 |
이행 열: **○**(우수·완료), **△**(보통·진행중·일부미완), **X**(미흡·지연) 만 사용
현황·근거: 일일 기록·역사·담당자·일자를 1~2문장으로
차주 조치: 미완·△ 항목은 담당·완료 목표일 포함

## 4. 대표님 의사결정을 위한 최종 제언
- 차주 강력 지시가 필요한 사항 2~3가지 (번호 목록)
- 조직 리소스 낭비 차단·운영 효율 관점

## 4-1. 차주 업무 계획
- [F] 차주 일정·계획 데이터를 바탕으로 구성원별 차주 예정 업무를 표 또는 bullet로 정리
- 등록된 일정·메모가 없으면 "등록된 차주 계획 없음"으로 간략히 기술

## 5. 팀장, 대표님 첨언 및 지시사항
- **이 섹션은 팀장·대표님이 보고서 확인 후 별도로 작성합니다.**
- 아래 한 줄만 그대로 출력하고 다른 문장·bullet을 추가하지 마세요:
- ${DIRECTIVE_PLACEHOLDER_LINE}

---

## 입력 데이터

### [A] 분석 대상 주(${currentWeekLabel}) 팀원 일일 업무 기록
${currentWeekData}

### [B] 비교 기준 주(${previousWeekLabel}) 팀원 일일 업무 기록 (참고)
${previousWeekData || "(해당 주 일일 기록 없음)"}

### [C] 비교 기준 주(${previousWeekLabel}) 업무 분석·제언 보고서 (전주 저장본)
${previousAnalysisText || "(비교 기준 보고서 미제공 — [A] 일일 기록만으로 추론)"}

### [D] 비교 기준 주 핵심 전략 과제 목록 (체크리스트용)
${strategicChecklist || "(별도 미제공 — [C] 보고서에서 추출하여 체크리스트 작성)"}

### [E] 분석 생성 참고 메모 (보고서 본문·5번 섹션에 반영 금지)
${generationNotes || "(없음)"}

### [F] 차주(다음 주) 일정·계획 (4-1절 작성용)
${nextWeekPlanData || "(차주 일정·계획 메모 없음)"}

---

## 작성 규칙
- 반드시 한국어, 경영 보고서 문체
- 일일 기록에 없는 내용은 추측하지 말고 "기록상 확인되지 않음"으로 표기
- 인명은 일일 기록·[C] 비교 기준 보고서에 나온 이름을 사용
- 과장하지 말고 데이터 기반으로 작성
- **구성원별 👍/👎 섹션에서 일일 기록 원문·bullet 나열을 금지** — 표와 요약 bullet만 사용
- **5번 섹션은 placeholder 한 줄만 출력** — 팀장·대표 첨언을 AI가 작성하지 말 것
- Markdown만 출력 (코드블록 감싸지 말 것)`;
}
