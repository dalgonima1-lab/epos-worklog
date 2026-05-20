import Link from "next/link";
import { isStaffDeployment } from "@/lib/staffMode";

interface HeaderProps {
  teamName: string;
  subtitle?: string;
}

export function Header({ teamName, subtitle }: HeaderProps) {
  const staff = isStaffDeployment();

  return (
    <header className="mb-6">
      <p className="text-sm font-semibold text-blue-700">
        {staff ? "EPOS 일일기록 (직원용)" : "EPOS Worklog"}
      </p>
      <h1 className="mt-1 text-2xl font-bold tracking-tight">{teamName}</h1>
      {subtitle && <p className="muted mt-1">{subtitle}</p>}
      <nav className="mt-4 flex flex-wrap gap-2">
        {!staff && (
          <Link href="/" className="btn btn-ghost text-sm">
            홈
          </Link>
        )}
        <Link href="/daily" className="btn btn-ghost text-sm">
          일일 기록
        </Link>
        {!staff && (
          <>
            <Link href="/manager" className="btn btn-ghost text-sm">
              팀장 대시보드
            </Link>
            <Link href="/manager/analysis" className="btn btn-ghost text-sm">
              AI 주간분석
            </Link>
          </>
        )}
      </nav>
    </header>
  );
}
