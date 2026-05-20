import { NextResponse } from "next/server";
import { getDb, getMembers } from "@/lib/db";
import { DEFAULT_TEAM_MEMBERS, DEFAULT_TEAM_NAME } from "@/lib/constants";
import type { Member } from "@/lib/types";

export async function GET() {
  let teamName = DEFAULT_TEAM_NAME;
  let members: Member[] = DEFAULT_TEAM_MEMBERS.filter((m) => m.role === "member") as Member[];

  try {
    const db = await getDb();
    teamName = db.teamName;
    members = await getMembers();
  } catch (error) {
    console.error("Failed to load members; using defaults", error);
  }

  return NextResponse.json(
    {
      teamName,
      members,
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}
