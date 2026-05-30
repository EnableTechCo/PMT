import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { Role } from "@/lib/db-types";
import {
  createAndStoreBackupSnapshot,
  loadBackupRecordById,
  restoreBackupSnapshot,
} from "@/lib/backup";
import { db } from "@/lib/db";

function toFilename(timestamp: string) {
  return timestamp.replace(/[:.]/g, "-");
}

export async function GET(
  request: NextRequest,
  context: { params: { id: string } },
) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (user.role !== Role.SUPER_ADMIN) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = context.params;
    const record = await loadBackupRecordById(id);

    if (!record) {
      return NextResponse.json({ error: "Backup not found" }, { status: 404 });
    }

    if (request.nextUrl.searchParams.get("download") === "1") {
      return new NextResponse(JSON.stringify(record.snapshot, null, 2), {
        status: 200,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Content-Disposition": `attachment; filename="pmt-backup-${toFilename(record.generatedAt)}.json"`,
          "Cache-Control": "no-store",
        },
      });
    }

    return NextResponse.json(record);
  } catch (error) {
    console.error("Backup detail error:", error);
    return NextResponse.json(
      { error: "Failed to load backup" },
      { status: 500 },
    );
  }
}

export async function POST(
  request: NextRequest,
  context: { params: { id: string } },
) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (user.role !== Role.SUPER_ADMIN) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = context.params;
    const record = await loadBackupRecordById(id);

    if (!record) {
      return NextResponse.json({ error: "Backup not found" }, { status: 404 });
    }

    const safety = await createAndStoreBackupSnapshot({
      triggerType: "restore_safety",
      label: `Restore safety snapshot before ${record.label}`,
      generatedBy: {
        userId: user.id,
        email: user.email,
        name: user.name,
      },
    });

    await restoreBackupSnapshot(record.snapshot);

    await db.backupSnapshot.update({
      where: { id: record.id },
      data: {
        restoredAt: new Date().toISOString(),
        restoredById: user.id,
      },
    });

    return NextResponse.json({
      ok: true,
      restoredBackupId: record.id,
      safetyBackupId: safety.record.id,
    });
  } catch (error) {
    console.error("Backup restore error:", error);
    return NextResponse.json(
      { error: "Failed to restore backup" },
      { status: 500 },
    );
  }
}
