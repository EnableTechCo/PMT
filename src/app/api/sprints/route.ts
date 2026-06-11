import { NextRequest, NextResponse } from "next/server";
import { Role, SprintStatus } from "@/lib/db-types";
import { db } from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";
import {
  canAccessTeam,
  getUserWithTeamAccess,
  teamIdsForUser,
} from "@/lib/access";
import { writeAuditLog } from "@/lib/audit";

const SPRINT_STATUS_SET = new Set<string>(Object.values(SprintStatus));

function parseDateInput(value: unknown): Date | null {
  if (typeof value !== "string" || !value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url);
    const teamId = searchParams.get("teamId");
    const status = searchParams.get("status");

    const where: Record<string, unknown> = {};

    if (status && SPRINT_STATUS_SET.has(status)) {
      where.status = status;
    }

    if (teamId) {
      if (!canAccessTeam(user, teamId)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      where.teamId = teamId;
    } else if (user.role === Role.USER) {
      const teamIds = teamIdsForUser(user) ?? [];
      if (teamIds.length === 0) {
        return NextResponse.json([]);
      }
      where.teamId = { in: teamIds };
    }

    const sprints = await db.sprint.findMany({
      where,
      orderBy: [{ startsAt: "desc" }, { createdAt: "desc" }],
    });

    return NextResponse.json(sprints);
  } catch (error) {
    console.error("Get sprints error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
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

    const body = (await request.json()) as Record<string, unknown>;

    const name = typeof body.name === "string" ? body.name.trim() : "";
    const teamId = typeof body.teamId === "string" ? body.teamId : "";
    const projectId =
      typeof body.projectId === "string" && body.projectId
        ? body.projectId
        : null;
    const goal =
      typeof body.goal === "string"
        ? body.goal.trim() || null
        : body.goal === null
          ? null
          : undefined;

    const startsAt = parseDateInput(body.startsAt);
    const endsAt = parseDateInput(body.endsAt);

    const status =
      typeof body.status === "string" && SPRINT_STATUS_SET.has(body.status)
        ? body.status
        : SprintStatus.PLANNED;

    if (!name) {
      return NextResponse.json(
        { error: "Sprint name is required" },
        { status: 400 },
      );
    }

    if (!teamId) {
      return NextResponse.json(
        { error: "teamId is required" },
        { status: 400 },
      );
    }

    if (!startsAt || !endsAt) {
      return NextResponse.json(
        { error: "startsAt and endsAt are required valid dates" },
        { status: 400 },
      );
    }

    if (startsAt >= endsAt) {
      return NextResponse.json(
        { error: "startsAt must be before endsAt" },
        { status: 400 },
      );
    }

    if (!canAccessTeam(user, teamId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (projectId) {
      const project = await db.project.findUnique({
        where: { id: projectId },
        select: { id: true, teamId: true },
      });
      if (!project || project.teamId !== teamId) {
        return NextResponse.json(
          { error: "Project not found for this team" },
          { status: 400 },
        );
      }
    }

    if (status === SprintStatus.ACTIVE) {
      const activeSprint = await db.sprint.findFirst({
        where: { teamId, status: SprintStatus.ACTIVE },
        select: { id: true },
      });
      if (activeSprint) {
        return NextResponse.json(
          { error: "A team can only have one active sprint" },
          { status: 409 },
        );
      }
    }

    const sprint = await db.sprint.create({
      data: {
        name,
        teamId,
        projectId,
        goal: goal ?? null,
        startsAt,
        endsAt,
        status,
        completedAt: status === SprintStatus.COMPLETED ? new Date() : null,
        createdById: user.id,
      },
    });

    await writeAuditLog({
      actorId: user.id,
      action: "SPRINT_CREATE",
      entityType: "Sprint",
      entityId: sprint.id,
      metadata: {
        teamId,
        projectId,
        status,
        startsAt,
        endsAt,
      },
    });

    return NextResponse.json(sprint, { status: 201 });
  } catch (error) {
    console.error("Create sprint error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
