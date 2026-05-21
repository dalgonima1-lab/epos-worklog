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

  if (/parse private key|DECODER routines|unsupported/i.test(msg)) {
    return [
      "FIREBASE_PRIVATE_KEY 형식이 올바르지 않습니다.",
      "Firebase JSON의 private_key 값만 복사하고, 줄바꿈은 \\n 으로 넣어 주세요.",
      "예: FIREBASE_PRIVATE_KEY=\"-----BEGIN PRIVATE KEY-----\\n(한 줄)\\n-----END PRIVATE KEY-----\\n\"",
      "JSON 파일 전체를 넣거나, 키가 잘렸으면 새 비공개 키를 발급해 주세요.",
    ].join(" ");
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
  let raw = (process.env.FIREBASE_PRIVATE_KEY ?? "").trim();
  while (
    (raw.startsWith('"') && raw.endsWith('"')) ||
    (raw.startsWith("'") && raw.endsWith("'"))
  ) {
    raw = raw.slice(1, -1).trim();
  }
  while (raw.includes("\\n")) {
    raw = raw.replace(/\\n/g, "\n");
  }
  return raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

/** 배포 환경 점검용 — 키 내용은 노출하지 않음 */
export function diagnoseFirebaseCredential(): {
  envPresent: boolean;
  privateKeyShapeOk: boolean;
  firebaseOk: boolean;
  hint?: string;
} {
  const envPresent = isFirebaseConfigured();
  if (!envPresent) {
    return {
      envPresent: false,
      privateKeyShapeOk: false,
      firebaseOk: false,
      hint: "FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY 가 비어 있습니다.",
    };
  }

  const key = getPrivateKey();
  const privateKeyShapeOk =
    /BEGIN (?:RSA )?PRIVATE KEY/.test(key) &&
    /END (?:RSA )?PRIVATE KEY/.test(key);

  if (!privateKeyShapeOk) {
    return {
      envPresent: true,
      privateKeyShapeOk: false,
      firebaseOk: false,
      hint: "PRIVATE_KEY 형식이 아닙니다. JSON 파일의 private_key 값만 복사했는지 확인하세요.",
    };
  }

  try {
    cert({
      projectId: process.env.FIREBASE_PROJECT_ID!,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
      privateKey: key,
    });
    return { envPresent: true, privateKeyShapeOk: true, firebaseOk: true };
  } catch (e) {
    return {
      envPresent: true,
      privateKeyShapeOk: true,
      firebaseOk: false,
      hint: formatFirestoreUserError(e),
    };
  }
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
