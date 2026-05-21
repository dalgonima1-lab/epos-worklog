import { promises as fs } from "fs";
import path from "path";
import type { Database, DailyReport, Member, StationRecord } from "./types";
import { calcWorkMinutes } from "./workTime";
import { dataUrlToBuffer, readPhoto, shouldStorePhotosInFirestore } from "./photos";
import {
  normalizeStationName,
  registerStationInHistory,
  seedStationHistory,
  sortStations,
} from "./stations";
import { getFirebaseDb, isFirebaseConfigured, formatFirestoreUserError } from "./firebaseAdmin";
import { DEFAULT_TEAM_MEMBERS, DEFAULT_TEAM_NAME } from "./constants";

const DATA_PATH = path.join(process.cwd(), "data", "store.json");
const CLOUD_DB_COLLECTION = "epos-worklog";
const CLOUD_DB_DOC = "main";

const DEFAULT_DB: Database = {
  teamName: DEFAULT_TEAM_NAME,
  managerPin: "1234",
  members: [...DEFAULT_TEAM_MEMBERS],
  reports: [],
  stationHistory: seedStationHistory(),
};

const DEFAULT_MEMBERS: Member[] = DEFAULT_DB.members;

/** 팀장 PIN 비교용: 공백·전각 숫자·숫자 타입 정리 */
function normalizeManagerPinInput(value: unknown): string {
  return String(value ?? "")
    .trim()
    .replace(/[０-９]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0));
}

const MEMBER_NAME_MAP: Record<string, string> = {
  m1: "노희찬 과장",
  m2: "이준명 대리",
  m3: "유영준 사원",
  mgr: "최원제 팀장",
};

export type ReportPayload = Pick<
  DailyReport,
  | "stationName"
  | "processingRole"
  | "done"
  | "plan"
  | "issues"
  | "deficiencies"
  | "beforePhotoAt"
  | "afterPhotoAt"
>;

function migrateDb(db: Database): Database {
  if (db.teamName === "epos 관리팀") {
    db.teamName = DEFAULT_TEAM_NAME;
  }
  db.teamName = db.teamName || DEFAULT_DB.teamName;
  const normalizedPin = normalizeManagerPinInput(db.managerPin);
  db.managerPin = normalizedPin.length > 0 ? normalizedPin : DEFAULT_DB.managerPin;
  db.reports = Array.isArray(db.reports) ? db.reports : [];

  if (!Array.isArray(db.members) || db.members.length === 0) {
    db.members = [...DEFAULT_MEMBERS];
  }

  if (!db.stationHistory?.length) {
    const fromReports = db.reports
      .map((r) => r.stationName)
      .filter(Boolean) as string[];
    db.stationHistory =
      fromReports.length > 0
        ? fromReports.reduce(
            (hist, name) => registerStationInHistory(hist, name),
            [] as Database["stationHistory"]
          )
        : seedStationHistory();
  }

  for (const m of db.members) {
    if (MEMBER_NAME_MAP[m.id]) {
      m.name = MEMBER_NAME_MAP[m.id];
    }
  }

  db.reports = db.reports.map(normalizeReport);
  db.stationHistory = sortStations(db.stationHistory);
  return db;
}

async function ensureDb(): Promise<Database> {
  if (isFirebaseConfigured()) {
    try {
      const cloudDb = getFirebaseDb();
      const ref = cloudDb.collection(CLOUD_DB_COLLECTION).doc(CLOUD_DB_DOC);
      const snapshot = await ref.get();

      if (!snapshot.exists) {
        await ref.set(DEFAULT_DB);
        return DEFAULT_DB;
      }

      return migrateDb(snapshot.data() as Database);
    } catch (e) {
      throw new Error(formatFirestoreUserError(e));
    }
  }

  try {
    const raw = await fs.readFile(DATA_PATH, "utf-8");
    const db = migrateDb(JSON.parse(raw) as Database);
    return db;
  } catch {
    await fs.mkdir(path.dirname(DATA_PATH), { recursive: true });
    await fs.writeFile(DATA_PATH, JSON.stringify(DEFAULT_DB, null, 2), "utf-8");
    return DEFAULT_DB;
  }
}

function normalizeReport(r: DailyReport): DailyReport {
  return {
    ...r,
    stationName: r.stationName ?? "",
    processingRole: r.processingRole ?? "",
    deficiencies: r.deficiencies ?? "",
    workMinutes:
      r.workMinutes ??
      calcWorkMinutes(r.beforePhotoAt, r.afterPhotoAt) ??
      undefined,
  };
}

async function saveDb(db: Database): Promise<void> {
  if (isFirebaseConfigured()) {
    try {
      await getFirebaseDb()
        .collection(CLOUD_DB_COLLECTION)
        .doc(CLOUD_DB_DOC)
        .set(db);
      return;
    } catch (e) {
      throw new Error(formatFirestoreUserError(e));
    }
  }

  await fs.mkdir(path.dirname(DATA_PATH), { recursive: true });
  await fs.writeFile(DATA_PATH, JSON.stringify(db, null, 2), "utf-8");
}

async function syncPhotoFlags(report: DailyReport): Promise<DailyReport> {
  if (shouldStorePhotosInFirestore()) {
    report.hasBeforePhoto = Boolean(report.beforePhotoDataUrl);
    report.hasAfterPhoto = Boolean(report.afterPhotoDataUrl);
    return report;
  }

  const before = await readPhoto(report.memberId, report.date, "before");
  const after = await readPhoto(report.memberId, report.date, "after");
  report.hasBeforePhoto = !!before;
  report.hasAfterPhoto = !!after;
  return report;
}

export async function getPhotoBufferFromReport(
  memberId: string,
  date: string,
  slot: "before" | "after"
): Promise<Buffer | null> {
  if (!shouldStorePhotosInFirestore()) {
    return readPhoto(memberId, date, slot);
  }

  const report = await getReport(memberId, date);
  return dataUrlToBuffer(
    slot === "before" ? report?.beforePhotoDataUrl : report?.afterPhotoDataUrl
  );
}

export async function getDb(): Promise<Database> {
  return ensureDb();
}

export async function getMembers(): Promise<Member[]> {
  const db = await ensureDb();
  const members = db.members.filter((m) => m.role === "member");
  return members.length > 0
    ? members
    : DEFAULT_MEMBERS.filter((m) => m.role === "member");
}

export async function getStationHistory() {
  const db = await ensureDb();
  return db.stationHistory;
}

export async function registerStation(name: string): Promise<StationRecord[]> {
  const db = await ensureDb();
  db.stationHistory = registerStationInHistory(db.stationHistory, name);
  await saveDb(db);
  return db.stationHistory;
}

export async function upsertReport(
  memberId: string,
  date: string,
  payload: ReportPayload
): Promise<DailyReport> {
  const db = await ensureDb();
  const existing = db.reports.find(
    (r) => r.memberId === memberId && r.date === date
  );
  const now = new Date().toISOString();
  const workMinutes = calcWorkMinutes(
    payload.beforePhotoAt,
    payload.afterPhotoAt
  );

  if (payload.stationName) {
    db.stationHistory = registerStationInHistory(
      db.stationHistory,
      payload.stationName
    );
  }

  if (existing) {
    existing.stationName = payload.stationName;
    existing.processingRole = payload.processingRole;
    existing.done = payload.done;
    existing.plan = payload.plan;
    existing.issues = payload.issues;
    existing.deficiencies = payload.deficiencies;
    if (payload.beforePhotoAt) existing.beforePhotoAt = payload.beforePhotoAt;
    if (payload.afterPhotoAt) existing.afterPhotoAt = payload.afterPhotoAt;
    existing.workMinutes = workMinutes ?? undefined;
    existing.updatedAt = now;
    await syncPhotoFlags(existing);
    await saveDb(db);
    return existing;
  }

  const report: DailyReport = {
    id: `r_${memberId}_${date}`,
    memberId,
    date,
    stationName: payload.stationName,
    processingRole: payload.processingRole,
    done: payload.done,
    plan: payload.plan,
    issues: payload.issues,
    deficiencies: payload.deficiencies,
    beforePhotoAt: payload.beforePhotoAt,
    afterPhotoAt: payload.afterPhotoAt,
    workMinutes: workMinutes ?? undefined,
    updatedAt: now,
  };
  await syncPhotoFlags(report);
  db.reports.push(report);
  await saveDb(db);
  return report;
}

export async function getReport(
  memberId: string,
  date: string
): Promise<DailyReport | null> {
  const db = await ensureDb();
  const report = db.reports.find(
    (r) => r.memberId === memberId && r.date === date
  );
  if (!report) return null;
  return syncPhotoFlags(normalizeReport({ ...report }));
}

export async function getReportsInRange(
  startDate: string,
  endDate: string
): Promise<DailyReport[]> {
  const db = await ensureDb();
  const list = db.reports.filter(
    (r) => r.date >= startDate && r.date <= endDate
  );
  return Promise.all(list.map((r) => syncPhotoFlags(normalizeReport({ ...r }))));
}

/** 역사명이 같은 일일 보고를 최신순으로 (공백 무시·대소문자 무시 매칭) */
export async function getReportsByStationName(
  stationQuery: string,
  limit = 300
): Promise<DailyReport[]> {
  const db = await ensureDb();
  const target = normalizeStationName(stationQuery).toLowerCase();
  if (!target) return [];

  const list = db.reports.filter((r) => {
    const n = normalizeStationName(r.stationName || "").toLowerCase();
    return n.length > 0 && n === target;
  });
  list.sort((a, b) => {
    const byDate = b.date.localeCompare(a.date);
    if (byDate !== 0) return byDate;
    return b.updatedAt.localeCompare(a.updatedAt);
  });
  const sliced = list.slice(0, Math.min(limit, 500));
  return Promise.all(
    sliced.map((r) => syncPhotoFlags(normalizeReport({ ...r })))
  );
}

export async function verifyManagerPin(pin: string): Promise<boolean> {
  const db = await ensureDb();
  const expected = normalizeManagerPinInput(db.managerPin);
  const submitted = normalizeManagerPinInput(pin);
  return submitted.length > 0 && submitted === expected;
}

export async function updatePhotoTimestamp(
  memberId: string,
  date: string,
  slot: "before" | "after",
  recordedAt: string,
  photoDataUrl?: string
): Promise<DailyReport> {
  const db = await ensureDb();
  let report = db.reports.find(
    (r) => r.memberId === memberId && r.date === date
  );

  if (!report) {
    report = {
      id: `r_${memberId}_${date}`,
      memberId,
      date,
      stationName: "",
      processingRole: "",
      done: "",
      plan: "",
      issues: "",
      deficiencies: "",
      updatedAt: new Date().toISOString(),
    };
    db.reports.push(report);
  }

  if (slot === "before") report.beforePhotoAt = recordedAt;
  else report.afterPhotoAt = recordedAt;

  if (photoDataUrl) {
    if (slot === "before") report.beforePhotoDataUrl = photoDataUrl;
    else report.afterPhotoDataUrl = photoDataUrl;
  }

  report.workMinutes =
    calcWorkMinutes(report.beforePhotoAt, report.afterPhotoAt) ?? undefined;
  report.updatedAt = new Date().toISOString();
  await syncPhotoFlags(report);
  await saveDb(db);
  return report;
}
