import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "EPOS 일일업무 · 주간요약",
  description: "EPOS 관리팀 일일 업무 기록 및 주간 요약 시스템",
  manifest: "/manifest.json",
  applicationName: "EPOS 일일업무",
  appleWebApp: {
    capable: true,
    title: "EPOS 업무",
    statusBarStyle: "default",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>
        <div className="app-shell mx-auto min-h-screen max-w-5xl px-4 py-8 sm:px-6 lg:py-10">
          {children}
        </div>
      </body>
    </html>
  );
}
