import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { Role } from "@/lib/db-types";
import { db } from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";
import { findUserByEmail } from "@/lib/user-store";
import { sendPasswordResetEmail } from "@/lib/email-service";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (user.role !== Role.SUPER_ADMIN) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const client = await db.client.findUnique({ where: { id } });
    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    const clientUser = await findUserByEmail(client.email);
    if (!clientUser) {
      return NextResponse.json(
        {
          error:
            "Client does not have an account yet. Resend invitation first.",
        },
        { status: 400 },
      );
    }

    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    await db.passwordReset.create({
      data: {
        token,
        userId: clientUser.id,
        expiresAt,
      },
    });

    await sendPasswordResetEmail(client.email, token, client.name);

    return NextResponse.json({
      success: true,
      message: "Password reset email sent successfully.",
    });
  } catch (error) {
    console.error("Client reset-password error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
