import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { sendTestEmail } from "@/lib/email";

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log("Sending SMTP test email", {
      userId: user.id,
      email: user.email,
      name: user.name,
    });

    await sendTestEmail(user.email, user.name || user.email);

    return NextResponse.json({
      ok: true,
      message: `Test email sent to ${user.email}`,
    });
  } catch (error) {
    console.error("Settings test email error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to send test email",
      },
      { status: 500 },
    );
  }
}
