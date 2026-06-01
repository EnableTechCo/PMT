import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { Role } from "@/lib/db-types";
import {
  createAndStoreBackupSnapshot,
  isBackupSnapshot,
  persistBackupSnapshot,
  restoreBackupSnapshot,
} from "@/lib/backup";
import { db } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (user.role !== Role.SUPER_ADMIN) {
      return NextResponse.json(
        { error: "Only super admins can import backups" },
        { status: 403 },
      );
    }

    const body = (await request.json()) as {
      snapshot?: unknown;
      label?: string;
    };

    if (!isBackupSnapshot(body.snapshot)) {
      return NextResponse.json(
        { error: "Invalid backup format" },
        { status: 400 },
      );
    }

    const snapshot = body.snapshot;
    const manualLabel = typeof body.label === "string" ? body.label.trim() : "";

    const safety = await createAndStoreBackupSnapshot({
      triggerType: "restore_safety",
      label: `Import safety snapshot before ${snapshot.generatedAt}`,
      generatedBy: {
        userId: user.id,
        email: user.email,
        name: user.name,
      },
    });

    const importedRecord = await persistBackupSnapshot(snapshot, {
      triggerType: "manual_import",
      label:
        manualLabel ||
        `Imported backup ${snapshot.generatedAt}${snapshot.version ? ` v${snapshot.version}` : ""}`,
      generatedBy: {
        userId: user.id,
        email: user.email,
        name: user.name,
      },
    });

    await restoreBackupSnapshot(snapshot);

    await db.backupSnapshot.update({
      where: { id: importedRecord.id },
      data: {
        restoredAt: new Date().toISOString(),
        restoredById: user.id,
      },
    });

    return NextResponse.json({
      ok: true,
      importedBackupId: importedRecord.id,
      safetyBackupId: safety.record.id,
      tableCounts: snapshot.tableCounts,
    });
  } catch (error) {
    console.error("Backup import error:", error);
    return NextResponse.json(
      { error: "Failed to import backup" },
      { status: 500 },
    );
  }
}
