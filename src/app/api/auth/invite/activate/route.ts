import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { token } = await request.json();

    if (typeof token !== "string" || !token.trim()) {
      return NextResponse.json({ error: "Token is required" }, { status: 400 });
    }

    const normalizedToken = token.trim();
    const now = new Date();

    const inviteToken = await db.inviteToken.findUnique({
      where: { token: normalizedToken },
      select: { id: true, used: true, expiresAt: true },
    });

    if (inviteToken) {
      if (!inviteToken.used && now <= inviteToken.expiresAt) {
        await db.inviteToken.update({
          where: { id: inviteToken.id },
          data: { used: true },
        });
      }

      return NextResponse.json({ success: true });
    }

    const passwordResetToken = await db.passwordReset.findUnique({
      where: { token: normalizedToken },
      select: { id: true, used: true, expiresAt: true },
    });

    if (passwordResetToken) {
      if (!passwordResetToken.used && now <= passwordResetToken.expiresAt) {
        await db.passwordReset.update({
          where: { id: passwordResetToken.id },
          data: { used: true },
        });
      }

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Invalid token" }, { status: 404 });
  } catch (error) {
    console.error("Invite activate error:", error);
    return NextResponse.json(
      { error: "Failed to activate invitation" },
      { status: 500 },
    );
  }
}
