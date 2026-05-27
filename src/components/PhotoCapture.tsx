"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { compressImageForUpload } from "@/lib/imageCompress";
import { formatDateTime, formatWorkDuration } from "@/lib/workTime";
import { photoApiUrl } from "@/lib/photoUrl";

interface PhotoCaptureProps {
  label: string;
  slot: "before" | "after";
  memberId: string;
  date: string;
  recordedAt?: string;
  hasPhoto?: boolean;
  disabled?: boolean;
  onUploaded: (data: {
    recordedAt: string;
    workMinutes: number | null;
    photoUrl: string;
  }) => void;
}

export function PhotoCapture({
  label,
  slot,
  memberId,
  date,
  recordedAt,
  hasPhoto,
  disabled,
  onUploaded,
}: PhotoCaptureProps) {
  /** 갤러리·파일 선택 (capture 없음 — 일부 기기에서 단일 input이 카메라로만 열리는 것 방지) */
  const galleryInputRef = useRef<HTMLInputElement>(null);
  /** 카메라 직촬 */
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const cacheBust = recordedAt ? `&t=${encodeURIComponent(recordedAt)}` : "";
  const serverUrl =
    memberId && date && hasPhoto
      ? `${photoApiUrl(memberId, date, slot)}${cacheBust}`
      : null;

  async function uploadWithRetry(form: FormData, attempts = 3): Promise<Response> {
    let lastErr: unknown;
    for (let i = 0; i < attempts; i++) {
      try {
        const res = await fetch("/api/reports/photo", {
          method: "POST",
          body: form,
        });
        if (res.ok || res.status < 500) return res;
      } catch (e) {
        lastErr = e;
      }
      if (i < attempts - 1) {
        await new Promise((r) => setTimeout(r, 800 * (i + 1)));
      }
    }
    if (lastErr) throw lastErr;
    throw new Error("upload failed");
  }

  async function handleFile(file: File) {
    setError("");
    const capturedAt = new Date().toISOString();
    setUploading(true);

    let uploadFile = file;
    try {
      uploadFile = await compressImageForUpload(file);
    } catch {
      uploadFile = file;
    }

    setPreview(URL.createObjectURL(uploadFile));

    const form = new FormData();
    form.append("memberId", memberId);
    form.append("date", date);
    form.append("slot", slot);
    form.append("recordedAt", capturedAt);
    form.append("file", uploadFile);

    try {
      const res = await uploadWithRetry(form);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "업로드 실패");
        return;
      }
      onUploaded({
        recordedAt: data.recordedAt,
        workMinutes: data.workMinutes,
        photoUrl: data.photoUrl,
      });
    } catch {
      setError("네트워크 오류로 업로드하지 못했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setUploading(false);
    }
  }

  const inputDisabled = disabled || uploading || !memberId;

  function onPickFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) void handleFile(file);
    e.target.value = "";
  }

  return (
    <div className="photo-card">
      <div className="flex items-center justify-between gap-2">
        <p className="font-semibold text-sm">{label}</p>
        {uploading && <span className="muted text-xs">업로드 중…</span>}
      </div>

      <div className="photo-preview mt-2">
        {preview || serverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview ?? serverUrl!} alt={label} />
        ) : (
          <span className="muted text-xs">사진 미등록</span>
        )}
      </div>

      <p className="muted mt-2 text-xs">
        등록 시각: <strong>{formatDateTime(recordedAt)}</strong>
      </p>

      <input
        ref={galleryInputRef}
        type="file"
        accept="image/jpeg,image/jpg,image/png,image/webp,image/heic,image/heif,.jpg,.jpeg,.png,.webp,.heic,.heif"
        className="hidden"
        disabled={inputDisabled}
        onChange={onPickFile}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        disabled={inputDisabled}
        onChange={onPickFile}
      />

      <div className="mt-2 flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          className="btn btn-secondary flex-1 text-sm"
          disabled={inputDisabled}
          onClick={() => galleryInputRef.current?.click()}
        >
          {hasPhoto || preview ? "앨범에서 다시 선택" : "앨범·파일에서 선택"}
        </button>
        <button
          type="button"
          className="btn btn-secondary flex-1 text-sm"
          disabled={inputDisabled}
          onClick={() => cameraInputRef.current?.click()}
        >
          {hasPhoto || preview ? "카메라로 다시 촬영" : "카메라로 촬영"}
        </button>
      </div>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

/** 작업시간 표시 박스 */
export function WorkTimeDisplay({
  beforeAt,
  afterAt,
  workMinutes,
}: {
  beforeAt?: string;
  afterAt?: string;
  workMinutes?: number | null;
}) {
  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm">
      <p className="font-semibold text-blue-900">작업 시간 (자동 산정)</p>
      <div className="mt-2 grid gap-1 text-blue-900/90">
        <p>작업 전: {formatDateTime(beforeAt)}</p>
        <p>작업 후: {formatDateTime(afterAt)}</p>
        <p className="mt-1 text-base font-bold">
          소요: {formatWorkDuration(workMinutes)}
        </p>
      </div>
      {!beforeAt || !afterAt ? (
        <p className="muted mt-2 text-xs">
          작업 전·후 사진을 모두 등록하면 자동으로 계산됩니다.
        </p>
      ) : null}
    </div>
  );
}
