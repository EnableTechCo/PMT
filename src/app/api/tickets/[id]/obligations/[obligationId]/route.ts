import { NextRequest, NextResponse } from "next/server";
import { Role } from "@/lib/db-types";
import {
  assertTicketReadable,
  getAuthorizedUser,
  loadTicketRow,
} from "@/lib/ticketAccess";
import { db } from "@/lib/db";
import {
  logClientAccountabilityActivity,
  notifyTicketStakeholders,
} from "@/lib/client-feedback";

const STAFF_STATUSES = new Set(["PENDING", "APPROVED", "REJECTED", "OVERDUE"]);
const CLIENT_STATUSES = new Set(["SUBMITTED"]);

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; obligationId: string }> },
) {
  const { id: ticketId, obligationId } = await params;

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

    const obligation = await db.clientObligation.findUnique({
      where: { id: obligationId },
    });

    if (!obligation || obligation.ticketId !== ticketId) {
      return NextResponse.json(
        { error: "Obligation not found" },
        { status: 404 },
      );
    }

    const body = (await request.json()) as {
      status?: string;
      evidenceUrl?: string;
      evidenceNote?: string;
    };

    const status = typeof body.status === "string" ? body.status : "";
    if (!status) {
      return NextResponse.json(
        { error: "Status is required" },
        { status: 400 },
      );
    }

    if (user.role === Role.CLIENT && !CLIENT_STATUSES.has(status)) {
      return NextResponse.json(
        { error: "Forbidden status update" },
        { status: 403 },
      );
    }

    if (user.role !== Role.CLIENT && !STAFF_STATUSES.has(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    const now = new Date();
    const updated = await db.clientObligation.update({
      where: { id: obligationId },
      data: {
        status,
        evidenceUrl:
          typeof body.evidenceUrl === "string" ? body.evidenceUrl.trim() : null,
        evidenceNote:
          typeof body.evidenceNote === "string"
            ? body.evidenceNote.trim()
            : null,
        submittedAt: status === "SUBMITTED" ? now : obligation.submittedAt,
        reviewedAt:
          status === "APPROVED" || status === "REJECTED"
            ? now
            : obligation.reviewedAt,
      },
    });

    await logClientAccountabilityActivity({
      ticketId,
      actorId: user.id,
      summary: `Client obligation status changed: ${obligation.status} -> ${status}`,
      metadata: { obligationId, from: obligation.status, to: status },
    });

    await notifyTicketStakeholders({
      ticketId,
      actorId: user.id,
      title: "Client obligation updated",
      body: `${obligation.title}: ${status}`,
      type: "CLIENT_OBLIGATION",
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Ticket obligation PATCH error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
