import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { getEmailDiagnostics } from "@/lib/email-service";

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log("Running email diagnostics", {
      userId: user.id,
      email: user.email,
    });

    const diagnostics = await getEmailDiagnostics();

    return NextResponse.json({
      ok: true,
      diagnostics,
    });
  } catch (error) {
    console.error("Email diagnostics error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to run email diagnostics",
      },
      { status: 500 },
    );
  }
}
