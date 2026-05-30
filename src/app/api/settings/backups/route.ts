import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { Role } from "@/lib/db-types";
import { listBackupRecords } from "@/lib/backup";

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (user.role !== Role.SUPER_ADMIN) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const take = Math.min(
      50,
      Math.max(1, Number(searchParams.get("take") ?? "20")),
    );

    const backups = await listBackupRecords(take);

    return NextResponse.json({ backups });
  } catch (error) {
    console.error("Backup history error:", error);
    return NextResponse.json(
      { error: "Failed to load backup history" },
      { status: 500 },
    );
  }
}
