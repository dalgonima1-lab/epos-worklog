import { redirect } from "next/navigation";
import { getDb } from "@/lib/db";
import { Header } from "@/components/Header";
import { HomeWeekCalendar } from "@/components/HomeWeekCalendar";
import { DEFAULT_TEAM_NAME } from "@/lib/constants";
import { isStaffDeployment } from "@/lib/staffMode";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  if (isStaffDeployment()) {
    redirect("/daily");
  }

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
        subtitle="저번주·이번주·다음주 일정을 보고, 눌러서 일일 기록을 작성·수정하세요."
      />
      <HomeWeekCalendar teamName={teamName} />
    </>
  );
}
