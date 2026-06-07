import type { WriteBatch } from "firebase-admin/firestore";
import { getFirebaseDb } from "./firebaseAdmin";
import type {
  DailyReport,
  Database,
  ScheduleEntry,
  WeeklyAnalysisRecord,
  MemberWeekPlan,
  Member,
  StationRecord,
} from "./types";

export const FIRESTORE_STORAGE_VERSION = 2;
export const CLOUD_DB_COLLECTION = "epos-worklog";
export const CLOUD_DB_DOC = "main";
export const REPORTS_SUBCOLLECTION = "reports";
export const SCHEDULES_SUBCOLLECTION = "schedules";

/** 단일 문서에 넣지 않는 메타 필드 (reports·schedules는 서브컬렉션) */
export type FirestoreMetaDocument = {
  teamName: string;
  managerPin: string;
  members: Member[];
  stationHistory: StationRecord[];
  stationCatalogVersion?: number;
  dataSanitizeVersion?: number;
  storageVersion: number;
  weekPlans?: Record<string, MemberWeekPlan[]>;
  weeklyAnalyses?: Record<string, WeeklyAnalysisRecord>;
};

export const DEFAULT_FIRESTORE_META: FirestoreMetaDocument = {
  teamName: "EPOS 관리팀",
  managerPin: "1234",
  members: [],
  stationHistory: [],
  storageVersion: FIRESTORE_STORAGE_VERSION,
};

function mainRef() {
  return getFirebaseDb()
    .collection(CLOUD_DB_COLLECTION)
    .doc(CLOUD_DB_DOC);
}

function reportsRef() {
  return mainRef().collection(REPORTS_SUBCOLLECTION);
}

function schedulesRef() {
  return mainRef().collection(SCHEDULES_SUBCOLLECTION);
}

export function isLegacyMonolithicDoc(
  data: Record<string, unknown> | undefined
): boolean {
  if (!data) return false;
  if (data.storageVersion === FIRESTORE_STORAGE_VERSION) return false;
  return (
    Array.isArray(data.reports) ||
    Array.isArray(data.schedules) ||
    data.storageVersion == null
  );
}

export function metaFromDatabase(db: Database): FirestoreMetaDocument {
  return {
    teamName: db.teamName,
    managerPin: db.managerPin,
    members: db.members,
    stationHistory: db.stationHistory,
    stationCatalogVersion: db.stationCatalogVersion,
    dataSanitizeVersion: db.dataSanitizeVersion,
    storageVersion: FIRESTORE_STORAGE_VERSION,
    weekPlans: db.weekPlans,
    weeklyAnalyses: db.weeklyAnalyses,
  };
}

export function databaseFromMeta(
  meta: FirestoreMetaDocument
): Database {
  return {
    ...meta,
    reports: [],
    schedules: [],
  };
}

const BATCH_LIMIT = 400;

async function commitBatches<T extends { id: string }>(
  items: T[],
  write: (batch: WriteBatch, item: T) => void
): Promise<void> {
  const firestore = getFirebaseDb();
  for (let i = 0; i < items.length; i += BATCH_LIMIT) {
    const batch = firestore.batch();
    for (const item of items.slice(i, i + BATCH_LIMIT)) {
      write(batch, item);
    }
    await batch.commit();
  }
}

/** 레거시 단일 문서 → 메타 + reports/schedules 서브컬렉션 */
export async function migrateMonolithicToSplit(
  legacy: Database
): Promise<FirestoreMetaDocument> {
  const meta = metaFromDatabase(legacy);
  const root = mainRef();

  const reports = Array.isArray(legacy.reports) ? legacy.reports : [];
  const schedules = Array.isArray(legacy.schedules) ? legacy.schedules : [];

  if (reports.length) {
    await commitBatches(reports, (batch, report) => {
      batch.set(reportsRef().doc(report.id), report);
    });
  }

  if (schedules.length) {
    await commitBatches(schedules, (batch, schedule) => {
      batch.set(schedulesRef().doc(schedule.id), schedule);
    });
  }

  await root.set(meta);
  return meta;
}

export async function loadFirestoreMeta(): Promise<FirestoreMetaDocument> {
  const snapshot = await mainRef().get();
  if (!snapshot.exists) {
    const meta = { ...DEFAULT_FIRESTORE_META };
    await mainRef().set(meta);
    return meta;
  }

  const data = snapshot.data() as Record<string, unknown>;

  if (isLegacyMonolithicDoc(data)) {
    const legacy = data as unknown as Database;
    return migrateMonolithicToSplit(legacy);
  }

  return data as FirestoreMetaDocument;
}

export async function saveFirestoreMeta(
  meta: FirestoreMetaDocument
): Promise<void> {
  await mainRef().set({
    ...meta,
    storageVersion: FIRESTORE_STORAGE_VERSION,
  });
}

export async function getSplitReport(
  memberId: string,
  date: string
): Promise<DailyReport | null> {
  const id = `r_${memberId}_${date}`;
  const snap = await reportsRef().doc(id).get();
  if (!snap.exists) return null;
  return snap.data() as DailyReport;
}

export async function setSplitReport(report: DailyReport): Promise<void> {
  await reportsRef().doc(report.id).set(report);
}

export async function listSplitReportsInRange(
  startDate: string,
  endDate: string
): Promise<DailyReport[]> {
  const snap = await reportsRef()
    .where("date", ">=", startDate)
    .where("date", "<=", endDate)
    .get();
  return snap.docs.map((d) => d.data() as DailyReport);
}

export async function listAllSplitReports(): Promise<DailyReport[]> {
  const snap = await reportsRef().get();
  return snap.docs.map((d) => d.data() as DailyReport);
}

export async function getSplitSchedule(
  id: string
): Promise<ScheduleEntry | undefined> {
  const snap = await schedulesRef().doc(id).get();
  if (!snap.exists) return undefined;
  return snap.data() as ScheduleEntry;
}

export async function setSplitSchedule(
  schedule: ScheduleEntry
): Promise<void> {
  await schedulesRef().doc(schedule.id).set(schedule);
}

export async function deleteSplitSchedule(id: string): Promise<boolean> {
  const ref = schedulesRef().doc(id);
  const snap = await ref.get();
  if (!snap.exists) return false;
  await ref.delete();
  return true;
}

export async function listSplitSchedulesInRange(
  startDate: string,
  endDate: string
): Promise<ScheduleEntry[]> {
  const snap = await schedulesRef()
    .where("date", ">=", startDate)
    .where("date", "<=", endDate)
    .get();
  return snap.docs
    .map((d) => d.data() as ScheduleEntry)
    .sort((a, b) => {
      const byDate = a.date.localeCompare(b.date);
      if (byDate !== 0) return byDate;
      return a.updatedAt.localeCompare(b.updatedAt);
    });
}

export async function listSplitSchedulesForDate(
  date: string
): Promise<ScheduleEntry[]> {
  return listSplitSchedulesInRange(date, date);
}

export async function deleteSplitSchedulesByIds(ids: string[]): Promise<number> {
  if (!ids.length) return 0;
  const firestore = getFirebaseDb();
  let removed = 0;
  for (let i = 0; i < ids.length; i += BATCH_LIMIT) {
    const batch = firestore.batch();
    for (const id of ids.slice(i, i + BATCH_LIMIT)) {
      batch.delete(schedulesRef().doc(id));
      removed += 1;
    }
    await batch.commit();
  }
  return removed;
}

export async function countSplitDocuments(): Promise<{
  reports: number;
  schedules: number;
}> {
  const [reportsSnap, schedulesSnap] = await Promise.all([
    reportsRef().select().get(),
    schedulesRef().select().get(),
  ]);
  return {
    reports: reportsSnap.size,
    schedules: schedulesSnap.size,
  };
}
