import { NextResponse } from "next/server";
import { isFirebaseConfigured, isFirebaseStorageConfigured } from "@/lib/firebaseAdmin";

export async function GET() {
  return NextResponse.json(
    {
      ok: true,
      firebaseConfigured: isFirebaseConfigured(),
      firebaseStorageConfigured: isFirebaseStorageConfigured(),
      storageMode: isFirebaseStorageConfigured()
        ? "firebase-storage"
        : isFirebaseConfigured()
          ? "firestore-inline-photos"
          : "local-json",
      geminiConfigured: Boolean(process.env.GEMINI_API_KEY)
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
