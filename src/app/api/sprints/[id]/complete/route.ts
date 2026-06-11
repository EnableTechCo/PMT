import { NextRequest, NextResponse } from "next/server";
import { Role, SprintStatus } from "@/lib/db-types";
import { db } from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";
import { canAccessTeam, getUserWithTeamAccess } from "@/lib/access";
import { writeAuditLog } from "@/lib/audit";

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

    const sprint = await db.sprint.findUnique({ where: { id } });
    if (!sprint) {
      return NextResponse.json({ error: "Sprint not found" }, { status: 404 });
    }

    if (!canAccessTeam(user, sprint.teamId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (sprint.status !== SprintStatus.ACTIVE) {
      return NextResponse.json(
        { error: "Only active sprints can be completed" },
        { status: 400 },
      );
    }

    const completedAt = new Date();

    const updated = await db.sprint.update({
      where: { id: sprint.id },
      data: {
        status: SprintStatus.COMPLETED,
        completedAt,
      },
    });

    await writeAuditLog({
      actorId: user.id,
      action: "SPRINT_COMPLETE",
      entityType: "Sprint",
      entityId: sprint.id,
      metadata: {
        previousStatus: sprint.status,
        nextStatus: SprintStatus.COMPLETED,
        completedAt,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Complete sprint error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
