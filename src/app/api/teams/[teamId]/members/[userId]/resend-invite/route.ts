import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { Role } from "@/lib/db-types";
import { db } from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { sendAdminInviteEmail } from "@/lib/email-service";
import { findUserById } from "@/lib/user-store";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ teamId: string; userId: string }> },
) {
  try {
    const sessionUser = await getUserFromRequest(request);
    if (!sessionUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (sessionUser.role !== Role.SUPER_ADMIN) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { teamId, userId } = await context.params;

    const team = await db.team.findUnique({
      where: { id: teamId },
      select: { id: true, name: true },
    });
    if (!team) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }

    const membership = await db.teamMembership.findFirst({
      where: { teamId, userId },
      select: { id: true },
    });

    if (!membership) {
      return NextResponse.json(
        { error: "Membership not found" },
        { status: 404 },
      );
    }

    const member = await findUserById(userId);
    if (!member) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (member.role === Role.CLIENT) {
      return NextResponse.json(
        {
          error: "Client accounts cannot be invited as internal team members.",
        },
        { status: 400 },
      );
    }

    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await db.passwordReset.create({
      data: {
        token,
        userId: member.id,
        expiresAt,
      },
    });

    try {
      const loginLink = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/auth/login?email=${encodeURIComponent(member.email)}`;
      await sendAdminInviteEmail(
        member.email,
        token,
        member.name,
        team.name,
        loginLink,
      );
    } catch (error) {
      console.error("Team member resend invite email error:", error);
      return NextResponse.json(
        {
          error:
            "Failed to send invitation email. Check the email provider configuration and sender domain setup.",
        },
        { status: 502 },
      );
    }

    await writeAuditLog({
      actorId: sessionUser.id,
      action: "TEAM_MEMBER_INVITE_RESEND",
      entityType: "TeamMembership",
      entityId: membership.id,
      metadata: {
        teamId,
        teamName: team.name,
        userId: member.id,
        email: member.email,
      },
    });

    return NextResponse.json({
      ok: true,
      message: `Invitation email sent to ${member.email}`,
    });
  } catch (error) {
    console.error("Resend team member invite error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
