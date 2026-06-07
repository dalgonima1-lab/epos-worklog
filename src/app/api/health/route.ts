import { NextResponse } from "next/server";
import { getFirestoreStorageDiagnostics } from "@/lib/db";
import {
  diagnoseFirebaseCredential,
  isFirebaseConfigured,
  isFirebaseStorageConfigured,
} from "@/lib/firebaseAdmin";

export async function GET() {
  const fb = diagnoseFirebaseCredential();
  const firestoreStorage = await getFirestoreStorageDiagnostics().catch(
    () => null
  );
  return NextResponse.json(
    {
      ok: true,
      firebaseConfigured: isFirebaseConfigured(),
      firebaseCredentialOk: fb.firebaseOk,
      firebasePrivateKeyShapeOk: fb.privateKeyShapeOk,
      firebaseHint: fb.hint ?? null,
      firebaseStorageConfigured: isFirebaseStorageConfigured(),
      storageMode: isFirebaseStorageConfigured()
        ? "firebase-storage"
        : isFirebaseConfigured()
          ? "firestore-inline-photos"
          : "local-json",
      firestoreStorage,
      geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
