import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

let firestoreSettingsApplied = false;

/** gRPC 오류를 비개발자도 이해할 수 있는 한국어로 */
export function formatFirestoreUserError(error: unknown): string {
  const msg = error instanceof Error ? error.message : String(error);
  const code = (error as { code?: number }).code;

  if (code === 5 || /NOT_FOUND/i.test(msg)) {
    return [
      "Firestore를 찾을 수 없습니다(NOT_FOUND).",
      "① Firebase 콘솔에서 해당 프로젝트에 「Firestore Database」를 만들었는지 확인하세요.",
      "② Vercel 환경변수 FIREBASE_PROJECT_ID가 그 프로젝트 ID와 같은지 확인하세요.",
      "③ 서비스 계정 JSON의 project_id와 위 ID가 같아야 합니다.",
    ].join(" ");
  }

  if (code === 7 || /PERMISSION_DENIED/i.test(msg)) {
    return [
      "Firestore 접근이 거부되었습니다(PERMISSION_DENIED).",
      "① Google Cloud에서 Firestore API가 켜져 있는지,",
      "② 서비스 계정에 Cloud Datastore/Firestore 사용자 권한이 있는지 확인하세요.",
    ].join(" ");
  }

  if (/UNAVAILABLE/i.test(msg)) {
    return "Firestore 서비스에 일시적으로 연결하지 못했습니다. 잠시 후 다시 시도하세요.";
  }

  return msg;
}
export function isFirebaseConfigured(): boolean {
  return Boolean(
    process.env.FIREBASE_PROJECT_ID &&
      process.env.FIREBASE_CLIENT_EMAIL &&
      process.env.FIREBASE_PRIVATE_KEY
  );
}

export function isFirebaseStorageConfigured(): boolean {
  return Boolean(isFirebaseConfigured() && process.env.FIREBASE_STORAGE_BUCKET);
}

function getPrivateKey(): string {
  return (process.env.FIREBASE_PRIVATE_KEY ?? "").replace(/\\n/g, "\n");
}

export function getFirebaseApp() {
  if (!isFirebaseConfigured()) {
    throw new Error("Firebase 환경변수가 설정되지 않았습니다.");
  }

  if (getApps().length > 0) {
    return getApps()[0];
  }

  return initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: getPrivateKey(),
    }),
    ...(process.env.FIREBASE_STORAGE_BUCKET
      ? { storageBucket: process.env.FIREBASE_STORAGE_BUCKET }
      : {}),
  });
}

export function getFirebaseDb() {
  const db = getFirestore(getFirebaseApp());
  if (!firestoreSettingsApplied) {
    db.settings({ ignoreUndefinedProperties: true });
    firestoreSettingsApplied = true;
  }
  return db;
}

export function getFirebaseBucket() {
  if (!isFirebaseStorageConfigured()) {
    throw new Error("Firebase Storage 버킷이 설정되지 않았습니다.");
  }
  return getStorage(getFirebaseApp()).bucket();
}
