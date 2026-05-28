import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  getAuthorizedUser,
  assertTicketReadable,
  loadTicketRow,
} from "@/lib/ticketAccess";
import { logTicketActivity } from "@/lib/ticketActivity";

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

    const body = (await request.json()) as { title?: string };
    const title = typeof body.title === "string" ? body.title.trim() : "";
    if (!title) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }

    const last = await db.ticketChecklistItem.findFirst({
      where: { ticketId },
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true },
    });
    const sortOrder = (last?.sortOrder ?? -1) + 1;

    const item = await db.ticketChecklistItem.create({
      data: { ticketId, title, sortOrder },
    });

    await logTicketActivity({
      ticketId,
      actorId: user.id,
      type: "CHECKLIST",
      summary: `Checklist item added: ${title}`,
      metadata: { itemId: item.id },
    });

    return NextResponse.json(item);
  } catch (e) {
    console.error("Checklist POST:", e);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
