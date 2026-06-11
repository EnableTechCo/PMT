import { NextRequest, NextResponse } from "next/server";
import { ProjectHealth, ProjectStatus, Role } from "@/lib/db-types";
import { db } from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";
import { canAccessTeam, getUserWithTeamAccess } from "@/lib/access";
import { writeAuditLog } from "@/lib/audit";

function parseGithubRepoFromUrl(repoUrl: string) {
  try {
    const parsed = new URL(repoUrl);
    if (!/(^|\.)github\.com$/i.test(parsed.hostname)) {
      return null;
    }

    const parts = parsed.pathname
      .replace(/^\/+|\/+$/g, "")
      .replace(/\.git$/i, "")
      .split("/");

    if (parts.length < 2 || !parts[0] || !parts[1]) {
      return null;
    }

    return {
      owner: parts[0],
      name: parts[1],
      url: `https://github.com/${parts[0]}/${parts[1]}`,
    };
  } catch {
    return null;
  }
}

function normalizeGithubRepoInput(repo: unknown) {
  if (!repo || typeof repo !== "object") {
    return null;
  }

  const candidate = repo as {
    owner?: unknown;
    name?: unknown;
    url?: unknown;
  };

  const owner =
    typeof candidate.owner === "string" ? candidate.owner.trim() : "";
  const name = typeof candidate.name === "string" ? candidate.name.trim() : "";
  const url = typeof candidate.url === "string" ? candidate.url.trim() : "";

  if (!owner || !name || !url) {
    return null;
  }

  return { owner, name, url };
}

export async function GET(request: NextRequest) {
  let requestContext: {
    userId?: string;
    role?: Role;
    teamId?: string | null;
    portfolioId?: string | null;
    url?: string;
  } = {};
  try {
    const session = await getUserFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await getUserWithTeamAccess(session.id);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const teamId = searchParams.get("teamId");
    const portfolioId = searchParams.get("portfolioId");
    requestContext = {
      userId: user.id,
      role: user.role,
      teamId,
      portfolioId,
      url: request.url,
    };

    if (user.role === Role.CLIENT) {
      return NextResponse.json([]);
    }

    const where: Record<string, unknown> = {};

    if (portfolioId) {
      where.portfolioId = portfolioId;
    }

    if (user.role === Role.SUPER_ADMIN) {
      if (teamId) where.teamId = teamId;
    } else if (user.role === Role.USER) {
      if (!teamId) {
        return NextResponse.json(
          { error: "teamId is required" },
          { status: 400 },
        );
      }
      if (!canAccessTeam(user, teamId)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      where.teamId = teamId;
    }

    const baseProjects = await db.project.findMany({
      where,
      orderBy: { updatedAt: "desc" },
    });

    const projectIds = Array.from(
      new Set(baseProjects.map((p: any) => p.id).filter(Boolean)),
    );
    const teamIds = Array.from(
      new Set(baseProjects.map((p: any) => p.teamId).filter(Boolean)),
    );
    const portfolioIds = Array.from(
      new Set(baseProjects.map((p: any) => p.portfolioId).filter(Boolean)),
    );
    const clientIds = Array.from(
      new Set(baseProjects.map((p: any) => p.clientId).filter(Boolean)),
    );
    const teams = teamIds.length
      ? await db.team.findMany({
          where: { id: { in: teamIds } },
          select: { id: true, name: true },
        })
      : [];
    const [portfolios, clients, githubRepos, milestones, tickets] =
      await Promise.all([
        portfolioIds.length
          ? db.portfolio.findMany({
              where: { id: { in: portfolioIds } },
              select: { id: true, name: true },
            })
          : Promise.resolve([]),
        clientIds.length
          ? db.client.findMany({
              where: { id: { in: clientIds } },
              select: { id: true, name: true, email: true },
            })
          : Promise.resolve([]),
        projectIds.length
          ? db.githubRepo.findMany({
              where: { projectId: { in: projectIds } },
              select: {
                id: true,
                projectId: true,
                owner: true,
                name: true,
                url: true,
              },
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
    const portfolioById = new Map(portfolios.map((p: any) => [p.id, p]));
    const clientById = new Map(clients.map((c: any) => [c.id, c]));

    const reposByProject = new Map<string, any[]>();
    for (const repo of githubRepos as any[]) {
      const projectId = repo.projectId as string | undefined;
      if (!projectId) continue;
      const list = reposByProject.get(projectId) ?? [];
      list.push({
        id: repo.id,
        owner: repo.owner,
        name: repo.name,
        url: repo.url,
      });
      reposByProject.set(projectId, list);
    }

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

    const projects = baseProjects.map((project: any) => ({
      ...project,
      team: project.teamId ? (teamById.get(project.teamId) ?? null) : null,
      portfolio: project.portfolioId
        ? (portfolioById.get(project.portfolioId) ?? null)
        : null,
      client: project.clientId
        ? (clientById.get(project.clientId) ?? null)
        : null,
      githubRepos: reposByProject.get(project.id) ?? [],
      _count: {
        milestones: milestoneCountByProject.get(project.id) ?? 0,
        tickets: ticketCountByProject.get(project.id) ?? 0,
      },
    }));

    return NextResponse.json(projects);
  } catch (error) {
    console.error("Projects GET error:", {
      error,
      context: requestContext,
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getUserFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await getUserWithTeamAccess(session.id);
    if (!user || user.role === Role.CLIENT) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const teamIdIn = typeof body.teamId === "string" ? body.teamId : "";
    const description =
      typeof body.description === "string"
        ? body.description.trim()
        : undefined;
    const teamDescription =
      typeof body.teamDescription === "string"
        ? body.teamDescription.trim()
        : undefined;
    const portfolioId =
      typeof body.portfolioId === "string" ? body.portfolioId : undefined;
    const clientId =
      typeof body.clientId === "string"
        ? body.clientId.trim() || null
        : body.clientId === null
          ? null
          : undefined;
    const githubRepoUrlRaw =
      typeof body.githubRepoUrl === "string" ? body.githubRepoUrl.trim() : "";
    const githubReposInput: unknown[] = Array.isArray(body.githubRepos)
      ? (body.githubRepos as unknown[])
      : [];

    let parsedGithubRepo: {
      owner: string;
      name: string;
      url: string;
    } | null = null;

    const parsedGithubRepos = githubReposInput
      .map((repo) => normalizeGithubRepoInput(repo))
      .filter(
        (repo): repo is { owner: string; name: string; url: string } =>
          repo !== null,
      );

    if (githubRepoUrlRaw) {
      parsedGithubRepo = parseGithubRepoFromUrl(githubRepoUrlRaw);
      if (!parsedGithubRepo) {
        return NextResponse.json(
          {
            error:
              "Invalid GitHub repository URL. Use format: https://github.com/owner/repo",
          },
          { status: 400 },
        );
      }
    }

    const reposToLink = [
      ...parsedGithubRepos,
      ...(parsedGithubRepo ? [parsedGithubRepo] : []),
    ].filter(
      (repo, index, arr) =>
        arr.findIndex(
          (item) =>
            item.owner.toLowerCase() === repo.owner.toLowerCase() &&
            item.name.toLowerCase() === repo.name.toLowerCase(),
        ) === index,
    );

    if (!name || !teamIdIn) {
      return NextResponse.json(
        { error: "name and teamId are required" },
        { status: 400 },
      );
    }

    if (!canAccessTeam(user, teamIdIn)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const health =
      typeof body.health === "string" &&
      (Object.values(ProjectHealth) as string[]).includes(body.health)
        ? (body.health as ProjectHealth)
        : undefined;
    const status =
      typeof body.status === "string" &&
      (Object.values(ProjectStatus) as string[]).includes(body.status)
        ? (body.status as ProjectStatus)
        : undefined;

    const project = await db.project.create({
      data: {
        name,
        description,
        teamDescription,
        teamId: teamIdIn,
        portfolioId,
        clientId,
        progress: typeof body.progress === "number" ? body.progress : 0,
        health,
        status,
      },
    });

    for (const repo of reposToLink) {
      await db.githubRepo.create({
        data: {
          projectId: project.id,
          owner: repo.owner,
          name: repo.name,
          url: repo.url,
        },
      });
    }

    const [team, portfolio, client, githubRepos, milestones, tickets] =
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
        db.githubRepo.findMany({
          where: { projectId: project.id },
          select: { id: true, owner: true, name: true, url: true },
        }),
        db.milestone.findMany({
          where: { projectId: project.id },
          select: { id: true },
        }),
        db.ticket.findMany({
          where: { projectId: project.id },
          select: { id: true },
        }),
      ]);

    const projectWithRepos = {
      ...project,
      team,
      portfolio,
      client,
      githubRepos,
      _count: {
        milestones: milestones.length,
        tickets: tickets.length,
      },
    };

    await writeAuditLog({
      actorId: user.id,
      action: "PROJECT_CREATE",
      entityType: "Project",
      entityId: project.id,
      metadata: { name, teamId: teamIdIn },
    });

    return NextResponse.json(projectWithRepos ?? project, { status: 201 });
  } catch (error) {
    console.error("Projects POST error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
