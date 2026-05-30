import { isFirebaseConfigured } from "./firebaseAdmin";

/** Vercel·Lambda 등 읽기 전용 배포에서는 data/*.md 미러링 생략 */
export function shouldMirrorAnalysisToDisk(): boolean {
  if (process.env.VERCEL === "1" || process.env.VERCEL === "true") {
    return false;
  }
  if (process.env.AWS_LAMBDA_FUNCTION_NAME) return false;
  if (process.env.NEXT_RUNTIME === "edge") return false;
  if (isFirebaseConfigured()) return false;
  return true;
}
