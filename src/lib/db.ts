import { promises as fs } from "fs";
import path from "path";
import type {
  Database,
  DailyReport,
  ManagerDirective,
  Member,
  ScheduleEntry,
  StationRecord,
  WeeklyAnalysisRecord,
} from "./types";
import { calcWorkMinutes } from "./workTime";
import { dataUrlToBuffer, readPhoto, shouldStorePhotosInFirestore } from "./photos";
import { stationsMatch } from "./metroStations";
import {
  buildMetroStationCatalog,
  extractPrimaryStationName,
  isBundledStationName,
  sanitizeReportStationNames,
  STATION_CATALOG_VERSION,
} from "./stationCatalog";
import { canonicalStationDisplayName } from "./metroStations";
import {
  registerStationInHistory,
  seedStationHistory,
  sortStations,
} from "./stations";
import { getFirebaseDb, isFirebaseConfigured, formatFirestoreUserError } from "./firebaseAdmin";
import { DEFAULT_TEAM_MEMBERS, DEFAULT_TEAM_NAME } from "./constants";
import {
  isSecurityTestPlaceholder,
  sanitizeDatabaseTestArtifacts,
} from "./sanitizeTestData";
import {
  buildOfficeWorkScheduleTitle,
  filledOfficeWorkEntries,
  isOfficeGeneralStation,
  type OfficeWorkEntry,
} from "./officeWork";
import {
  ANNUAL_LEAVE_FACILITY,
  PUBLIC_HOLIDAY_FACILITY,
} from "./scheduleKinds";
import {
  isWorkFacilityArea,
  MANAGEMENT_OFFICE_FACILITY,
  OFFICE_WORK_FACILITY,
} from "./stationFacility";

export const DATA_SANITIZE_VERSION = 1;

const DATA_PATH = path.join(process.cwd(), "data", "store.json");
const CLOUD_DB_COLLECTION = "epos-worklog";
const CLOUD_DB_DOC = "main";

const DEFAULT_DB: Database = {
  teamName: DEFAULT_TEAM_NAME,
  managerPin: "1234",
  members: [...DEFAULT_TEAM_MEMBERS],
  reports: [],
  stationHistory: seedStationHistory(),
  schedules: [],
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
  | "facilityArea"
  | "additionalFacilityAreas"
  | "maintenanceVisitTargets"
  | "maintenancePlannedTargets"
  | "maintenanceDeficienciesByStation"
  | "officeWorkEntries"
  | "officeWorkVisitedStations"
  | "managementOffice"
  | "processingRole"
  | "done"
  | "plan"
  | "issues"
  | "deficiencies"
  | "beforePhotoAt"
  | "afterPhotoAt"
  | "visitGroupId"
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

  if ((db.dataSanitizeVersion ?? 0) < DATA_SANITIZE_VERSION) {
    sanitizeDatabaseTestArtifacts(db);
    db.dataSanitizeVersion = DATA_SANITIZE_VERSION;
  }

  if ((db.stationCatalogVersion ?? 0) < STATION_CATALOG_VERSION) {
    sanitizeReportStationNames(db.reports);
    db.stationHistory = buildMetroStationCatalog(
      db.reports,
      db.stationHistory ?? []
    );
    db.stationCatalogVersion = STATION_CATALOG_VERSION;
  } else if (!db.stationHistory?.length) {
    db.stationHistory = seedStationHistory();
  }

  for (const m of db.members) {
    if (MEMBER_NAME_MAP[m.id]) {
      m.name = MEMBER_NAME_MAP[m.id];
    }
  }

  db.reports = db.reports.map(normalizeReport);
  db.stationHistory = sortStations(db.stationHistory);
  db.schedules = Array.isArray(db.schedules) ? db.schedules : [];
  db.weeklyAnalyses = db.weeklyAnalyses ?? {};
  return db;
}

async function ensureDb(): Promise<Database> {
  let db: Database;
  let catalogVersionBefore = 0;
  let dataSanitizeVersionBefore = 0;

  if (isFirebaseConfigured()) {
    try {
      const cloudDb = getFirebaseDb();
      const ref = cloudDb.collection(CLOUD_DB_COLLECTION).doc(CLOUD_DB_DOC);
      const snapshot = await ref.get();

      if (!snapshot.exists) {
        await ref.set(DEFAULT_DB);
        return DEFAULT_DB;
      }

      db = snapshot.data() as Database;
      catalogVersionBefore = db.stationCatalogVersion ?? 0;
      dataSanitizeVersionBefore = db.dataSanitizeVersion ?? 0;
      db = migrateDb(db);
    } catch (e) {
      throw new Error(formatFirestoreUserError(e));
    }
  } else {
    try {
      const raw = await fs.readFile(DATA_PATH, "utf-8");
      db = JSON.parse(raw) as Database;
      catalogVersionBefore = db.stationCatalogVersion ?? 0;
      dataSanitizeVersionBefore = db.dataSanitizeVersion ?? 0;
      db = migrateDb(db);
    } catch {
      await fs.mkdir(path.dirname(DATA_PATH), { recursive: true });
      await fs.writeFile(DATA_PATH, JSON.stringify(DEFAULT_DB, null, 2), "utf-8");
      return DEFAULT_DB;
    }
  }

  if (
    (db.stationCatalogVersion ?? 0) !== catalogVersionBefore ||
    (db.dataSanitizeVersion ?? 0) !== dataSanitizeVersionBefore
  ) {
    await saveDb(db);
  }

  return db;
}

function normalizeReport(r: DailyReport): DailyReport {
  return {
    ...r,
    stationName: r.stationName ?? "",
    facilityArea: r.facilityArea ?? "",
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

/** 전체 역 카탈로그 재구성·저장 (스크립트·마이그레이션) */
export async function rebuildStationCatalog(): Promise<{
  beforeCount: number;
  afterCount: number;
  usedCount: number;
  reportFixes: number;
  bundledReportsBefore: number;
}> {
  let db: Database;

  if (isFirebaseConfigured()) {
    const snapshot = await getFirebaseDb()
      .collection(CLOUD_DB_COLLECTION)
      .doc(CLOUD_DB_DOC)
      .get();
    db = snapshot.exists
      ? (snapshot.data() as Database)
      : { ...DEFAULT_DB };
  } else {
    try {
      const raw = await fs.readFile(DATA_PATH, "utf-8");
      db = JSON.parse(raw) as Database;
    } catch {
      db = { ...DEFAULT_DB };
    }
  }

  const beforeCount = db.stationHistory?.length ?? 0;
  const bundledReportsBefore = db.reports.filter((r) =>
    /[,，、/·]/.test(r.stationName ?? "")
  ).length;

  const reportFixes = sanitizeReportStationNames(db.reports);
  db.stationHistory = buildMetroStationCatalog(db.reports, db.stationHistory);
  db.stationCatalogVersion = STATION_CATALOG_VERSION;
  db = migrateDb(db);
  await saveDb(db);

  return {
    beforeCount,
    afterCount: db.stationHistory.length,
    usedCount: db.stationHistory.filter((s) => s.useCount > 0).length,
    reportFixes,
    bundledReportsBefore,
  };
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

export async function registerStation(
  name: string,
  options?: import("./stations").RegisterStationOptions
): Promise<StationRecord[]> {
  if (isSecurityTestPlaceholder(name)) {
    const db = await ensureDb();
    return db.stationHistory;
  }
  const db = await ensureDb();
  db.stationHistory = registerStationInHistory(
    db.stationHistory,
    name,
    options
  );
  await saveDb(db);
  return db.stationHistory;
}

function normalizeReportStationName(raw: string): string {
  const t = raw.trim();
  if (!t) return "";
  if (isSecurityTestPlaceholder(t)) return "";
  if (isBundledStationName(t)) {
    return extractPrimaryStationName(t);
  }
  return canonicalStationDisplayName(t);
}

function normalizeFacilityArea(raw?: string): string {
  const t = raw?.trim() ?? "";
  return isWorkFacilityArea(t) ? t : "";
}

function normalizeManagementOffice(raw?: string): string | undefined {
  const t = raw?.trim() ?? "";
  return t || undefined;
}

export type VisitGroupPayload = {
  visitGroupId?: string;
  additionalStationNames?: string[];
  stationNames?: string[];
};

function reportInvolvesStation(r: DailyReport, stationQuery: string): boolean {
  if (stationsMatch(r.stationName ?? "", stationQuery)) return true;
  for (const add of r.additionalStationNames ?? []) {
    if (stationsMatch(add, stationQuery)) return true;
  }
  for (const t of r.maintenanceVisitTargets ?? []) {
    if (stationsMatch(t.station ?? "", stationQuery)) return true;
  }
  for (const t of r.maintenancePlannedTargets ?? []) {
    if (stationsMatch(t.station ?? "", stationQuery)) return true;
  }
  for (const e of r.officeWorkEntries ?? []) {
    if (stationsMatch(e.station ?? "", stationQuery)) return true;
  }
  return false;
}

export async function upsertReport(
  memberId: string,
  date: string,
  payload: ReportPayload & VisitGroupPayload
): Promise<DailyReport> {
  const db = await ensureDb();

  let stationName = payload.stationName?.trim() ?? "";
  let additionalStationNames = payload.additionalStationNames ?? [];
  let visitGroupId = payload.visitGroupId;

  if (payload.stationNames?.length) {
    const names = payload.stationNames.map((s) => s.trim()).filter(Boolean);
    if (names.length) {
      stationName = names[0]!;
      additionalStationNames = names.slice(1);
      if (names.length > 1 && !visitGroupId) {
        visitGroupId = `vg_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
      }
    }
  }

  if (stationName) {
    stationName = normalizeReportStationName(stationName);
  }
  additionalStationNames = additionalStationNames
    .map((s) => normalizeReportStationName(s))
    .filter(Boolean);

  payload = { ...payload, stationName, additionalStationNames, visitGroupId };
  const existing = db.reports.find(
    (r) => r.memberId === memberId && r.date === date
  );
  const now = new Date().toISOString();
  const isMaintenanceReport =
    normalizeFacilityArea(payload.facilityArea) === MANAGEMENT_OFFICE_FACILITY;
  const isOfficeWorkReport =
    normalizeFacilityArea(payload.facilityArea) === OFFICE_WORK_FACILITY;
  const workMinutes =
    isMaintenanceReport || isOfficeWorkReport
      ? undefined
      : calcWorkMinutes(payload.beforePhotoAt, payload.afterPhotoAt);

  const allStations = [
    payload.stationName,
    ...(payload.additionalStationNames ?? []),
    ...(payload.officeWorkEntries ?? []).map((e) => e.station),
  ].filter((s) => s && !isOfficeGeneralStation(s));
  for (const s of allStations) {
    db.stationHistory = registerStationInHistory(db.stationHistory, s);
  }

  if (existing) {
    existing.stationName = payload.stationName;
    existing.additionalStationNames =
      payload.additionalStationNames?.length
        ? payload.additionalStationNames
        : undefined;
    existing.visitGroupId = payload.visitGroupId;
    existing.facilityArea = normalizeFacilityArea(payload.facilityArea);
    existing.additionalFacilityAreas =
      payload.additionalFacilityAreas?.length
        ? payload.additionalFacilityAreas.map((a) => normalizeFacilityArea(a))
        : undefined;
    existing.maintenanceVisitTargets = payload.maintenanceVisitTargets?.length
      ? payload.maintenanceVisitTargets
      : undefined;
    existing.maintenancePlannedTargets = payload.maintenancePlannedTargets
      ?.length
      ? payload.maintenancePlannedTargets
      : undefined;
    existing.maintenanceDeficienciesByStation =
      payload.maintenanceDeficienciesByStation?.length
        ? payload.maintenanceDeficienciesByStation
        : undefined;
    existing.officeWorkEntries = payload.officeWorkEntries?.length
      ? payload.officeWorkEntries
      : undefined;
    existing.officeWorkVisitedStations =
      payload.officeWorkVisitedStations?.length
        ? payload.officeWorkVisitedStations
        : undefined;
    existing.managementOffice = normalizeManagementOffice(
      payload.managementOffice
    );
    existing.processingRole = payload.processingRole;
    existing.done = payload.done;
    existing.plan = payload.plan;
    existing.issues = payload.issues;
    existing.deficiencies = payload.deficiencies;
    if (isMaintenanceReport) {
      existing.beforePhotoAt = undefined;
      existing.afterPhotoAt = undefined;
      existing.beforePhotoDataUrl = undefined;
      existing.afterPhotoDataUrl = undefined;
      existing.hasBeforePhoto = false;
      existing.hasAfterPhoto = false;
      existing.workMinutes = undefined;
    } else {
      if (payload.beforePhotoAt) existing.beforePhotoAt = payload.beforePhotoAt;
      if (payload.afterPhotoAt) existing.afterPhotoAt = payload.afterPhotoAt;
      existing.workMinutes = workMinutes ?? undefined;
    }
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
    additionalStationNames: payload.additionalStationNames?.length
      ? payload.additionalStationNames
      : undefined,
    visitGroupId: payload.visitGroupId,
    facilityArea: normalizeFacilityArea(payload.facilityArea),
    additionalFacilityAreas: payload.additionalFacilityAreas?.length
      ? payload.additionalFacilityAreas.map((a) => normalizeFacilityArea(a))
      : undefined,
    maintenanceVisitTargets: payload.maintenanceVisitTargets?.length
      ? payload.maintenanceVisitTargets
      : undefined,
    maintenancePlannedTargets: payload.maintenancePlannedTargets?.length
      ? payload.maintenancePlannedTargets
      : undefined,
    maintenanceDeficienciesByStation:
      payload.maintenanceDeficienciesByStation?.length
        ? payload.maintenanceDeficienciesByStation
        : undefined,
    officeWorkEntries: payload.officeWorkEntries?.length
      ? payload.officeWorkEntries
      : undefined,
    officeWorkVisitedStations: payload.officeWorkVisitedStations?.length
      ? payload.officeWorkVisitedStations
      : undefined,
    managementOffice: normalizeManagementOffice(payload.managementOffice),
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
  if (!stationQuery.trim()) return [];

  const list = db.reports.filter((r) => reportInvolvesStation(r, stationQuery));
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

export async function getSchedulesInRange(
  startDate: string,
  endDate: string
): Promise<ScheduleEntry[]> {
  const db = await ensureDb();
  return db.schedules
    .filter((s) => s.date >= startDate && s.date <= endDate)
    .sort((a, b) => {
      const byDate = a.date.localeCompare(b.date);
      if (byDate !== 0) return byDate;
      return a.updatedAt.localeCompare(b.updatedAt);
    });
}

export async function upsertSchedule(payload: {
  id?: string;
  date: string;
  memberId: string;
  title: string;
  stationName?: string;
  facilityArea?: string;
  managementOffice?: string;
  note?: string;
  visitGroupId?: string;
  maintenanceStationNames?: string[];
  maintenanceVisitTargets?: ScheduleEntry["maintenanceVisitTargets"];
}): Promise<ScheduleEntry> {
  const db = await ensureDb();
  const now = new Date().toISOString();
  const title = payload.title.trim();
  if (!title) throw new Error("일정 제목을 입력해 주세요.");
  if (!payload.date || !payload.memberId) {
    throw new Error("날짜와 담당자가 필요합니다.");
  }

  let entry: ScheduleEntry;
  if (payload.id) {
    const idx = db.schedules.findIndex((s) => s.id === payload.id);
    if (idx < 0) throw new Error("일정을 찾을 수 없습니다.");
    entry = {
      ...db.schedules[idx],
      date: payload.date,
      memberId: payload.memberId,
      title,
      stationName: payload.stationName?.trim() || undefined,
      facilityArea: payload.facilityArea?.trim() || undefined,
      managementOffice: payload.managementOffice?.trim() || undefined,
      note: payload.note?.trim() || undefined,
      visitGroupId: payload.visitGroupId?.trim() || undefined,
      maintenanceStationNames: payload.maintenanceStationNames?.length
        ? payload.maintenanceStationNames
        : undefined,
      maintenanceVisitTargets: payload.maintenanceVisitTargets?.length
        ? payload.maintenanceVisitTargets
        : undefined,
      updatedAt: now,
    };
    db.schedules[idx] = entry;
  } else {
    entry = {
      id: `sch_${payload.memberId}_${payload.date}_${Date.now()}`,
      date: payload.date,
      memberId: payload.memberId,
      title,
      stationName: payload.stationName?.trim() || undefined,
      facilityArea: payload.facilityArea?.trim() || undefined,
      managementOffice: payload.managementOffice?.trim() || undefined,
      note: payload.note?.trim() || undefined,
      visitGroupId: payload.visitGroupId?.trim() || undefined,
      maintenanceStationNames: payload.maintenanceStationNames?.length
        ? payload.maintenanceStationNames
        : undefined,
      maintenanceVisitTargets: payload.maintenanceVisitTargets?.length
        ? payload.maintenanceVisitTargets
        : undefined,
      createdAt: now,
      updatedAt: now,
    };
    db.schedules.push(entry);
  }

  await saveDb(db);
  return entry;
}

/** 일일기록 동기화 대상(외근·유지보수) 일정만 제거 — 연차·공휴·사무 유지 */
export async function deleteAutoSyncedSchedulesForMemberDate(
  memberId: string,
  date: string
): Promise<number> {
  const db = await ensureDb();
  const before = db.schedules.length;
  db.schedules = db.schedules.filter((s) => {
    if (s.memberId !== memberId || s.date !== date) return true;
    const area = s.facilityArea?.trim() ?? "";
    if (area === OFFICE_WORK_FACILITY) return true;
    if (area === ANNUAL_LEAVE_FACILITY || area === PUBLIC_HOLIDAY_FACILITY) {
      return true;
    }
    if (area === MANAGEMENT_OFFICE_FACILITY) return false;
    if (!area) return true;
    return false;
  });
  const removed = before - db.schedules.length;
  if (removed > 0) await saveDb(db);
  return removed;
}

function scheduleMatchesVisitSlot(
  schedule: ScheduleEntry,
  slot: { station: string; facility: string }
): boolean {
  const area = schedule.facilityArea?.trim() ?? "";
  if (!area || area === OFFICE_WORK_FACILITY) return false;
  if (area === ANNUAL_LEAVE_FACILITY || area === PUBLIC_HOLIDAY_FACILITY) {
    return false;
  }
  const station = schedule.stationName?.trim() ?? "";
  if (!stationsMatch(station, slot.station)) return false;
  if (area === MANAGEMENT_OFFICE_FACILITY) {
    return slot.facility === MANAGEMENT_OFFICE_FACILITY;
  }
  return area === slot.facility.trim();
}

/** 지정 역·장소 일정만 제거 (같은 날 다른 역 일정 유지) */
export async function deleteAutoSyncedSchedulesForSlots(
  memberId: string,
  date: string,
  slots: { station: string; facility: string }[]
): Promise<number> {
  if (!slots.length) return 0;
  const db = await ensureDb();
  const before = db.schedules.length;
  db.schedules = db.schedules.filter((s) => {
    if (s.memberId !== memberId || s.date !== date) return true;
    const shouldRemove = slots.some((slot) =>
      scheduleMatchesVisitSlot(s, slot)
    );
    return !shouldRemove;
  });
  const removed = before - db.schedules.length;
  if (removed > 0) await saveDb(db);
  return removed;
}

export async function getScheduleById(
  id: string
): Promise<ScheduleEntry | undefined> {
  const db = await ensureDb();
  return db.schedules.find((s) => s.id === id);
}

export async function deleteSchedulesForMemberDateFacility(
  memberId: string,
  date: string,
  facilityArea: string
): Promise<number> {
  const db = await ensureDb();
  const area = facilityArea.trim();
  const before = db.schedules.length;
  db.schedules = db.schedules.filter(
    (s) =>
      !(
        s.memberId === memberId &&
        s.date === date &&
        s.facilityArea?.trim() === area
      )
  );
  const removed = before - db.schedules.length;
  if (removed > 0) await saveDb(db);
  return removed;
}

/** 사무 작업 일일기록 → 해당 날짜 일정 자동 반영 */
export async function syncSchedulesFromOfficeWork(
  memberId: string,
  date: string,
  entries: OfficeWorkEntry[]
): Promise<ScheduleEntry[]> {
  await deleteSchedulesForMemberDateFacility(
    memberId,
    date,
    OFFICE_WORK_FACILITY
  );
  const filled = filledOfficeWorkEntries(entries);
  const created: ScheduleEntry[] = [];
  for (const e of filled) {
    const note = e.done.trim();
    const schedule = await upsertSchedule({
      date,
      memberId,
      title: buildOfficeWorkScheduleTitle(e.station, e.processingRole, note),
      stationName: e.station,
      facilityArea: OFFICE_WORK_FACILITY,
      note,
    });
    created.push(schedule);
  }
  return created;
}

export async function deleteSchedule(id: string): Promise<void> {
  const db = await ensureDb();
  const before = db.schedules.length;
  db.schedules = db.schedules.filter((s) => s.id !== id);
  if (db.schedules.length === before) {
    throw new Error("일정을 찾을 수 없습니다.");
  }
  await saveDb(db);
}

export async function deleteSchedulesByVisitGroup(
  date: string,
  visitGroupId: string
): Promise<number> {
  const db = await ensureDb();
  const gid = visitGroupId.trim();
  if (!gid) return 0;
  const before = db.schedules.length;
  db.schedules = db.schedules.filter(
    (s) => !(s.date === date && s.visitGroupId === gid)
  );
  const removed = before - db.schedules.length;
  if (removed > 0) await saveDb(db);
  return removed;
}

export function visitGroupIdFromSchedules(
  schedules: ScheduleEntry[],
  memberId: string,
  date: string
): string | undefined {
  return schedules.find(
    (s) => s.memberId === memberId && s.date === date && s.visitGroupId?.trim()
  )?.visitGroupId?.trim();
}

export async function saveWeeklyAnalysis(
  key: string,
  markdown: string,
  source: WeeklyAnalysisRecord["source"],
  options?: { preserveDirective?: boolean; managerDirective?: ManagerDirective }
): Promise<void> {
  const db = await ensureDb();
  db.weeklyAnalyses = db.weeklyAnalyses ?? {};
  const prev = db.weeklyAnalyses[key];
  db.weeklyAnalyses[key] = {
    markdown,
    source,
    updatedAt: new Date().toISOString(),
    managerDirective:
      options?.managerDirective ??
      (options?.preserveDirective !== false ? prev?.managerDirective : undefined),
  };
  await saveDb(db);
}

export async function saveWeeklyAnalysisDirective(
  key: string,
  directive: ManagerDirective
): Promise<void> {
  const db = await ensureDb();
  db.weeklyAnalyses = db.weeklyAnalyses ?? {};
  const prev = db.weeklyAnalyses[key];
  if (!prev?.markdown?.trim()) {
    throw new Error(
      "저장된 보고서가 없습니다. 먼저 주간 분석을 생성해 주세요."
    );
  }
  db.weeklyAnalyses[key] = {
    ...prev,
    managerDirective: directive,
    updatedAt: new Date().toISOString(),
  };
  await saveDb(db);
}

export async function loadWeeklyAnalysis(
  key: string
): Promise<WeeklyAnalysisRecord | null> {
  const db = await ensureDb();
  return db.weeklyAnalyses?.[key] ?? null;
}

/** exact key → 같은 주 시작일 키 순으로 저장된 주간 분석 탐색 */
export async function resolveWeeklyAnalysis(
  start: string,
  end: string
): Promise<{ key: string; record: WeeklyAnalysisRecord } | null> {
  const db = await ensureDb();
  const analyses = db.weeklyAnalyses ?? {};
  const exactKey = `${start}_${end}`;
  const exact = analyses[exactKey];
  if (exact?.markdown?.trim()) {
    return { key: exactKey, record: exact };
  }

  const prefix = `${start}_`;
  const byStart = Object.entries(analyses)
    .filter(([k, v]) => k.startsWith(prefix) && v.markdown?.trim())
    .sort((a, b) => {
      const ta = a[1].updatedAt ?? "";
      const tb = b[1].updatedAt ?? "";
      return tb.localeCompare(ta);
    });
  if (byStart.length > 0) {
    const [key, record] = byStart[0]!;
    return { key, record };
  }

  const suffix = `_${end}`;
  const byEnd = Object.entries(analyses)
    .filter(([k, v]) => k.endsWith(suffix) && v.markdown?.trim())
    .sort((a, b) => {
      const ta = a[1].updatedAt ?? "";
      const tb = b[1].updatedAt ?? "";
      return tb.localeCompare(ta);
    });
  if (byEnd.length === 0) return null;
  const [key, record] = byEnd[0]!;
  return { key, record };
}
