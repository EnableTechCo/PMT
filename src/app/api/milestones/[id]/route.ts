import { NextRequest, NextResponse } from "next/server";
import { Role } from "@/lib/db-types";
import { db } from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";
import { canAccessTeam, getUserWithTeamAccess } from "@/lib/access";
import { writeAuditLog } from "@/lib/audit";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const session = await getUserFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await getUserWithTeamAccess(session.id);
    if (!user || user.role === Role.CLIENT) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const milestone = await db.milestone.findUnique({
      where: { id },
      include: { project: { select: { teamId: true } } },
    });

    if (!milestone) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (!canAccessTeam(user, milestone.project.teamId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const completedAt =
      body.completed === true
        ? new Date()
        : body.completed === false
          ? null
          : undefined;

    const data: { completedAt?: Date | null; title?: string; dueDate?: Date | null } =
      {};
    if (completedAt !== undefined) data.completedAt = completedAt;
    if (typeof body.title === "string") data.title = body.title.trim();
    if (body.dueDate === null) data.dueDate = null;
    else if (typeof body.dueDate === "string" && body.dueDate) {
      const d = new Date(body.dueDate);
      if (!Number.isNaN(d.getTime())) data.dueDate = d;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "No valid fields" }, { status: 400 });
    }

    const updated = await db.milestone.update({
      where: { id },
      data,
    });

    await writeAuditLog({
      actorId: user.id,
      action: "MILESTONE_UPDATE",
      entityType: "Milestone",
      entityId: id,
      metadata: data as Record<string, unknown>,
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Milestone PATCH error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
