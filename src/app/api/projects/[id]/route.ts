import { NextRequest, NextResponse } from "next/server";
import { ProjectHealth, ProjectStatus, Role } from "@/lib/db-types";
import { db } from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";
import { canAccessTeam, getUserWithTeamAccess } from "@/lib/access";
import { writeAuditLog } from "@/lib/audit";

const projectInclude = {
  team: { select: { id: true, name: true } },
  portfolio: { select: { id: true, name: true } },
  client: { select: { id: true, name: true, email: true } },
  milestones: { orderBy: { sortOrder: "asc" as const } },
  githubRepos: { select: { id: true, owner: true, name: true, url: true } },
  _count: { select: { tickets: true } },
} as const;

function isProjectRelationError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const maybe = error as {
    code?: unknown;
    message?: unknown;
    details?: unknown;
  };
  const code = typeof maybe.code === "string" ? maybe.code : "";
  const message = typeof maybe.message === "string" ? maybe.message : "";
  const details = typeof maybe.details === "string" ? maybe.details : "";
  return (
    code === "PGRST200" &&
    (message.includes("Project") || details.includes("Project"))
  );
}

async function hydrateProjectById(id: string) {
  const project = await db.project.findUnique({ where: { id } });
  if (!project) return null;

  const [team, portfolio, client, milestones, githubRepos, tickets] =
    await Promise.all([
      project.teamId
        ? db.team.findUnique({
            where: { id: project.teamId },
            select: { id: true, name: true },
          })
        : Promise.resolve(null),
      project.portfolioId
        ? db.portfolio.findUnique({
            where: { id: project.portfolioId },
            select: { id: true, name: true },
          })
        : Promise.resolve(null),
      project.clientId
        ? db.client.findUnique({
            where: { id: project.clientId },
            select: { id: true, name: true, email: true },
          })
        : Promise.resolve(null),
      db.milestone.findMany({
        where: { projectId: id },
        orderBy: { sortOrder: "asc" },
      }),
      db.githubRepo.findMany({
        where: { projectId: id },
        select: { id: true, owner: true, name: true, url: true },
      }),
      db.ticket.findMany({
        where: { projectId: id },
        select: { id: true },
      }),
    ]);

  return {
    ...project,
    team,
    portfolio,
    client,
    milestones,
    githubRepos,
    _count: {
      tickets: tickets.length,
    },
  };
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const session = await getUserFromRequest(_request);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await getUserWithTeamAccess(session.id);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let project: any;
    try {
      project = await db.project.findUnique({
        where: { id },
        include: projectInclude,
      });
    } catch (error) {
      if (!isProjectRelationError(error)) throw error;
      project = await hydrateProjectById(id);
    }

    if (!project) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (user.role === Role.CLIENT) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (user.role === Role.USER && !canAccessTeam(user, project.teamId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json(project);
  } catch (error) {
    console.error("Project GET error:", error);
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
    const session = await getUserFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await getUserWithTeamAccess(session.id);
    if (!user || user.role === Role.CLIENT) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const existing = await db.project.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (!canAccessTeam(user, existing.teamId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const data: {
      name?: string;
      description?: string;
      progress?: number;
      health?: ProjectHealth;
      status?: ProjectStatus;
      portfolioId?: string | null;
      clientId?: string | null;
    } = {};

    if (typeof body.name === "string") data.name = body.name.trim();
    if (typeof body.description === "string")
      data.description = body.description;
    if (typeof body.progress === "number") {
      data.progress = Math.min(100, Math.max(0, body.progress));
    }
    if (
      typeof body.health === "string" &&
      (Object.values(ProjectHealth) as string[]).includes(body.health)
    ) {
      data.health = body.health as ProjectHealth;
    }
    if (
      typeof body.status === "string" &&
      (Object.values(ProjectStatus) as string[]).includes(body.status)
    ) {
      data.status = body.status as ProjectStatus;
    }
    if (body.portfolioId === null) data.portfolioId = null;
    if (typeof body.portfolioId === "string")
      data.portfolioId = body.portfolioId;
    if (body.clientId === null) data.clientId = null;
    if (typeof body.clientId === "string") data.clientId = body.clientId;

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "No valid fields" }, { status: 400 });
    }

    let project: any;
    try {
      project = await db.project.update({
        where: { id },
        data,
        include: projectInclude,
      });
    } catch (error) {
      if (!isProjectRelationError(error)) throw error;
      await db.project.update({
        where: { id },
        data,
      });
      project = await hydrateProjectById(id);
    }

    await writeAuditLog({
      actorId: user.id,
      action: "PROJECT_UPDATE",
      entityType: "Project",
      entityId: id,
      metadata: data,
    });

    return NextResponse.json(project);
  } catch (error) {
    console.error("Project PATCH error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
