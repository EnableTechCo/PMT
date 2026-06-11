import { NextRequest, NextResponse } from "next/server";
import { Role } from "@/lib/db-types";
import { db } from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";
import { canAccessTeam, getUserWithTeamAccess } from "@/lib/access";
import { writeAuditLog } from "@/lib/audit";

function extractTicketIds(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return input.filter((value): value is string => typeof value === "string" && value.length > 0);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    const sessionUser = await getUserFromRequest(request);
    if (!sessionUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await getUserWithTeamAccess(sessionUser.id);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (user.role === Role.CLIENT) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const sprint = await db.sprint.findUnique({
      where: { id },
      select: { id: true, teamId: true },
    });

    if (!sprint) {
      return NextResponse.json({ error: "Sprint not found" }, { status: 404 });
    }

    if (!canAccessTeam(user, sprint.teamId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = (await request.json()) as Record<string, unknown>;
    const ticketIds = Array.from(new Set(extractTicketIds(body.ticketIds)));

    if (ticketIds.length === 0) {
      return NextResponse.json({ error: "ticketIds are required" }, { status: 400 });
    }

    const result = await db.ticket.updateMany({
      where: {
        id: { in: ticketIds },
        teamId: sprint.teamId,
        sprintId: sprint.id,
      },
      data: { sprintId: null },
    });

    await writeAuditLog({
      actorId: user.id,
      action: "SPRINT_BULK_REMOVE_TICKETS",
      entityType: "Sprint",
      entityId: sprint.id,
      metadata: { ticketIds, count: result.count },
    });

    return NextResponse.json({
      sprintId: sprint.id,
      updatedCount: result.count,
    });
  } catch (error) {
    console.error("Bulk remove sprint tickets error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
