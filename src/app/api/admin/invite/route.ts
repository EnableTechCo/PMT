import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  hashPassword,
  getUserFromRequest,
  isInternalStaffEmail,
} from "@/lib/auth";
import { sendAdminInviteEmail } from "@/lib/email";
import { Role } from "@/lib/db-types";
import { randomBytes } from "node:crypto";
import { createUser, findUserByEmail } from "@/lib/user-store";

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);

    if (!user || user.role !== Role.SUPER_ADMIN) {
      return NextResponse.json(
        { error: "Only super admins can invite new admins" },
        { status: 403 },
      );
    }

    const { email, name, teamId } = await request.json();

    if (!email || !name) {
      return NextResponse.json(
        { error: "Email and name are required" },
        { status: 400 },
      );
    }

    if (!isInternalStaffEmail(email)) {
      return NextResponse.json(
        {
          error: "Admin invites must use @e-t.co.za email addresses",
        },
        { status: 400 },
      );
    }

    const existingUser = await findUserByEmail(email);
    if (existingUser) {
      return NextResponse.json(
        { error: "User with this email already exists" },
        { status: 400 },
      );
    }

    // Validate teamId if provided
    if (!teamId) {
      return NextResponse.json(
        { error: "teamId is required" },
        { status: 400 },
      );
    }

    const team = await db.team.findUnique({ where: { id: teamId } });
    if (!team) {
      return NextResponse.json(
        { error: "Invalid team selected" },
        { status: 400 },
      );
    }

    const temporaryPasswordHash = await hashPassword(
      randomBytes(24).toString("hex"),
    );

    const newAdmin = await createUser({
      email,
      name,
      password: temporaryPasswordHash,
      role: Role.USER,
      teamId: teamId,
    });

    const token = generateInviteToken();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await db.passwordReset.create({
      data: {
        token,
        userId: newAdmin.id,
        expiresAt,
      },
    });

    // Use the invite HTML template for the admin invite and point the CTA to the reset-password route
    await sendAdminInviteEmail(
      email,
      token,
      name,
      team.name,
      "/auth/reset-password?token=",
    );

    return NextResponse.json({
      message: "Invite sent successfully",
      user: {
        id: newAdmin.id,
        email: newAdmin.email,
        name: newAdmin.name,
      },
    });
  } catch (error) {
    console.error("Error inviting admin:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

function generateInviteToken(): string {
  return randomBytes(32).toString("hex");
}
