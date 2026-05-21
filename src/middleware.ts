import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

function staffOnly(): boolean {
  return process.env.NEXT_PUBLIC_STAFF_ONLY === "true";
}

export function middleware(request: NextRequest) {
  if (!staffOnly()) {
    return NextResponse.next();
  }

  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/api/")) {
    if (
      pathname.startsWith("/api/auth/manager") ||
      pathname === "/api/summary" ||
      pathname.startsWith("/api/summary/") ||
      pathname.startsWith("/api/analysis")
    ) {
      return NextResponse.json(
        { error: "직원 전용 주소에서는 이 기능을 사용할 수 없습니다." },
        { status: 403 }
      );
    }
    return NextResponse.next();
  }

  if (pathname.startsWith("/manager")) {
    return NextResponse.redirect(new URL("/daily", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/manager/:path*",
    "/api/auth/manager",
    "/api/summary",
    "/api/summary/:path*",
    "/api/analysis/:path*",
  ],
};
