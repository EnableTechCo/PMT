import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";
import { canAccessTeam, teamIdsForUser } from "@/lib/access";

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
      return NextResponse.json({ error: "Clients cannot access docs" }, { status: 403 });
    }

    const docs = await db.document.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      include: {
        author: { select: { id: true, name: true } },
        team: { select: { id: true, name: true } },
        project: { select: { id: true, name: true } },
      }
    });

    return NextResponse.json(docs);
  } catch (error) {
    console.error("Get docs error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
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
      return NextResponse.json({ error: "Title, content, and teamId are required" }, { status: 400 });
    }

    if (sessionUser.role !== "SUPER_ADMIN" && !canAccessTeam(sessionUser, teamId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const doc = await db.document.create({
      data: {
        title,
        content,
        teamId,
        projectId: projectId || null,
        authorId: sessionUser.id,
      }
    });

    return NextResponse.json(doc);
  } catch (error) {
    console.error("Create doc error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
