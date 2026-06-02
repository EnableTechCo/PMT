import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";
import { canAccessTeam, teamIdsForUser } from "@/lib/access";

const documentInclude = {
  author: { select: { id: true, name: true } },
  team: { select: { id: true, name: true } },
  project: { select: { id: true, name: true } },
} as const;

function isDocRelationError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const maybe = error as { code?: unknown };
  const code = typeof maybe.code === "string" ? maybe.code : "";
  return code.startsWith("PGRST2");
}

function parseMissingDocumentColumn(error: unknown): string | null {
  if (!error || typeof error !== "object") return null;
  const maybe = error as { code?: unknown; message?: unknown };
  const message = typeof maybe.message === "string" ? maybe.message : "";

  if (maybe.code === "PGRST204") {
    const match = message.match(/Could not find the '([^']+)' column/);
    return match?.[1] ?? null;
  }

  if (maybe.code === "42703") {
    // Example: column Document.teamId does not exist
    const match = message.match(
      /column\s+(?:"?Document"?\.)?"?([A-Za-z0-9_]+)"?\s+does not exist/i,
    );
    return match?.[1] ?? null;
  }

  return null;
}

async function findDocumentsWithWhereFallback(
  initialWhere: Record<string, unknown>,
  options: {
    includeRelated: boolean;
    strictTeamScope: boolean;
    fallbackAuthorId?: string;
  },
) {
  const where: Record<string, unknown> = { ...initialWhere };

  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      if (options.includeRelated) {
        return await db.document.findMany({
          where,
          orderBy: { updatedAt: "desc" },
          include: documentInclude,
        });
      }

      return await db.document.findMany({
        where,
        orderBy: { updatedAt: "desc" },
      });
    } catch (error) {
      const missingColumn = parseMissingDocumentColumn(error);
      if (missingColumn && missingColumn in where) {
        if (missingColumn === "teamId" && options.strictTeamScope) {
          // If teamId is unavailable, degrade to "own docs only" scope.
          delete where.teamId;
          if (options.fallbackAuthorId) {
            where.authorId = options.fallbackAuthorId;
            continue;
          }
          return [];
        }
        delete where[missingColumn];
        continue;
      }
      throw error;
    }
  }

  return [];
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
    const strictTeamScope = sessionUser.role === "USER";
    try {
      docs = await findDocumentsWithWhereFallback(where, {
        includeRelated: true,
        strictTeamScope,
        fallbackAuthorId: strictTeamScope ? sessionUser.id : undefined,
      });
    } catch (error) {
      const missingColumn = parseMissingDocumentColumn(error);
      if (!isDocRelationError(error) && !missingColumn) throw error;
      const baseDocs = await findDocumentsWithWhereFallback(where, {
        includeRelated: false,
        strictTeamScope,
        fallbackAuthorId: strictTeamScope ? sessionUser.id : undefined,
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

    const createData: Record<string, unknown> = {
      title,
      content,
      teamId,
      projectId: projectId || null,
      authorId: sessionUser.id,
    };

    let doc: any = null;
    for (let attempt = 0; attempt < 4; attempt += 1) {
      try {
        doc = await db.document.create({
          data: createData,
        });
        break;
      } catch (error) {
        const missingColumn = parseMissingDocumentColumn(error);
        if (!missingColumn || !(missingColumn in createData)) {
          throw error;
        }
        delete createData[missingColumn];
      }
    }

    if (!doc) {
      throw new Error("Failed to create doc");
    }

    return NextResponse.json(doc);
  } catch (error) {
    console.error("Create doc error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
