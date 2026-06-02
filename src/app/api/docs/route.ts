import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";
import { canAccessTeam, teamIdsForUser } from "@/lib/access";

function isDocRelationError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const maybe = error as { code?: unknown };
  const code = typeof maybe.code === "string" ? maybe.code : "";
  return code.startsWith("PGRST2");
}

async function hydrateDocuments(baseDocs: any[]) {
  const authorIds = new Set<string>();
  const teamIds = new Set<string>();
  const projectIds = new Set<string>();

  for (const doc of baseDocs) {
    if (doc.authorId) authorIds.add(doc.authorId);
    if (doc.teamId) teamIds.add(doc.teamId);
    if (doc.projectId) projectIds.add(doc.projectId);
  }

  const [authors, teams, projects] = await Promise.all([
    authorIds.size
      ? db.user.findMany({
          where: { id: { in: Array.from(authorIds) } },
          select: { id: true, name: true },
        })
      : Promise.resolve([]),
    teamIds.size
      ? db.team.findMany({
          where: { id: { in: Array.from(teamIds) } },
          select: { id: true, name: true },
        })
      : Promise.resolve([]),
    projectIds.size
      ? db.project.findMany({
          where: { id: { in: Array.from(projectIds) } },
          select: { id: true, name: true },
        })
      : Promise.resolve([]),
  ]);

  const authorById = new Map(authors.map((a: any) => [a.id, a]));
  const teamById = new Map(teams.map((t: any) => [t.id, t]));
  const projectById = new Map(projects.map((p: any) => [p.id, p]));

  return baseDocs.map((doc: any) => ({
    ...doc,
    author: doc.authorId ? (authorById.get(doc.authorId) ?? null) : null,
    team: doc.teamId ? (teamById.get(doc.teamId) ?? null) : null,
    project: doc.projectId ? (projectById.get(doc.projectId) ?? null) : null,
  }));
}

export async function GET(request: NextRequest) {
  try {
    const sessionUser = await getUserFromRequest(request);
    if (!sessionUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const teamId = searchParams.get("teamId");

    const where: any = {};

    if (sessionUser.role === "USER") {
      const allowedTeams = teamIdsForUser(sessionUser) ?? [];
      if (teamId && allowedTeams.includes(teamId)) {
        where.teamId = teamId;
      } else {
        where.teamId = { in: allowedTeams };
      }
    } else if (sessionUser.role === "SUPER_ADMIN") {
      if (teamId) where.teamId = teamId;
    } else {
      return NextResponse.json(
        { error: "Clients cannot access docs" },
        { status: 403 },
      );
    }

    let docs: any[];
    try {
      docs = await db.document.findMany({
        where,
        orderBy: { updatedAt: "desc" },
        include: {
          author: { select: { id: true, name: true } },
          team: { select: { id: true, name: true } },
          project: { select: { id: true, name: true } },
        },
      });
    } catch (error) {
      if (!isDocRelationError(error)) throw error;
      const baseDocs = await db.document.findMany({
        where,
        orderBy: { updatedAt: "desc" },
      });
      docs = await hydrateDocuments(baseDocs);
    }

    return NextResponse.json(docs);
  } catch (error) {
    console.error("Get docs error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const sessionUser = await getUserFromRequest(request);
    if (!sessionUser || sessionUser.role === "CLIENT") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { title, content, teamId, projectId } = await request.json();
    if (!title || !content || !teamId) {
      return NextResponse.json(
        { error: "Title, content, and teamId are required" },
        { status: 400 },
      );
    }

    if (
      sessionUser.role !== "SUPER_ADMIN" &&
      !canAccessTeam(sessionUser, teamId)
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const doc = await db.document.create({
      data: {
        title,
        content,
        teamId,
        projectId: projectId || null,
        authorId: sessionUser.id,
      },
    });

    return NextResponse.json(doc);
  } catch (error) {
    console.error("Create doc error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
