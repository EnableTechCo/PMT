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

    if (sprint.status !== SprintStatus.PLANNED) {
      return NextResponse.json(
        { error: "Only planned sprints can be started" },
        { status: 400 },
      );
    }

    const activeSprint = await db.sprint.findFirst({
      where: {
        teamId: sprint.teamId,
        status: SprintStatus.ACTIVE,
      },
      select: { id: true },
    });

    if (activeSprint && activeSprint.id !== sprint.id) {
      return NextResponse.json(
        { error: "A team can only have one active sprint" },
        { status: 409 },
      );
    }

    const updated = await db.sprint.update({
      where: { id: sprint.id },
      data: {
        status: SprintStatus.ACTIVE,
        completedAt: null,
      },
    });

    await writeAuditLog({
      actorId: user.id,
      action: "SPRINT_START",
      entityType: "Sprint",
      entityId: sprint.id,
      metadata: {
        previousStatus: sprint.status,
        nextStatus: SprintStatus.ACTIVE,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Start sprint error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
