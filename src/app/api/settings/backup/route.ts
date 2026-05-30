import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { Role } from "@/lib/db-types";
import { createBackupSnapshot } from "@/lib/backup";

function filenameFromTimestamp(timestamp: string) {
  return timestamp.replace(/[:.]/g, "-");
}

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (user.role !== Role.SUPER_ADMIN) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const snapshot = await createBackupSnapshot({
      generatedBy: {
        userId: user.id,
        email: user.email,
        name: user.name,
      },
    });

    const body = JSON.stringify(snapshot, null, 2);
    if (request.nextUrl.searchParams.get("download") !== "1") {
      return NextResponse.json(snapshot);
    }

    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="pmt-backup-${filenameFromTimestamp(snapshot.generatedAt)}.json"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Backup export error:", error);
    return NextResponse.json(
      { error: "Failed to generate backup" },
      { status: 500 },
    );
  }
}