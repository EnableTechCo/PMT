import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";
import { canAccessTeam } from "@/lib/access";

function isDocRelationError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const maybe = error as { code?: unknown };
  const code = typeof maybe.code === "string" ? maybe.code : "";
  return code.startsWith("PGRST2");
}

async function hydrateDocument(baseDoc: any) {
  if (!baseDoc) return null;

  const [author, team, project] = await Promise.all([
    baseDoc.authorId
      ? db.user.findUnique({
          where: { id: baseDoc.authorId },
          select: { id: true, name: true },
        })
      : Promise.resolve(null),
    baseDoc.teamId
      ? db.team.findUnique({
          where: { id: baseDoc.teamId },
          select: { id: true, name: true },
        })
      : Promise.resolve(null),
    baseDoc.projectId
      ? db.project.findUnique({
          where: { id: baseDoc.projectId },
          select: { id: true, name: true },
        })
      : Promise.resolve(null),
  ]);

  return {
    ...baseDoc,
    author,
    team,
    project,
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const sessionUser = await getUserFromRequest(request);
    if (!sessionUser || sessionUser.role === "CLIENT") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let doc: any = null;
    try {
      doc = await db.document.findUnique({
        where: { id },
        include: {
          author: { select: { id: true, name: true } },
          team: { select: { id: true, name: true } },
          project: { select: { id: true, name: true } },
        },
      });
    } catch (error) {
      if (!isDocRelationError(error)) throw error;
      const baseDoc = await db.document.findUnique({ where: { id } });
      doc = await hydrateDocument(baseDoc);
    }

    if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (
      sessionUser.role !== "SUPER_ADMIN" &&
      !canAccessTeam(sessionUser, doc.teamId)
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json(doc);
  } catch (error) {
    console.error("Get doc error:", error);
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
  try {
    const { id } = await params;
    const sessionUser = await getUserFromRequest(request);
    if (!sessionUser || sessionUser.role === "CLIENT") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const doc = await db.document.findUnique({ where: { id } });
    if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (
      sessionUser.role !== "SUPER_ADMIN" &&
      !canAccessTeam(sessionUser, doc.teamId)
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { title, content, projectId } = await request.json();

    const updatedDoc = await db.document.update({
      where: { id },
      data: {
        title: title !== undefined ? title : undefined,
        content: content !== undefined ? content : undefined,
        projectId: projectId !== undefined ? projectId : undefined,
      },
    });

    return NextResponse.json(updatedDoc);
  } catch (error) {
    console.error("Update doc error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const sessionUser = await getUserFromRequest(request);
    if (!sessionUser || sessionUser.role === "CLIENT") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const doc = await db.document.findUnique({ where: { id } });
    if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (sessionUser.role !== "SUPER_ADMIN" && doc.authorId !== sessionUser.id) {
      return NextResponse.json(
        { error: "Only the author or super admin can delete this doc" },
        { status: 403 },
      );
    }

    await db.document.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete doc error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
