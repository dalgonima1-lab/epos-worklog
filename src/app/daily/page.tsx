"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Header } from "@/components/Header";
import { isSecurityTestPlaceholder } from "@/lib/sanitizeTestData";
import {
  isStationFacilityArea,
  type StationFacilityArea,
} from "@/lib/stationFacility";
import { PhotoCapture, WorkTimeDisplay } from "@/components/PhotoCapture";
import { StationPicker } from "@/components/StationPicker";
import {
  DEFAULT_TEAM_MEMBERS,
  DEFAULT_TEAM_NAME,
  PROCESSING_ROLES,
} from "@/lib/constants";
import { formatDate } from "@/lib/dates";
import { calcWorkMinutes } from "@/lib/workTime";

const ROLE_OTHER = "\uae30\ud0c0";

interface Member {
  id: string;
  name: string;
}

const DEFAULT_WRITERS: Member[] = DEFAULT_TEAM_MEMBERS.filter(
  (m) => m.role === "member"
);

function DailyPageInner() {
  const searchParams = useSearchParams();
  const [teamName, setTeamName] = useState(DEFAULT_TEAM_NAME);
  const [members, setMembers] = useState<Member[]>(DEFAULT_WRITERS);
  const [memberId, setMemberId] = useState(
    () => searchParams.get("memberId") ?? DEFAULT_WRITERS[0]?.id ?? ""
  );
  const [date, setDate] = useState(
    () => searchParams.get("date") ?? formatDate(new Date())
  );
  const [stationName, setStationName] = useState(
    () => searchParams.get("station")?.trim() ?? ""
  );
  const [facilityArea, setFacilityArea] = useState<StationFacilityArea | "">(
    () => {
      const q = searchParams.get("facility")?.trim() ?? "";
      return isStationFacilityArea(q) ? q : "";
    }
  );
  const [processingRole, setProcessingRole] = useState("");
  const [customRole, setCustomRole] = useState("");
  const [done, setDone] = useState("");
  const [plan, setPlan] = useState("");
  const [issues, setIssues] = useState("");
  const [deficiencies, setDeficiencies] = useState("");
  const [beforePhotoAt, setBeforePhotoAt] = useState<string | undefined>();
  const [afterPhotoAt, setAfterPhotoAt] = useState<string | undefined>();
  const [hasBeforePhoto, setHasBeforePhoto] = useState(false);
  const [hasAfterPhoto, setHasAfterPhoto] = useState(false);
  const [workMinutes, setWorkMinutes] = useState<number | null>(null);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  const effectiveRole =
    processingRole === ROLE_OTHER ? customRole.trim() : processingRole;

  useEffect(() => {
    fetch("/api/members")
      .then((r) => r.json())
      .then((data) => {
        const writers = data.members?.length ? data.members : DEFAULT_WRITERS;
        setTeamName(data.teamName ?? DEFAULT_TEAM_NAME);
        setMembers(writers);
        if (!memberId && writers.length) {
          setMemberId(writers[0].id);
        }
      })
      .catch(() => {
        setTeamName(DEFAULT_TEAM_NAME);
        setMembers(DEFAULT_WRITERS);
        if (!memberId) {
          setMemberId(DEFAULT_WRITERS[0]?.id ?? "");
        }
      });
  }, [memberId]);

  useEffect(() => {
    const qDate = searchParams.get("date");
    const qMember = searchParams.get("memberId");
    const qStation = searchParams.get("station");
    const qFacility = searchParams.get("facility")?.trim() ?? "";
    if (qDate) setDate(qDate);
    if (qMember) setMemberId(qMember);
    if (qStation) setStationName(qStation);
    if (isStationFacilityArea(qFacility)) setFacilityArea(qFacility);
  }, [searchParams]);

  useEffect(() => {
    if (!memberId || !date) return;
    const stationFromSchedule = searchParams.get("station")?.trim() ?? "";
    const facilityFromSchedule = searchParams.get("facility")?.trim() ?? "";
    setLoading(true);
    setBeforePhotoAt(undefined);
    setAfterPhotoAt(undefined);
    setHasBeforePhoto(false);
    setHasAfterPhoto(false);
    fetch(`/api/reports?memberId=${memberId}&date=${date}`)
      .then((r) => r.json())
      .then((data) => {
        const report = data.report;
        const role = report?.processingRole ?? "";
        if (
          PROCESSING_ROLES.includes(role as (typeof PROCESSING_ROLES)[number])
        ) {
          setProcessingRole(role);
          setCustomRole("");
        } else if (role) {
          setProcessingRole(ROLE_OTHER);
          setCustomRole(role);
        } else {
          setProcessingRole("");
          setCustomRole("");
        }
        const fromReport = report?.stationName?.trim() ?? "";
        const safeReportStation = isSecurityTestPlaceholder(fromReport)
          ? ""
          : fromReport;
        setStationName(safeReportStation || stationFromSchedule);
        const area = report?.facilityArea?.trim() ?? "";
        if (isStationFacilityArea(area)) {
          setFacilityArea(area);
        } else if (isStationFacilityArea(facilityFromSchedule)) {
          setFacilityArea(facilityFromSchedule);
        } else {
          setFacilityArea("");
        }
        if (stationFromSchedule && !fromReport) {
          void fetch("/api/stations", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: stationFromSchedule }),
          });
        }
        setDone(report?.done ?? "");
        setPlan(report?.plan ?? "");
        setIssues(report?.issues ?? "");
        setDeficiencies(report?.deficiencies ?? "");
        setBeforePhotoAt(report?.beforePhotoAt);
        setAfterPhotoAt(report?.afterPhotoAt);
        setHasBeforePhoto(!!report?.hasBeforePhoto);
        setHasAfterPhoto(!!report?.hasAfterPhoto);
        setWorkMinutes(
          report?.workMinutes ??
            calcWorkMinutes(report?.beforePhotoAt, report?.afterPhotoAt)
        );
      })
      .finally(() => setLoading(false));
  }, [memberId, date, searchParams]);

  function applyWorkTime(
    before?: string,
    after?: string,
    minutes?: number | null
  ) {
    if (before) setBeforePhotoAt(before);
    if (after) setAfterPhotoAt(after);
    setWorkMinutes(
      minutes ??
        calcWorkMinutes(before ?? beforePhotoAt, after ?? afterPhotoAt)
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!stationName.trim()) {
      setStatus("\uc5ed\uc0ac\uba85\uc744 \uc120\ud0dd\ud558\uac70\ub098 \uc785\ub825\ud574 \uc8fc\uc138\uc694.");
      return;
    }
    if (!facilityArea) {
      setStatus("작업 장소(전기실·변전소·역무실)를 선택해 주세요.");
      return;
    }
    if (!effectiveRole) {
      setStatus("\uacf5\uc885\uc744 \uc120\ud0dd\ud574 \uc8fc\uc138\uc694.");
      return;
    }
    setStatus("\uc800\uc7a5 \uc911...");
    const res = await fetch("/api/reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        memberId,
        date,
        stationName: stationName.trim(),
        facilityArea,
        processingRole: effectiveRole,
        done,
        plan,
        issues,
        deficiencies,
        beforePhotoAt,
        afterPhotoAt,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      setWorkMinutes(data.report?.workMinutes ?? workMinutes);
      setStatus("\uc800\uc7a5\ub418\uc5c8\uc2b5\ub2c8\ub2e4.");
    } else {
      const err = await res.json();
      setStatus(err.error ?? "\uc800\uc7a5\uc5d0 \uc2e4\ud328\ud588\uc2b5\ub2c8\ub2e4.");
    }
  }

  return (
    <>
      <Header
        teamName={teamName}
        subtitle={`${date} · 일일 업무 기록 · 사진·작업시간`}
      />
      <p className="muted -mt-4 mb-4 text-sm">
        <a href="/" className="link-accent">
          ← 홈 일정으로
        </a>
        {searchParams.get("station")?.trim() ? (
          <span className="ml-2">
            · 일정 역사 <strong>{searchParams.get("station")}</strong> 반영됨
          </span>
        ) : null}
      </p>

      <form onSubmit={handleSubmit} className="card space-y-5 p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="member">
              {"\uc791\uc131\uc790"}
            </label>
            <select
              id="member"
              className="select"
              value={memberId}
              onChange={(e) => setMemberId(e.target.value)}
            >
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="date">
              {"\ub0a0\uc9dc"}
            </label>
            <input
              id="date"
              type="date"
              className="input"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
        </div>

        <StationPicker
          value={stationName}
          onChange={setStationName}
          facilityArea={facilityArea}
          onFacilityChange={setFacilityArea}
          requireFacility
          disabled={loading}
        />

        <div>
          <label className="label" htmlFor="role">
            {"\uacf5\uc885 "}
            <span className="text-red-600">*</span>
          </label>
          <select
            id="role"
            className="select"
            value={processingRole}
            onChange={(e) => setProcessingRole(e.target.value)}
            disabled={loading}
          >
            <option value="">{"\uc120\ud0dd\ud558\uc138\uc694"}</option>
            {PROCESSING_ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          {processingRole === ROLE_OTHER && (
            <input
              className="input mt-2"
              placeholder={"\uacf5\uc885 \uc9c1\uc811 \uc785\ub825"}
              value={customRole}
              onChange={(e) => setCustomRole(e.target.value)}
              disabled={loading}
            />
          )}
        </div>

        <section>
          <h2 className="mb-3 text-sm font-bold">
            {"\uc791\uc5c5 \uc804\u00b7\ud6c4 \uc0ac\uc9c4"}
          </h2>
          <p className="muted mb-3 text-xs">
            {
              "\uc0ac\uc9c4\uc744 \ub4f1\ub85d\ud558\ub294 \uc21c\uac04 \uc791\uc5c5 \uc804/\ud6c4 \uc2dc\uac01\uc774 \uc790\ub3d9 \uae30\ub85d\ub418\uba70, \ub450 \uc2dc\uac01 \ucc28\uc774\ub85c \uc791\uc5c5 \uc2dc\uac04\uc774 \uc0b0\uc815\ub429\ub2c8\ub2e4."
            }
          </p>
          <div className="photo-grid">
            <PhotoCapture
              label={"\uc791\uc5c5 \uc804"}
              slot="before"
              memberId={memberId}
              date={date}
              recordedAt={beforePhotoAt}
              hasPhoto={hasBeforePhoto}
              disabled={loading}
              onUploaded={({ recordedAt, workMinutes }) => {
                setHasBeforePhoto(true);
                applyWorkTime(recordedAt, undefined, workMinutes);
              }}
            />
            <PhotoCapture
              label={"\uc791\uc5c5 \ud6c4"}
              slot="after"
              memberId={memberId}
              date={date}
              recordedAt={afterPhotoAt}
              hasPhoto={hasAfterPhoto}
              disabled={loading}
              onUploaded={({ recordedAt, workMinutes }) => {
                setHasAfterPhoto(true);
                applyWorkTime(undefined, recordedAt, workMinutes);
              }}
            />
          </div>
          <div className="mt-3">
            <WorkTimeDisplay
              beforeAt={beforePhotoAt}
              afterAt={afterPhotoAt}
              workMinutes={workMinutes}
            />
          </div>
        </section>

        <div>
          <label className="label" htmlFor="done">
            {"\uae08\uc77c \uc218\ud589 \uc5c5\ubb34"}
          </label>
          <textarea
            id="done"
            className="textarea"
            placeholder={"\uc624\ub298 \uc644\ub8cc\u00b7\uc9c4\ud589\ud55c \uc5c5\ubb34"}
            value={done}
            onChange={(e) => setDone(e.target.value)}
            disabled={loading}
          />
        </div>

        <div>
          <label className="label" htmlFor="plan">
            {"\uc775\uc77c \uacc4\ud68d"}
          </label>
          <textarea
            id="plan"
            className="textarea"
            value={plan}
            onChange={(e) => setPlan(e.target.value)}
            disabled={loading}
          />
        </div>

        <div>
          <label className="label" htmlFor="issues">
            {"\uc774\uc288 / \uc9c0\uc6d0 \uc694\uccad (\uc120\ud0dd)"}
          </label>
          <textarea
            id="issues"
            className="textarea"
            value={issues}
            onChange={(e) => setIssues(e.target.value)}
            disabled={loading}
          />
        </div>

        <div>
          <label className="label" htmlFor="deficiencies">
            {"\ubbf8\ube44\uc0ac\ud56d"}
          </label>
          <textarea
            id="deficiencies"
            className="textarea"
            placeholder={
              "\ubbf8\uc644\ub8cc, \ubcf4\uc644 \ud544\uc694, \uc7ac\uc791\uc5c5 \uc608\uc815 \ub4f1"
            }
            value={deficiencies}
            onChange={(e) => setDeficiencies(e.target.value)}
            disabled={loading}
          />
          <p className="muted mt-1 text-xs">
            {
              "\ud488\uc9c8\u00b7\uc218\ub7c9\u00b7\uc808\ucc28\uc0c1 \ubd80\uc871\ud55c \uc810\uc774 \uc788\uc73c\uba74 \uae30\uc7ac\ud574 \uc8fc\uc138\uc694."
            }
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {"\uc800\uc7a5"}
          </button>
          {status && <span className="muted">{status}</span>}
        </div>
      </form>
    </>
  );
}

export default function DailyPage() {
  return (
    <Suspense
      fallback={
        <p className="muted py-8 text-center text-sm">일일 기록 불러오는 중…</p>
      }
    >
      <DailyPageInner />
    </Suspense>
  );
}
