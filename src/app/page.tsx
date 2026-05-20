import Link from "next/link";
import { redirect } from "next/navigation";
import { getDb } from "@/lib/db";
import { Header } from "@/components/Header";
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
        subtitle="매일 짧게 기록하고, 주간에는 한 번에 요약합니다."
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <section className="card p-5">
          <h2 className="text-lg font-bold">직원 · 일일 기록</h2>
          <p className="muted mt-2">
            금일 수행, 익일 계획, 이슈를 하루 3~5분 안에 입력합니다. 같은 날
            수정·저장도 가능합니다.
          </p>
          <Link href="/daily" className="btn btn-primary mt-4">
            오늘 업무 작성
          </Link>
        </section>

        <section className="card p-5">
          <h2 className="text-lg font-bold">팀장 · 주간 요약</h2>
          <p className="muted mt-2">
            팀원별 제출 현황, 미제출일, 주간 통합 요약본(Markdown)을
            확인·다운로드합니다.
          </p>
          <Link href="/manager" className="btn btn-primary mt-4">
            대시보드 열기
          </Link>
          <Link href="/manager/analysis" className="btn btn-secondary mt-2">
            AI 주간 분석 (Gemini)
          </Link>
        </section>
      </div>

      <section className="card mt-4 p-5">
        <h3 className="font-semibold">MVP에 포함된 기능</h3>
        <ul className="muted mt-2 list-inside list-disc space-y-1 text-sm">
          <li>공종, 작업 전·후 사진(자동 시각), 작업시간 산정, 미비사항</li>
          <li>직원별 일일 업무 입력 (금일/익일/이슈)</li>
          <li>주간(월~금) 제출률 및 미제출일 표시</li>
          <li>팀장용 주간 요약 Markdown 생성</li>
          <li>Gemini AI: 지난주 보고서 대비 잘한 점·부족한 점·팀장 첨언 자동 정리</li>
          <li>
            팀원·팀장 PIN: Vercel+Firebase 배포 시 Firestore 문서에 저장되며, 로컬만 쓸 때는
            data/store.json에서 설정 (초기 팀장 PIN: 1234, 운영 전 변경 권장)
          </li>
        </ul>
        <p className="muted mt-3 text-sm">
          브라우저만으로 체험:{" "}
          <a className="text-blue-700 underline" href="/demo/index.html">
            오프라인 데모
          </a>
        </p>
      </section>
    </>
  );
}
