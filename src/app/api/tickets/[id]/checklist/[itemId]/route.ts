import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  getAuthorizedUser,
  assertTicketReadable,
  loadTicketRow,
} from "@/lib/ticketAccess";
import { logTicketActivity } from "@/lib/ticketActivity";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> },
) {
  const { id: ticketId, itemId } = await params;
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

    const item = await db.ticketChecklistItem.findFirst({
      where: { id: itemId, ticketId },
    });
    if (!item) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    const body = (await request.json()) as {
      title?: string;
      done?: boolean;
      sortOrder?: number;
    };

    const data: { title?: string; done?: boolean; sortOrder?: number } = {};
    if (typeof body.title === "string" && body.title.trim()) {
      data.title = body.title.trim();
    }
    if (typeof body.done === "boolean") {
      data.done = body.done;
    }
    if (typeof body.sortOrder === "number" && Number.isFinite(body.sortOrder)) {
      data.sortOrder = body.sortOrder;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "No valid fields" }, { status: 400 });
    }

    const updated = await db.ticketChecklistItem.update({
      where: { id: itemId },
      data,
    });

    await logTicketActivity({
      ticketId,
      actorId: user.id,
      type: "CHECKLIST",
      summary: "Checklist updated",
      metadata: { itemId, ...data },
    });

    return NextResponse.json(updated);
  } catch (e) {
    console.error("Checklist PATCH:", e);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> },
) {
  const { id: ticketId, itemId } = await params;
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

    const item = await db.ticketChecklistItem.findFirst({
      where: { id: itemId, ticketId },
    });
    if (!item) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    await db.ticketChecklistItem.delete({ where: { id: itemId } });

    await logTicketActivity({
      ticketId,
      actorId: user.id,
      type: "CHECKLIST",
      summary: `Checklist item removed: ${item.title}`,
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("Checklist DELETE:", e);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
