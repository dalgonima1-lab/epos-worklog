import { NextResponse } from "next/server";
import { diagnoseFirebaseCredential, isFirebaseConfigured } from "@/lib/firebaseAdmin";

export async function GET() {
  const fb = diagnoseFirebaseCredential();
  return NextResponse.json({
    ok: true,
    firebaseConfigured: isFirebaseConfigured(),
    firebaseCredentialOk: fb.firebaseOk,
    hint: fb.hint ?? null,
  });
}
