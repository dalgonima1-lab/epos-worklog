"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isStaffDeployment } from "@/lib/staffMode";

interface HeaderProps {
  teamName: string;
  subtitle?: string;
}

const NAV_ITEMS = [
  { href: "/", label: "홈", staffHidden: true },
  { href: "/daily", label: "일일 기록", staffHidden: false },
  { href: "/stations/history", label: "역사 히스토리", staffHidden: false },
  { href: "/manager", label: "관리자 대시보드", staffHidden: true },
  { href: "/manager/analysis", label: "AI 주간분석", staffHidden: true },
] as const;

export function Header({ teamName, subtitle }: HeaderProps) {
  const staff = isStaffDeployment();
  const pathname = usePathname();

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <header className="site-header">
      <div className="site-brand">
        <span className="site-brand-mark" aria-hidden>
          E
        </span>
        {staff ? "EPOS 일일기록" : "EPOS Worklog"}
      </div>
      <h1 className="site-title">{teamName}</h1>
      {subtitle ? <p className="muted mt-1.5 max-w-2xl">{subtitle}</p> : null}
      <nav className="site-nav" aria-label="주 메뉴">
        {NAV_ITEMS.filter((item) => !staff || !item.staffHidden).map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`site-nav-link ${isActive(item.href) ? "active" : ""}`}
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
