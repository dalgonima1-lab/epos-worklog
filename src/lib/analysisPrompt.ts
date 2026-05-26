export function buildAnalysisPrompt(params: {
  teamName: string;
  weekTitle: string;
  currentWeekLabel: string;
  previousWeekLabel: string;
  currentWeekData: string;
  previousWeekData: string;
  previousAnalysisText: string;
  managerNotes: string;
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
    managerNotes,
    strategicChecklist,
  } = params;

  return `당신은 EPOS 관리팀의 주간 업무 분석 전문가입니다.
대표님·경영진 보고용 「업무 분석 및 제언 보고서」를 작성합니다.

## 보고서 형식 (반드시 준수)
아래 구조와 톤으로 Markdown 보고서를 작성하세요. 이모지(👍 👎)를 사용합니다.

# ${weekTitle}

일시: ${new Date().toLocaleDateString("ko-KR")}  
발신: ${teamName} (AI 통합 전략 분석)  
참조: 경영지원본부, 개발부, EPOS 관리팀

## 1. 종합 평가 (Executive Summary)
- 이번 주(${currentWeekLabel}) 팀 전체 성과를 3~5문장으로 요약
- 지난주(${previousWeekLabel}) 제언·전략 과제 대비 체질 개선 여부 평가
- 긍정적 변화와 리스크를 균형 있게 기술

## 2. 구성원별 성과 및 보완 과제 정밀 분석
각 팀원마다 아래 형식:

### ■ {이름} ({한 줄 역할/포지션 요약})
#### 👍 잘한 부분 (이행 성과)
- 구체적 업무·성과 bullet 2~4개 (일일 기록 근거)
#### 👎 부족한 부분 (개선 과제)
- 구체적 미비·반복 이슈 bullet 2~3개 (일일 기록·미비사항 근거)

## 3. 핵심 전략 과제 이행 여부 체크리스트
반드시 아래 5열 Markdown 표를 사용 (각 행마다 근거·조치를 구체적으로):
| No | 전략 과제 | 이행 | ${currentWeekLabel} 현황·근거 | 차주 조치·권고 |
이행 열: **○**(우수·완료), **△**(보통·진행중·일부미완), **X**(미흡·지연) 만 사용
현황·근거: 일일 기록·역사·담당자·일자를 1~2문장으로
차주 조치: 미완·△ 항목은 담당·완료 목표일 포함

## 4. 대표님 의사결정을 위한 최종 제언
- 차주 강력 지시가 필요한 사항 2~3가지 (번호 목록)
- 조직 리소스 낭비 차단·운영 효율 관점

## 5. 팀장 첨언 및 추가 지시 사항
- 팀장이 아래에 제공한 메모를 반영·정리
- 보고서 톤에 맞게 문장 다듬기

---

## 입력 데이터

### [A] 이번 주(${currentWeekLabel}) 팀원 일일 업무 기록
${currentWeekData}

### [B] 지난주(${previousWeekLabel}) 팀원 일일 업무 기록 (비교용)
${previousWeekData || "(지난주 일일 기록 없음)"}

### [C] 지난주 업무 분석·제언 보고서 (비교 기준)
${previousAnalysisText || "(지난주 분석 보고서 미제공 — 일일 기록만으로 추론)"}

### [D] 지난주 핵심 전략 과제 목록 (체크리스트용)
${strategicChecklist || "(별도 미제공 — [C] 보고서에서 추출하여 체크리스트 작성)"}

### [E] 팀장 첨언·추가 지시 초안
${managerNotes || "(없음 — [5] 섹션은 '추가 첨언 없음'으로 간략히 기술)"}

---

## 작성 규칙
- 반드시 한국어, 경영 보고서 문체
- 일일 기록에 없는 내용은 추측하지 말고 "기록상 확인되지 않음"으로 표기
- 인명은 일일 기록·지난주 보고서에 나온 이름을 사용
- 과장하지 말고 데이터 기반으로 작성
- Markdown만 출력 (코드블록 감싸지 말 것)`;
}
