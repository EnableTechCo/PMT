import { NextRequest, NextResponse } from "next/server";
import { Role } from "@/lib/db-types";
import { db } from "@/lib/db";
import {
  assertTicketReadable,
  getAuthorizedUser,
  loadTicketRow,
} from "@/lib/ticketAccess";
import {
  logClientAccountabilityActivity,
  notifyTicketStakeholders,
} from "@/lib/client-feedback";

function parseDueAt(value: unknown) {
  if (typeof value !== "string" || !value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

export async function GET(
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

    const obligations = await db.clientObligation.findMany({
      where: { ticketId },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(obligations);
  } catch (error) {
    console.error("Ticket obligations GET error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
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

    if (user.role === Role.CLIENT) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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

    const body = (await request.json()) as {
      title?: string;
      description?: string;
      dueAt?: string;
    };

    const title = typeof body.title === "string" ? body.title.trim() : "";
    if (!title) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }

    const dueAt = parseDueAt(body.dueAt);

    const obligation = await db.clientObligation.create({
      data: {
        ticketId,
        title,
        description:
          typeof body.description === "string" ? body.description.trim() : null,
        status: "PENDING",
        dueAt,
        createdById: user.id,
      },
    });

    await logClientAccountabilityActivity({
      ticketId,
      actorId: user.id,
      summary: `Client obligation created: ${title}`,
      metadata: { obligationId: obligation.id, dueAt: dueAt?.toISOString() },
    });

    await notifyTicketStakeholders({
      ticketId,
      actorId: user.id,
      title: "New client obligation",
      body: title,
      type: "CLIENT_OBLIGATION",
    });

    return NextResponse.json(obligation, { status: 201 });
  } catch (error) {
    console.error("Ticket obligations POST error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
