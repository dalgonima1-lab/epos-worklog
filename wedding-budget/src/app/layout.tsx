import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "우리 결혼자금 노트",
  description: "둘이 함께 보는 결혼 준비 자금 관리",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body style={{ margin: 0 }}>{children}</body>
    </html>
  );
}
