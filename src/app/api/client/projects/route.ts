import { NextRequest, NextResponse } from "next/server";
import { Role } from "@/lib/db-types";
import { db } from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";
import { getClientRecordForUser, getUserWithTeamAccess } from "@/lib/access";

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

async function hydrateProjects(baseProjects: any[]) {
  const teamIds = Array.from(
    new Set(baseProjects.map((p: any) => p.teamId).filter(Boolean)),
  );
  const projectIds = Array.from(
    new Set(baseProjects.map((p: any) => p.id).filter(Boolean)),
  );

  const [teams, milestones, tickets] = await Promise.all([
    teamIds.length
      ? db.team.findMany({
          where: { id: { in: teamIds } },
          select: { id: true, name: true },
        })
      : Promise.resolve([]),
    projectIds.length
      ? db.milestone.findMany({
          where: { projectId: { in: projectIds } },
          select: { projectId: true },
        })
      : Promise.resolve([]),
    projectIds.length
      ? db.ticket.findMany({
          where: { projectId: { in: projectIds } },
          select: { projectId: true },
        })
      : Promise.resolve([]),
  ]);

  const teamById = new Map(teams.map((team: any) => [team.id, team]));

  const milestoneCountByProject = new Map<string, number>();
  for (const row of milestones as any[]) {
    const projectId = row.projectId as string | undefined;
    if (!projectId) continue;
    milestoneCountByProject.set(
      projectId,
      (milestoneCountByProject.get(projectId) ?? 0) + 1,
    );
  }

  const ticketCountByProject = new Map<string, number>();
  for (const row of tickets as any[]) {
    const projectId = row.projectId as string | undefined;
    if (!projectId) continue;
    ticketCountByProject.set(
      projectId,
      (ticketCountByProject.get(projectId) ?? 0) + 1,
    );
  }

  return baseProjects.map((project: any) => ({
    ...project,
    team: teamById.get(project.teamId) ?? null,
    _count: {
      milestones: milestoneCountByProject.get(project.id) ?? 0,
      tickets: ticketCountByProject.get(project.id) ?? 0,
    },
  }));
}

export async function GET(request: NextRequest) {
  try {
    const session = await getUserFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await getUserWithTeamAccess(session.id);
    if (!user || user.role !== Role.CLIENT) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const client = await getClientRecordForUser(user);
    if (!client) {
      return NextResponse.json([]);
    }

    let directProjects: any[];
    try {
      directProjects = await db.project.findMany({
        where: { clientId: client.id },
        include: {
          team: { select: { id: true, name: true } },
          _count: { select: { milestones: true, tickets: true } },
        },
        orderBy: { updatedAt: "desc" },
      });
    } catch (error) {
      if (!isProjectRelationError(error)) throw error;
      const baseProjects = await db.project.findMany({
        where: { clientId: client.id },
        orderBy: { updatedAt: "desc" },
      });
      directProjects = await hydrateProjects(baseProjects);
    }

    const ticketRows = await db.ticket.findMany({
      where: { clientId: client.id },
      select: { projectId: true },
    });

    const ticketProjectIds = new Set(
      ticketRows.map((ticket: any) => ticket.projectId).filter(Boolean),
    );

    const extraProjectIds = [...ticketProjectIds].filter(
      (projectId) =>
        !directProjects.some((project: any) => project.id === projectId),
    );

    if (extraProjectIds.length === 0) {
      return NextResponse.json(directProjects);
    }

    let extraProjects: any[];
    try {
      extraProjects = await db.project.findMany({
        where: { id: { in: extraProjectIds } },
        include: {
          team: { select: { id: true, name: true } },
          _count: { select: { milestones: true, tickets: true } },
        },
        orderBy: { updatedAt: "desc" },
      });
    } catch (error) {
      if (!isProjectRelationError(error)) throw error;
      const baseProjects = await db.project.findMany({
        where: { id: { in: extraProjectIds } },
        orderBy: { updatedAt: "desc" },
      });
      extraProjects = await hydrateProjects(baseProjects);
    }

    return NextResponse.json([...directProjects, ...extraProjects]);
  } catch (error) {
    console.error("Client projects error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
