import { NextRequest, NextResponse } from "next/server";
import { Role } from "@/lib/db-types";
import { db } from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";
import { canAccessTeam, getUserWithTeamAccess } from "@/lib/access";
import { writeAuditLog } from "@/lib/audit";

function parseDateInput(value: unknown): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  if (typeof value !== "string") return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return date;
}

async function loadSprintForUser(id: string, request: NextRequest) {
  const sessionUser = await getUserFromRequest(request);
  if (!sessionUser) {
    return {
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const user = await getUserWithTeamAccess(sessionUser.id);
  if (!user) {
    return {
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  if (user.role === Role.CLIENT) {
    return {
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  const sprint = await db.sprint.findUnique({ where: { id } });
  if (!sprint) {
    return {
      response: NextResponse.json(
        { error: "Sprint not found" },
        { status: 404 },
      ),
    };
  }

  if (!canAccessTeam(user, sprint.teamId)) {
    return {
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return { user, sprint };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    const loaded = await loadSprintForUser(id, request);
    if (loaded.response) return loaded.response;

    return NextResponse.json(loaded.sprint);
  } catch (error) {
    console.error("Get sprint error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    const loaded = await loadSprintForUser(id, request);
    if (loaded.response) return loaded.response;

    const { user, sprint } = loaded;

    if (sprint.status === "CLOSED") {
      return NextResponse.json(
        { error: "Closed sprints cannot be edited" },
        { status: 400 },
      );
    }

    const body = (await request.json()) as Record<string, unknown>;
    const updates: Record<string, unknown> = {};

    if (typeof body.name === "string") {
      const name = body.name.trim();
      if (!name) {
        return NextResponse.json(
          { error: "Sprint name cannot be empty" },
          { status: 400 },
        );
      }
      updates.name = name;
    }

    if (body.goal === null || typeof body.goal === "string") {
      updates.goal = body.goal === null ? null : body.goal.trim();
    }

    if (body.projectId === null || typeof body.projectId === "string") {
      updates.projectId = body.projectId;
      if (typeof body.projectId === "string") {
        const project = await db.project.findUnique({
          where: { id: body.projectId },
          select: { id: true, teamId: true },
        });
        if (!project || project.teamId !== sprint.teamId) {
          return NextResponse.json(
            { error: "Project not found for this sprint team" },
            { status: 400 },
          );
        }
      }
    }

    const startsAt = parseDateInput(body.startsAt);
    const endsAt = parseDateInput(body.endsAt);

    if (startsAt !== undefined) updates.startsAt = startsAt;
    if (endsAt !== undefined) updates.endsAt = endsAt;

    const effectiveStart =
      startsAt === undefined ? new Date(sprint.startsAt) : startsAt;
    const effectiveEnd =
      endsAt === undefined ? new Date(sprint.endsAt) : endsAt;

    if (!effectiveStart || !effectiveEnd || effectiveStart >= effectiveEnd) {
      return NextResponse.json(
        { error: "startsAt must be before endsAt" },
        { status: 400 },
      );
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No valid fields" }, { status: 400 });
    }

    const updatedSprint = await db.sprint.update({
      where: { id },
      data: updates,
    });

    // Keep ticket schedule aligned with sprint date range.
    if (updates.startsAt instanceof Date) {
      await db.ticket.updateMany({
        where: { sprintId: id },
        data: { startDate: updates.startsAt },
      });
    }

    if (updates.endsAt instanceof Date) {
      await db.ticket.updateMany({
        where: { sprintId: id },
        data: { dueDate: updates.endsAt },
      });
    }

    await writeAuditLog({
      actorId: user.id,
      action: "SPRINT_UPDATE",
      entityType: "Sprint",
      entityId: id,
      metadata: updates,
    });

    return NextResponse.json(updatedSprint);
  } catch (error) {
    console.error("Update sprint error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
