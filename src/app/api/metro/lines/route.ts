import { NextResponse } from "next/server";
import { getMetroLines } from "@/lib/metroStations";

export const dynamic = "force-static";

export async function GET() {
  return NextResponse.json({
    lines: getMetroLines(),
    source: "seoul-metro-1-9",
  });
}
