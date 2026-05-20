/**
 * 직원 전용 배포(Vercel 등)에서 `NEXT_PUBLIC_STAFF_ONLY=true` 로 설정합니다.
 * 같은 Firebase·같은 코드베이스를 쓰되, 팀장 화면·분석 API는 막습니다.
 */
export function isStaffDeployment(): boolean {
  return process.env.NEXT_PUBLIC_STAFF_ONLY === "true";
}
