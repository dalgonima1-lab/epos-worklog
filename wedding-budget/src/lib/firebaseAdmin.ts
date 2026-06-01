import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

let firestoreSettingsApplied = false;

export function formatFirestoreUserError(error: unknown): string {
  const msg = error instanceof Error ? error.message : String(error);
  const code = (error as { code?: number }).code;

  if (code === 5 || /NOT_FOUND/i.test(msg)) {
    return [
      "Firestore를 찾을 수 없습니다.",
      "Firebase 콘솔에서 Firestore를 만들었는지, FIREBASE_PROJECT_ID가 맞는지 확인하세요.",
    ].join(" ");
  }

  if (code === 7 || /PERMISSION_DENIED/i.test(msg)) {
    return "Firestore 접근이 거부되었습니다. 서비스 계정 권한을 확인하세요.";
  }

  if (/parse private key|DECODER routines|unsupported/i.test(msg)) {
    return "FIREBASE_PRIVATE_KEY 형식이 올바르지 않습니다. 줄바꿈은 \\n 으로 넣어 주세요.";
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
      hint: "Firebase 환경변수 3개가 필요합니다.",
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
      hint: "private_key 값만 복사했는지 확인하세요.",
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

function getFirebaseApp() {
  if (!isFirebaseConfigured()) {
    throw new Error("Firebase 환경변수가 설정되지 않았습니다.");
  }
  if (getApps().length > 0) return getApps()[0];
  return initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: getPrivateKey(),
    }),
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
