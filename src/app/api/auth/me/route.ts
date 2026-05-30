import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { getUserWithTeamAccess, teamIdsForUser } from "@/lib/access";

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const full = await getUserWithTeamAccess(user.id);
    const teamIds = full ? teamIdsForUser(full) : [];

    return NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        teamId: user.teamId,
        teamIds,
      },
    });
  } catch (error) {
    console.error("Get user error:", error);
    if (error instanceof Error && error.name === "DatabaseSchemaError") {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
