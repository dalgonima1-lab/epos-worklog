export const SAFETY_PRECHECK_FORM_TEMPLATES = [
  {
    id: "daily_cross_safety_check",
    title: "일일 크로스 안전점검표",
    sourceName: "3. 일일 크로스 안전점검표_비치.hwp",
  },
  {
    id: "safety_management_daily_checklist",
    title: "안전관리이행 및 일일 체크리스트(역사전기)",
    sourceName: "4. 안전관리이행 및 일일 체크리스트(역사전기)(현장비치).hwp",
  },
  {
    id: "alcohol_test_check",
    title: "음주측정 점검표",
    sourceName: "5. 음주측정 점검표_비치.hwp",
  },
  {
    id: "daily_work_plan_submit",
    title: "일일 작업계획서 (작업 전 역무실 제출)",
    sourceName: "1. 일일 작업계획서_작업 전 역무실에 제출.hwp",
  },
  {
    id: "safety_education_log",
    title: "안전교육 일지",
    sourceName: "2. 안전교육 일지_비치.hwp",
  },
] as const;

export interface SafetyPrecheckFormRecord {
  id: string;
  title: string;
  completed: boolean;
  /** 점검 체크 항목 요약 */
  checkSummary?: string;
  /** 점검자 */
  checkerName?: string;
  /** 점검자 서명 */
  checkerSignature?: string;
  /** 확인자 */
  approverName?: string;
  /** 확인자 서명 */
  approverSignature?: string;
  /** 점검/작성 시각 (YYYY-MM-DD HH:mm) */
  checkedAt?: string;
  /** 특이사항 */
  note?: string;
}

export interface SafetyPrecheckRecord {
  forms: SafetyPrecheckFormRecord[];
  safetyPhotoDataUrls?: string[];
  updatedAt: string;
}

export function createDefaultSafetyPrecheckForms(): SafetyPrecheckFormRecord[] {
  return SAFETY_PRECHECK_FORM_TEMPLATES.map((item) => ({
    id: item.id,
    title: item.title,
    completed: false,
    checkSummary: "",
    checkerName: "",
    checkerSignature: "",
    approverName: "",
    approverSignature: "",
    checkedAt: "",
    note: "",
  }));
}

export function normalizeSafetyPrecheck(
  input: unknown
): SafetyPrecheckRecord | undefined {
  if (!input || typeof input !== "object") return undefined;
  const raw = input as {
    forms?: Array<{
      id?: string;
      title?: string;
      completed?: boolean;
      checkSummary?: string;
      checkerName?: string;
      checkerSignature?: string;
      approverName?: string;
      approverSignature?: string;
      checkedAt?: string;
      note?: string;
    }>;
    safetyPhotoDataUrls?: string[];
    updatedAt?: string;
  };
  const byId = new Map(
    (raw.forms ?? [])
      .map((f) => ({
        id: String(f.id ?? "").trim(),
        title: String(f.title ?? "").trim(),
        completed: Boolean(f.completed),
        checkSummary: String(f.checkSummary ?? "").trim(),
        checkerName: String(f.checkerName ?? "").trim(),
        checkerSignature: String(f.checkerSignature ?? "").trim(),
        approverName: String(f.approverName ?? "").trim(),
        approverSignature: String(f.approverSignature ?? "").trim(),
        checkedAt: String(f.checkedAt ?? "").trim(),
        note: String(f.note ?? "").trim(),
      }))
      .filter((f) => f.id)
      .map((f) => [f.id, f] as const)
  );
  const forms = SAFETY_PRECHECK_FORM_TEMPLATES.map((tpl) => {
    const found = byId.get(tpl.id);
    return {
      id: tpl.id,
      title: tpl.title,
      completed: found?.completed ?? false,
      checkSummary: found?.checkSummary ?? "",
      checkerName: found?.checkerName ?? "",
      checkerSignature: found?.checkerSignature ?? "",
      approverName: found?.approverName ?? "",
      approverSignature: found?.approverSignature ?? "",
      checkedAt: found?.checkedAt ?? "",
      note: found?.note ?? "",
    };
  });
  const photos = Array.isArray(raw.safetyPhotoDataUrls)
    ? raw.safetyPhotoDataUrls
        .map((u) => String(u ?? "").trim())
        .filter((u) => u.startsWith("data:image/"))
        .slice(0, 3)
    : [];
  return {
    forms,
    safetyPhotoDataUrls: photos.length ? photos : undefined,
    updatedAt: String(raw.updatedAt ?? new Date().toISOString()),
  };
}
