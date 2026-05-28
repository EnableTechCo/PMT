import { NextRequest, NextResponse } from "next/server";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { db } from "@/lib/db";
import {
  getAuthorizedUser,
  assertTicketReadable,
  loadTicketRow,
} from "@/lib/ticketAccess";
import { logTicketActivity } from "@/lib/ticketActivity";

const MAX_BYTES = 20 * 1024 * 1024;

function safeFilename(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120) || "file";
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: ticketId } = await params;
  try {
    const user = await getAuthorizedUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const ticket = await loadTicketRow(ticketId);
    if (!ticket) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }

    const access = await assertTicketReadable(user, ticket);
    if (!access.ok) {
      return NextResponse.json(
        { error: access.status === 403 ? "Forbidden" : "Not found" },
        { status: access.status },
      );
    }

    const form = await request.formData();
    const file = form.get("file");
    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "file is required" }, { status: 400 });
    }

    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "File too large" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const relDir = path.join("public", "uploads", "tickets", ticketId);
    const absDir = path.join(process.cwd(), relDir);
    await mkdir(absDir, { recursive: true });
    const stored = `${randomUUID()}_${safeFilename(file.name)}`;
    const absPath = path.join(absDir, stored);
    await writeFile(absPath, buffer);

    const url = `/uploads/tickets/${ticketId}/${stored}`;
    const row = await db.ticketAttachment.create({
      data: {
        ticketId,
        uploadedById: user.id,
        filename: file.name,
        mimeType: file.type || null,
        size: file.size,
        url,
      },
      include: { uploadedBy: { select: { id: true, name: true } } },
    });

    await logTicketActivity({
      ticketId,
      actorId: user.id,
      type: "ATTACHMENT",
      summary: `Attached ${file.name}`,
      metadata: { attachmentId: row.id },
    });

    return NextResponse.json(row);
  } catch (e) {
    console.error("Attachment POST:", e);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
