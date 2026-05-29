import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { getSmtpDiagnostics } from "@/lib/email";

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log("Running SMTP diagnostics", {
      userId: user.id,
      email: user.email,
    });

    const diagnostics = await getSmtpDiagnostics();

    return NextResponse.json({
      ok: true,
      diagnostics,
    });
  } catch (error) {
    console.error("SMTP diagnostics error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to run SMTP diagnostics",
      },
      { status: 500 },
    );
  }
}
