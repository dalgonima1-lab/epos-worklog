const BASE = process.env.EPOS_API_BASE ?? "https://epos-worklog.vercel.app";
const MEMBER_ID = "m1";
const START = "2026-06-08";
const END = "2026-06-12";

function st(line, name) {
  return `${line}호선 ${name}`;
}

function shortStationLabel(display) {
  const t = display.trim();
  const m = t.match(/^\d+호선\s+(.+)$/);
  return (m ? m[1] : t).trim();
}

const DAYS = [
  {
    date: "2026-06-08",
    type: "field",
    visits: [
      {
        station: st(1, "제기동역"),
        facility: "역무실",
        role: "조명제어시스템",
        done:
          "제기동역 A/S 관제 설치 후 수은등 제어 고장 및 서버 연결 고장 현장 점검. 뷰티 작업 중 정전으로 포트 충돌 서버 연결 고장 메시지 증상 발생, Port 확인·설정 변경/수정 및 방화벽 비활성화 조치. 조명제어 정상 동작 확인. 사무실 복귀 일정 조율·정리",
      },
    ],
  },
  {
    date: "2026-06-09",
    type: "field",
    visits: [
      {
        station: st(2, "한양대역"),
        facility: "역무실",
        role: "조명제어시스템",
        done:
          "한양대역 조명제어 화면 설치 현장 방문. V-LAN 포트 미개방·IP 차단으로 통신실 IP 정책·네트워크 설정 협의, 네트워크 제약으로 기본 프로그램 우선 설치 후 후속 조치 사항 전달",
      },
      {
        station: st(2, "종합운동장역"),
        facility: "역무실",
        role: "조명제어시스템",
        done:
          "종합운동장(체육관)역 조명제어 화면 설치 현장 방문. V-LAN 포트 미개방·IP 차단으로 통신실 IP 정책·네트워크 설정 협의, 네트워크 제약으로 기본 프로그램 우선 설치 후 후속 조치 사항 전달",
      },
    ],
  },
  {
    date: "2026-06-10",
    type: "field",
    visits: [
      {
        station: st(2, "한양대역"),
        facility: "역무실",
        role: "조명제어시스템",
        done:
          "한양대역 조명제어 화면 설치 재방문. 조명제어 관제시스템 설치 완료, 관제 연동·제어 테스트, 분전반 버튼 작동 확인. 펌웨어 업데이트 및 DB 회로정보 보완 후 관제화면·제어 기능 정상화. 기존 DB 회로정보 누락·불일치 확인 후 수정, 관제 연동·제어 정상 동작 확인",
      },
      {
        station: st(2, "종합운동장역"),
        facility: "역무실",
        role: "조명제어시스템",
        done:
          "종합운동장(체육관)역 조명제어 화면 설치 재방문. 조명제어 관제시스템 설치 완료, 관제 연동·제어 테스트, 분전반 버튼 작동 확인. 펌웨어 업데이트 및 DB 회로정보 보완 후 관제화면·제어 기능 정상화",
      },
    ],
  },
  {
    date: "2026-06-11",
    type: "field",
    visits: [
      {
        station: st(1, "시청역"),
        facility: "역무실",
        role: "조명제어시스템",
        done:
          "시청역 조명제어 화면 설치. 조명제어 관제시스템 설치 완료, 관제 연동·제어 테스트, 분전반 버튼 작동 확인. 펌웨어 업데이트 및 DB 회로정보 보완, 관제화면·제어 기능 정상화. DB 회로 수정 후 정상 동작 확인",
      },
      {
        station: st(1, "서울역"),
        facility: "역무실",
        role: "조명제어시스템",
        done:
          "서울역 조명제어 화면 설치. 조명제어 관제시스템 설치 완료, 관제 연동·제어 테스트, 분전반 버튼 작동 확인. 펌웨어 업데이트 및 DB 회로정보 보완, 관제화면·제어 기능 정상화",
      },
    ],
  },
  {
    date: "2026-06-12",
    type: "field",
    visits: [
      {
        station: st(2, "이대역"),
        facility: "역무실",
        role: "조명제어시스템",
        done:
          "이대(이화여대)역 조명제어 화면 설치. 조명제어 관제시스템 설치 완료, 관제 연동·제어 테스트, 분전반 버튼 작동 확인. 펌웨어 업데이트 및 DB 회로정보 보완, 관제화면·제어 기능 정상화",
      },
      {
        station: st(2, "잠실역"),
        facility: "역무실",
        role: "조명제어시스템",
        done:
          "잠실역 조명제어 화면 설치. 조명제어 관제시스템 설치 완료, 관제 연동·제어 테스트, 분전반 버튼 작동 확인. 펌웨어 업데이트 및 DB 회로정보 보완, 관제화면·제어 기능 정상화",
      },
      {
        station: st(2, "종합운동장역"),
        facility: "역무실",
        role: "A/S",
        done:
          "종합운동장(체육관)역 A/S 방문. IP 차단으로 통신실 협의 후 임의 IP 입력 조치, 추후 재차단 가능성 안내",
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
  for (const s of mine) {
    console.log(`  delete ${s.date} | ${s.title.slice(0, 50)} | ${s.id}`);
    await api(`/api/schedules?id=${encodeURIComponent(s.id)}`, {
      method: "DELETE",
    });
  }

  for (const day of DAYS) {
    const visits = day.visits;
    const primary = visits[0];
    const doneText = visits
      .map((v) => `【${shortStationLabel(v.station)}】\n${v.done}`)
      .join("\n\n");

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

    let visitGroupId;
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

    console.log("OK", day.date, visits.length, "visits");
  }

  const after = await api(`/api/schedules?start=${START}&end=${END}`);
  const afterMine = (after.schedules ?? []).filter((s) => s.memberId === MEMBER_ID);
  console.log("\nAFTER schedules:", afterMine.length);
  for (const s of afterMine) console.log(`  ${s.date} | ${s.title.slice(0, 70)}`);

  const dates = ["2026-06-08", "2026-06-09", "2026-06-10", "2026-06-11", "2026-06-12"];
  for (const iso of dates) {
    const rep = await api(`/api/reports?memberId=${MEMBER_ID}&date=${iso}`);
    const r = rep.report;
    console.log(
      `REPORT ${iso}:`,
      r
        ? `${r.stationName} | ${r.processingRole} | ${(r.done ?? "").slice(0, 60)}`
        : "none"
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
