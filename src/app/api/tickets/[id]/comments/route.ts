import { NextRequest, NextResponse } from "next/server";
import { Role } from "@/lib/db-types";
import { db } from "@/lib/db";
import {
  getAuthorizedUser,
  assertTicketReadable,
  loadTicketRow,
} from "@/lib/ticketAccess";
import { logTicketActivity, createNotification } from "@/lib/ticketActivity";

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

    const body = (await request.json()) as { body?: string };
    const text = typeof body.body === "string" ? body.body.trim() : "";
    if (!text) {
      return NextResponse.json({ error: "Comment body is required" }, { status: 400 });
    }

    const comment = await db.ticketComment.create({
      data: {
        ticketId,
        authorId: user.id,
        body: text,
      },
      include: {
        author: { select: { id: true, name: true, email: true } },
      },
    });

    await logTicketActivity({
      ticketId,
      actorId: user.id,
      type: "COMMENT",
      summary: `${user.name} commented`,
      metadata: { commentId: comment.id },
    });

    const targets = new Set<string>();
    if (ticket.assigneeId && ticket.assigneeId !== user.id) {
      targets.add(ticket.assigneeId);
    }
    if (ticket.creatorId && ticket.creatorId !== user.id) {
      targets.add(ticket.creatorId);
    }
    if (user.role === Role.CLIENT) {
      targets.clear();
      if (ticket.assigneeId) targets.add(ticket.assigneeId);
      if (ticket.creatorId && ticket.creatorId !== user.id) {
        targets.add(ticket.creatorId);
      }
    }
    for (const uid of targets) {
      await createNotification({
        userId: uid,
        type: "COMMENT",
        title: "New comment on ticket",
        body: ticket.title,
        ticketId,
      });
    }

    return NextResponse.json(comment);
  } catch (e) {
    console.error("Comment POST:", e);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
