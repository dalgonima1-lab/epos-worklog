import { readFileSync } from "fs";
import { resolve } from "path";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

const MEMBER_ID = process.argv[2] ?? "m1";
const credPath = resolve(
  process.cwd(),
  "epos-daily-firebase-adminsdk-fbsvc-7c0dbd4a74.json"
);
const serviceAccount = JSON.parse(readFileSync(credPath, "utf8"));

if (!getApps().length) {
  initializeApp({
    credential: cert(serviceAccount),
    storageBucket: `${serviceAccount.project_id}.appspot.com`,
  });
}

const firestore = getFirestore();
firestore.settings({ ignoreUndefinedProperties: true });

const COL = "epos-worklog";
const DOC = "main";
const BATCH_LIMIT = 400;

async function batchDelete(collectionRef, docs) {
  let removed = 0;
  for (let i = 0; i < docs.length; i += BATCH_LIMIT) {
    const batch = firestore.batch();
    for (const doc of docs.slice(i, i + BATCH_LIMIT)) {
      batch.delete(doc.ref);
      removed += 1;
    }
    await batch.commit();
  }
  return removed;
}

async function deleteMemberPhotos() {
  try {
    const bucket = getStorage().bucket();
    const [files] = await bucket.getFiles({ prefix: `uploads/${MEMBER_ID}/` });
    if (!files.length) return 0;
    await Promise.all(files.map((f) => f.delete()));
    return files.length;
  } catch (e) {
    console.warn("Storage photo cleanup skipped:", e.message);
    return 0;
  }
}

async function main() {
  const root = firestore.collection(COL).doc(DOC);
  const reportsRef = root.collection("reports");
  const schedulesRef = root.collection("schedules");

  const [reportSnap, scheduleSnap, metaSnap] = await Promise.all([
    reportsRef.where("memberId", "==", MEMBER_ID).get(),
    schedulesRef.where("memberId", "==", MEMBER_ID).get(),
    root.get(),
  ]);

  if (!metaSnap.exists) {
    throw new Error("Firestore main document not found");
  }

  const meta = metaSnap.data();
  const memberName =
    (meta.members ?? []).find((m) => m.id === MEMBER_ID)?.name ?? MEMBER_ID;

  console.log(`Removing member: ${memberName} (${MEMBER_ID})`);
  console.log(`Reports to delete: ${reportSnap.size}`);
  console.log(`Schedules to delete: ${scheduleSnap.size}`);

  const removedReports = await batchDelete(reportsRef, reportSnap.docs);
  const removedSchedules = await batchDelete(schedulesRef, scheduleSnap.docs);
  const removedPhotos = await deleteMemberPhotos();

  const members = (meta.members ?? []).filter((m) => m.id !== MEMBER_ID);
  const weekPlans = { ...(meta.weekPlans ?? {}) };
  let weekPlanEntriesRemoved = 0;
  for (const key of Object.keys(weekPlans)) {
    const before = weekPlans[key]?.length ?? 0;
    const filtered = (weekPlans[key] ?? []).filter(
      (p) => p.memberId !== MEMBER_ID
    );
    weekPlanEntriesRemoved += before - filtered.length;
    if (filtered.length) weekPlans[key] = filtered;
    else delete weekPlans[key];
  }

  await root.set({
    ...meta,
    members,
    weekPlans,
    storageVersion: meta.storageVersion ?? 2,
  });

  console.log("\nDone:");
  console.log(`  reports deleted: ${removedReports}`);
  console.log(`  schedules deleted: ${removedSchedules}`);
  console.log(`  photos deleted: ${removedPhotos}`);
  console.log(`  week plan entries removed: ${weekPlanEntriesRemoved}`);
  console.log(
    `  remaining members: ${members.map((m) => m.name).join(", ")}`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
