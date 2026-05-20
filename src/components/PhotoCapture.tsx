"use client";

import { useRef, useState } from "react";
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
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const cacheBust = recordedAt ? `&t=${encodeURIComponent(recordedAt)}` : "";
  const serverUrl =
    memberId && date && hasPhoto
      ? `${photoApiUrl(memberId, date, slot)}${cacheBust}`
      : null;

  async function handleFile(file: File) {
    setError("");
    const capturedAt = new Date().toISOString();
    setPreview(URL.createObjectURL(file));
    setUploading(true);

    const form = new FormData();
    form.append("memberId", memberId);
    form.append("date", date);
    form.append("slot", slot);
    form.append("recordedAt", capturedAt);
    form.append("file", file);

    try {
      const res = await fetch("/api/reports/photo", {
        method: "POST",
        body: form,
      });
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
      setError("네트워크 오류로 업로드하지 못했습니다.");
    } finally {
      setUploading(false);
    }
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
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        disabled={disabled || uploading || !memberId}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = "";
        }}
      />

      <button
        type="button"
        className="btn btn-secondary mt-2 w-full text-sm"
        disabled={disabled || uploading || !memberId}
        onClick={() => inputRef.current?.click()}
      >
        {hasPhoto || preview ? "사진 다시 등록" : "앨범·카메라에서 선택"}
      </button>
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
