import { getDb } from "@/lib/db";
import { Header } from "@/components/Header";
import { HomeWeekCalendar } from "@/components/HomeWeekCalendar";
import { DEFAULT_TEAM_NAME } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  let teamName = DEFAULT_TEAM_NAME;
  try {
    const db = await getDb();
    teamName = db.teamName;
  } catch {
    // Firebase 미연결·빌드 환경에서는 기본 팀명 사용
  }

  return (
    <>
      <Header
        teamName={teamName}
        subtitle="팀원별 주간 일정 · 칸을 눌러 일일 기록"
      />
      <HomeWeekCalendar teamName={teamName} />
    </>
  );
}
