import { NextRequest, NextResponse } from "next/server";
import { Role } from "@/lib/db-types";
import { getUserFromRequest } from "@/lib/auth";
import { getUserWithTeamAccess } from "@/lib/access";
import { backfillTicketSelectorIds } from "@/lib/ticket-selector";

export async function POST(request: NextRequest) {
  try {
    const sessionUser = await getUserFromRequest(request);
    if (!sessionUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await getUserWithTeamAccess(sessionUser.id);
    if (!user || user.role !== Role.SUPER_ADMIN) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const result = await backfillTicketSelectorIds();

    return NextResponse.json({
      ok: true,
      ...result,
    });
  } catch (error) {
    console.error("Backfill selector IDs error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
