import { NextRequest, NextResponse } from "next/server";
import { Role } from "@/lib/db-types";
import { db } from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const session = await getUserFromRequest(request);
    if (!session || session.role === Role.CLIENT) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rows = await db.savedView.findMany({
      where: { userId: session.id },
      orderBy: { updatedAt: "desc" },
    });
    return NextResponse.json(rows);
  } catch (error) {
    console.error("Saved views GET error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getUserFromRequest(request);
    if (!session || session.role === Role.CLIENT) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const filters = body.filters;
    if (!name || typeof filters !== "object") {
      return NextResponse.json({ error: "name and filters required" }, { status: 400 });
    }

    const teamId =
      typeof body.teamId === "string" ? body.teamId : null;

    const row = await db.savedView.create({
      data: {
        userId: session.id,
        name,
        teamId: teamId || null,
        filters: JSON.stringify(filters),
      },
    });

    return NextResponse.json(row, { status: 201 });
  } catch (error) {
    console.error("Saved views POST error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
