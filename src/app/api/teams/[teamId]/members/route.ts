import { NextRequest, NextResponse } from "next/server";
import { Role } from "@/lib/db-types";
import { db } from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";
import { getUserWithTeamAccess, canAccessTeam } from "@/lib/access";
import { writeAuditLog } from "@/lib/audit";
import { findUserByEmail, findUserById, updateUser } from "@/lib/user-store";

async function requireSuperAdmin(request: NextRequest) {
  const sessionUser = await getUserFromRequest(request);
  if (!sessionUser) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  if (sessionUser.role !== Role.SUPER_ADMIN) {
    return {
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }
  return { sessionUser };
}

/** GET — list members (super admin only) */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ teamId: string }> },
) {
  const { teamId } = await context.params;
  const sessionUser = await getUserFromRequest(request);
  if (!sessionUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await getUserWithTeamAccess(sessionUser.id);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (user.role !== Role.SUPER_ADMIN && !canAccessTeam(user, teamId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const team = await db.team.findUnique({
    where: { id: teamId },
    select: { id: true },
  });
  if (!team) {
    return NextResponse.json({ error: "Team not found" }, { status: 404 });
  }

  const memberships = await db.teamMembership.findMany({
    where: { teamId },
    include: {
      user: {
        select: { id: true, name: true, email: true, role: true },
      },
    },
    orderBy: { user: { name: "asc" } },
  });

  const members = memberships.map((m: any) => ({
    membershipId: m.id,
    userId: m.user.id,
    name: m.user.name,
    email: m.user.email,
    role: m.user.role,
  }));

  return NextResponse.json({ members });
}

/** POST — add member by email (super admin only; internal staff only) */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ teamId: string }> },
) {
  const auth = await requireSuperAdmin(request);
  if ("error" in auth) return auth.error;
  const { sessionUser } = auth;

  const { teamId } = await context.params;
  const team = await db.team.findUnique({
    where: { id: teamId },
    select: { id: true, name: true },
  });
  if (!team) {
    return NextResponse.json({ error: "Team not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const rawEmail =
    typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!rawEmail) {
    return NextResponse.json({ error: "email is required" }, { status: 400 });
  }

  const target = await findUserByEmail(rawEmail);
  if (!target) {
    return NextResponse.json(
      {
        error:
          "No user found with that email. Staff must already have an invited account.",
      },
      { status: 404 },
    );
  }
  if (target.role === Role.CLIENT) {
    return NextResponse.json(
      { error: "Client accounts cannot be added to internal teams." },
      { status: 400 },
    );
  }

  try {
    await db.teamMembership.create({
      data: { userId: target.id, teamId },
    });
  } catch {
    return NextResponse.json(
      { error: "That user is already on this team." },
      { status: 409 },
    );
  }

  if (target.teamId === null) {
    await updateUser(target.id, { teamId });
  }

  await writeAuditLog({
    actorId: sessionUser.id,
    action: "TEAM_MEMBER_ADD",
    entityType: "TeamMembership",
    entityId: teamId,
    metadata: { teamName: team.name, userId: target.id, email: target.email },
  });

  return NextResponse.json({
    ok: true,
    member: {
      userId: target.id,
      name: target.name,
      email: target.email,
      role: target.role,
    },
  });
}

/** DELETE — remove member ?userId= (super admin only) */
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ teamId: string }> },
) {
  const auth = await requireSuperAdmin(request);
  if ("error" in auth) return auth.error;
  const { sessionUser } = auth;

  const { teamId } = await context.params;
  const team = await db.team.findUnique({
    where: { id: teamId },
    select: { id: true, name: true },
  });
  if (!team) {
    return NextResponse.json({ error: "Team not found" }, { status: 404 });
  }

  const userId = request.nextUrl.searchParams.get("userId")?.trim();
  if (!userId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }

  const deleted = await db.teamMembership.deleteMany({
    where: { teamId, userId },
  });
  if (deleted.count === 0) {
    return NextResponse.json(
      { error: "Membership not found" },
      { status: 404 },
    );
  }

  const remaining = await db.teamMembership.findMany({
    where: { userId },
    select: { teamId: true },
  });
  const u = await findUserById(userId);
  const ids = new Set(remaining.map((m: { teamId: string }) => m.teamId));
  let nextTeamId: string | null = null;
  if (u?.teamId && ids.has(u.teamId)) {
    nextTeamId = u.teamId;
  } else {
    nextTeamId = remaining[0]?.teamId ?? null;
  }
  await updateUser(userId, { teamId: nextTeamId });

  await writeAuditLog({
    actorId: sessionUser.id,
    action: "TEAM_MEMBER_REMOVE",
    entityType: "TeamMembership",
    entityId: teamId,
    metadata: { teamName: team.name, userId },
  });

  return NextResponse.json({ ok: true });
}
