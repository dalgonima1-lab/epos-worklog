const BASE = process.env.EPOS_API_BASE ?? "https://epos-worklog.vercel.app";
const MEMBER_ID = "m1";
const START = "2026-06-01";
const END = "2026-06-05";

function st(line, name) {
  return `${line}호선 ${name}`;
}

const DAYS = [
  {
    date: "2026-06-01",
    type: "field",
    visits: [
      {
        station: st(1, "제기동역"),
        facility: "역무실",
        role: "조명제어시스템",
        done:
          "제기동역 조명제어 화면 설치 작업, 관제 연동 및 화면 정상 동작 확인",
      },
      {
        station: st(1, "신설동역"),
        facility: "역무실",
        role: "조명제어시스템",
        done:
          "신설동(1)역 조명제어 화면 설치 작업, 관제 연동 및 화면 정상 동작 확인",
      },
      {
        station: st(8, "석촌역"),
        facility: "전기실",
        role: "A/S",
        done:
          "석촌역 MD8 단말기 통신불량 점검. 통신 메인보드 불량으로 장비 교체, 통신라인 점검 후 정상 통신 확인. 트립 신호 시 관제화면 경보창 정상 출력 확인",
      },
    ],
  },
  {
    date: "2026-06-02",
    type: "field",
    visits: [
      {
        station: st(3, "수서역"),
        facility: "역무실",
        role: "조명제어시스템",
        done: "수서역 조명제어 화면 설치 작업, 관제 연동 및 화면 정상 동작 확인",
      },
    ],
  },
  { date: "2026-06-03", type: "holiday", title: "지방선거", note: "지방선거" },
  { date: "2026-06-04", type: "leave", title: "연차", note: "연차" },
  {
    date: "2026-06-05",
    type: "field",
    visits: [
      {
        station: st(1, "청량리역"),
        facility: "전기실",
        role: "전력감시시스템",
        done:
          "청량리역 현장 방문, 관제화면 작업 최신화를 위한 비상제어프로그램 DB 백업",
      },
      {
        station: st(1, "서울역"),
        facility: "전기실",
        role: "전력감시시스템",
        done:
          "서울역 현장 방문, 관제화면 작업 최신화를 위한 비상제어프로그램 DB 백업",
      },
      {
        station: st(1, "시청역"),
        facility: "전기실",
        role: "전력감시시스템",
        done:
          "시청역 현장 방문, 관제화면 작업 최신화를 위한 비상제어프로그램 DB 백업",
      },
    ],
  },
];

async function api(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...(options.headers ?? {}) },
    ...options,
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    const detail = data.error ?? data.raw ?? text;
    throw new Error(`${path} ${res.status}: ${detail}`);
  }
  return data;
}

async function main() {
  console.log("API base:", BASE);
  const before = await api(`/api/schedules?start=${START}&end=${END}`);
  const mine = (before.schedules ?? []).filter((s) => s.memberId === MEMBER_ID);
  console.log("BEFORE schedules:", mine.length);
  for (const s of mine) console.log(`  delete ${s.date} | ${s.title} | ${s.id}`);
  for (const s of mine) {
    await api(`/api/schedules?id=${encodeURIComponent(s.id)}`, { method: "DELETE" });
  }

  for (const day of DAYS) {
    if (day.type === "holiday") {
      await api("/api/schedules", {
        method: "POST",
        body: JSON.stringify({
          date: day.date,
          memberId: MEMBER_ID,
          title: day.title,
          facilityArea: "공휴일",
          note: day.note,
          timeOff: true,
        }),
      });
      console.log("OK holiday (schedule only)", day.date);
      continue;
    }

    if (day.type === "leave") {
      await api("/api/schedules", {
        method: "POST",
        body: JSON.stringify({
          date: day.date,
          memberId: MEMBER_ID,
          title: day.title,
          facilityArea: "연차",
          note: day.note,
          timeOff: true,
        }),
      });
      console.log("OK leave (schedule only)", day.date);
      continue;
    }

    const visits = day.visits;
    const primary = visits[0];
    const doneText = visits
      .map((v) => `【${v.station} · ${v.role}】\n${v.done}`)
      .join("\n\n");

    // Per-visit schedules
    const stationNames = visits.map((v) => v.station);
    const facilityAreas = visits.map((v) => v.facility);
    const titles = visits.map((v) => {
      const parts = [];
      const m = v.station.match(/^(\d+)호선\s+(.+)$/);
      if (m) parts.push(`${m[1]}호선`, m[2]);
      else parts.push(v.station);
      parts.push(v.facility);
      parts.push(v.done.slice(0, 40).replace(/\s+/g, " "));
      return parts.join("-");
    });

    // 일일기록 먼저 저장 (대표 역사 1곳 + done에 당일 전체)
    let visitGroupId;
    try {
      const repRes = await api("/api/reports", {
        method: "POST",
        body: JSON.stringify({
          date: day.date,
          memberId: MEMBER_ID,
          stationName: primary.station,
          facilityArea: primary.facility,
          processingRole: primary.role,
          done: doneText,
          plan: "",
          issues: "",
          deficiencies: "",
        }),
      });
      visitGroupId =
        repRes.visitGroupId ?? repRes.report?.visitGroupId ?? undefined;
    } catch (e) {
      const check = await api(
        `/api/reports?memberId=${MEMBER_ID}&date=${day.date}`
      );
      if (!check.report) throw e;
      visitGroupId = check.report.visitGroupId;
      console.warn("report POST warn:", e.message, "using existing");
    }

    // 주간 일정: 보고서 동기화 1건을 역별 제목으로 교체
    await api("/api/schedules", {
      method: "POST",
      body: JSON.stringify({
        date: day.date,
        memberId: MEMBER_ID,
        memberIds: [MEMBER_ID],
        replaceVisitGroupId: visitGroupId,
        visitGroupId,
        stationNames,
        facilityAreas,
        titles,
        title: titles[0],
        facilityArea: facilityAreas[0],
        note: primary.done,
      }),
    });

    console.log("OK field", day.date, visits.length, "visits");
  }

  const after = await api(`/api/schedules?start=${START}&end=${END}`);
  const afterMine = (after.schedules ?? []).filter((s) => s.memberId === MEMBER_ID);
  console.log("\nAFTER schedules:", afterMine.length);
  for (const s of afterMine) console.log(`  ${s.date} | ${s.title}`);

  for (const d of ["2026-06-01", "2026-06-02", "2026-06-03", "2026-06-04", "2026-06-05"]) {
    const rep = await api(`/api/reports?memberId=${MEMBER_ID}&date=${d}`);
    const r = rep.report;
    console.log(
      `REPORT ${d}:`,
      r ? `${r.stationName || r.facilityArea} | ${r.processingRole} | ${(r.done ?? "").slice(0, 80)}` : "none"
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
