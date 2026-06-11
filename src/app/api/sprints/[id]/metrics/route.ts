import { NextRequest, NextResponse } from "next/server";
import { Role } from "@/lib/db-types";
import { db } from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";
import { canAccessTeam, getUserWithTeamAccess } from "@/lib/access";

export async function GET(
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
      select: { id: true, teamId: true, status: true },
    });

    if (!sprint) {
      return NextResponse.json({ error: "Sprint not found" }, { status: 404 });
    }

    if (!canAccessTeam(user, sprint.teamId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const [plannedCount, completedCount] = await Promise.all([
      db.ticket.count({ where: { sprintId: sprint.id } }),
      db.ticket.count({ where: { sprintId: sprint.id, status: "COMPLETE" } }),
    ]);

    const spilloverCount = Math.max(plannedCount - completedCount, 0);
    const completionRate =
      plannedCount === 0 ? 0 : Number(((completedCount / plannedCount) * 100).toFixed(2));

    return NextResponse.json({
      sprintId: sprint.id,
      sprintStatus: sprint.status,
      plannedCount,
      completedCount,
      spilloverCount,
      completionRate,
    });
  } catch (error) {
    console.error("Get sprint metrics error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
