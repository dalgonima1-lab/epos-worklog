"use client";

import { useMemo, useRef, useState, type ChangeEvent } from "react";
import { compressImageForUpload } from "@/lib/imageCompress";
import {
  SAFETY_PRECHECK_FORM_TEMPLATES,
  type SafetyPrecheckFormRecord,
} from "@/lib/safetyPrecheck";

interface SafetyPrecheckFormProps {
  date: string;
  memberName: string;
  stationName: string;
  facilityArea: string;
  processingRole: string;
  forms: SafetyPrecheckFormRecord[];
  photoDataUrls: string[];
  disabled?: boolean;
  onChangeForms: (next: SafetyPrecheckFormRecord[]) => void;
  onChangePhotos: (next: string[]) => void;
}

export function SafetyPrecheckForm({
  date,
  memberName,
  stationName,
  facilityArea,
  processingRole,
  forms,
  photoDataUrls,
  disabled,
  onChangeForms,
  onChangePhotos,
}: SafetyPrecheckFormProps) {
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null);
  const [error, setError] = useState("");
  const galleryRefs = useRef<Array<HTMLInputElement | null>>([]);
  const cameraRefs = useRef<Array<HTMLInputElement | null>>([]);

  const completedCount = useMemo(
    () => forms.filter((f) => f.completed).length,
    [forms]
  );

  function updateForm(
    id: string,
    patch: Partial<Pick<SafetyPrecheckFormRecord, "completed" | "note">>
  ) {
    onChangeForms(
      forms.map((f) => (f.id === id ? { ...f, ...patch } : f))
    );
  }

  async function handlePickPhoto(index: number, file?: File) {
    if (!file) return;
    setError("");
    setUploadingIndex(index);
    try {
      const compressed = await compressImageForUpload(file);
      const dataUrl = await fileToDataUrl(compressed);
      const next = [...photoDataUrls];
      next[index] = dataUrl;
      onChangePhotos(next.slice(0, 3));
    } catch {
      setError("사진 처리 중 오류가 발생했습니다. 다시 시도해 주세요.");
    } finally {
      setUploadingIndex(null);
    }
  }

  function clearPhoto(index: number) {
    const next = [...photoDataUrls];
    next[index] = "";
    onChangePhotos(next.slice(0, 3));
  }

  function printSafetyDocs() {
    document.documentElement.classList.add("printing-safety-precheck");
    window.print();
    window.setTimeout(() => {
      document.documentElement.classList.remove("printing-safety-precheck");
    }, 200);
  }

  return (
    <section className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4 safety-precheck-print-area">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-bold text-emerald-950">
          작업 전 필수 안전서류 (중대재해처벌법 대응)
        </h2>
        <button
          type="button"
          className="btn btn-secondary text-xs no-print"
          onClick={printSafetyDocs}
          disabled={disabled}
        >
          양식 인쇄 / PDF 저장
        </button>
      </div>
      <p className="mt-2 text-xs text-emerald-900/90">
        조명제어시스템 작업 전(전기실·역무실·변전소) 서류 5종 작성 후, 안전장구류
        착용 사진 3장을 남겨 주세요.
      </p>
      <p className="mt-1 text-xs text-emerald-800">
        작성 진행: <strong>{completedCount}</strong> / {forms.length}
      </p>

      <div className="mt-3 space-y-3">
        {SAFETY_PRECHECK_FORM_TEMPLATES.map((tpl) => {
          const item = forms.find((f) => f.id === tpl.id) ?? {
            id: tpl.id,
            title: tpl.title,
            completed: false,
            note: "",
          };
          return (
            <div
              key={tpl.id}
              className="rounded-lg border border-emerald-200 bg-white p-3"
            >
              <label className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900">
                <input
                  type="checkbox"
                  checked={item.completed}
                  disabled={disabled}
                  onChange={(e) =>
                    updateForm(item.id, { completed: e.target.checked })
                  }
                />
                {tpl.title}
              </label>
              <p className="mt-1 text-xs text-slate-500">{tpl.sourceName}</p>
              <textarea
                className="textarea mt-2 min-h-[72px]"
                placeholder="작성 내용/비고 (선택)"
                value={item.note ?? ""}
                disabled={disabled}
                onChange={(e) => updateForm(item.id, { note: e.target.value })}
              />
            </div>
          );
        })}
      </div>

      <div className="mt-4">
        <h3 className="text-sm font-semibold text-slate-900">
          작업 전 안전장구류 착용 사진 (3장)
        </h3>
        <div className="mt-2 grid gap-3 sm:grid-cols-3">
          {[0, 1, 2].map((idx) => {
            const url = photoDataUrls[idx];
            const loading = uploadingIndex === idx;
            return (
              <div key={idx} className="rounded-lg border border-slate-200 bg-white p-2">
                <p className="text-xs font-medium text-slate-700">사진 {idx + 1}</p>
                <div className="mt-1 flex h-28 items-center justify-center overflow-hidden rounded border border-slate-200 bg-slate-50">
                  {url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={url} alt={`안전장구류 착용 사진 ${idx + 1}`} className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-xs text-slate-500">미등록</span>
                  )}
                </div>
                <input
                  ref={(el) => {
                    galleryRefs.current[idx] = el;
                  }}
                  type="file"
                  className="hidden"
                  accept="image/*"
                  disabled={disabled || loading}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => {
                    void handlePickPhoto(idx, e.target.files?.[0]);
                    e.target.value = "";
                  }}
                />
                <input
                  ref={(el) => {
                    cameraRefs.current[idx] = el;
                  }}
                  type="file"
                  className="hidden"
                  accept="image/*"
                  capture="environment"
                  disabled={disabled || loading}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => {
                    void handlePickPhoto(idx, e.target.files?.[0]);
                    e.target.value = "";
                  }}
                />
                <div className="mt-2 flex flex-wrap gap-1">
                  <button
                    type="button"
                    className="btn btn-secondary px-2 py-1 text-xs"
                    disabled={disabled || loading}
                    onClick={() => galleryRefs.current[idx]?.click()}
                  >
                    앨범
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary px-2 py-1 text-xs"
                    disabled={disabled || loading}
                    onClick={() => cameraRefs.current[idx]?.click()}
                  >
                    카메라
                  </button>
                  {url ? (
                    <button
                      type="button"
                      className="btn btn-ghost px-2 py-1 text-xs"
                      disabled={disabled || loading}
                      onClick={() => clearPhoto(idx)}
                    >
                      삭제
                    </button>
                  ) : null}
                </div>
                {loading ? (
                  <p className="mt-1 text-xs text-slate-500">처리 중…</p>
                ) : null}
              </div>
            );
          })}
        </div>
        {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
      </div>

      <div className="safety-precheck-print mt-4 rounded-lg border border-slate-300 bg-white p-3">
        <h3 className="text-base font-bold">현장 작업 전 안전서류 출력본</h3>
        <p className="mt-1 text-sm text-slate-700">
          날짜: {date || "-"} / 작성자: {memberName || "-"}
        </p>
        <p className="text-sm text-slate-700">
          역사: {stationName || "-"} / 작업장소: {facilityArea || "-"} / 공종:{" "}
          {processingRole || "-"}
        </p>
        <table className="mt-3 w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="border border-slate-300 px-2 py-1 text-left">양식</th>
              <th className="border border-slate-300 px-2 py-1 text-center">작성</th>
              <th className="border border-slate-300 px-2 py-1 text-left">비고</th>
            </tr>
          </thead>
          <tbody>
            {forms.map((f) => (
              <tr key={f.id}>
                <td className="border border-slate-300 px-2 py-1">{f.title}</td>
                <td className="border border-slate-300 px-2 py-1 text-center">
                  {f.completed ? "작성완료" : "미작성"}
                </td>
                <td className="border border-slate-300 px-2 py-1 whitespace-pre-wrap">
                  {f.note?.trim() || "-"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("file read failed"));
    reader.readAsDataURL(file);
  });
}
