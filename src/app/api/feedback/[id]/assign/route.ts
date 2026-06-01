import { NextRequest, NextResponse } from "next/server";
import { Role } from "@/lib/db-types";
import { db } from "@/lib/db";
import { canAccessTeam, getUserWithTeamAccess } from "@/lib/access";
import { createNotification, logTicketActivity } from "@/lib/ticketActivity";
import { getAuthorizedUser } from "@/lib/ticketAccess";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const user = await getAuthorizedUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (user.role === Role.CLIENT) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const feedback = await db.clientFeedback.findUnique({ where: { id } });
    if (!feedback) {
      return NextResponse.json(
        { error: "Feedback not found" },
        { status: 404 },
      );
    }

    if (
      user.role === Role.USER &&
      feedback.teamId &&
      !canAccessTeam(user, feedback.teamId)
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = (await request.json()) as {
      assignedToId?: string;
      ticketId?: string | null;
      status?: string;
    };

    const assignedToId =
      typeof body.assignedToId === "string" ? body.assignedToId : null;

    if (!assignedToId) {
      return NextResponse.json(
        { error: "assignedToId is required" },
        { status: 400 },
      );
    }

    const assignee = await getUserWithTeamAccess(assignedToId);
    if (!assignee || assignee.role === Role.CLIENT) {
      return NextResponse.json({ error: "Invalid assignee" }, { status: 400 });
    }

    const nextTicketId =
      typeof body.ticketId === "string" && body.ticketId ? body.ticketId : null;

    const updated = await db.clientFeedback.update({
      where: { id },
      data: {
        assignedToId,
        ticketId: nextTicketId ?? feedback.ticketId,
        status:
          typeof body.status === "string" && body.status
            ? body.status
            : "ASSIGNED",
        assignedAt: new Date(),
      },
    });

    await createNotification({
      userId: assignedToId,
      type: "CLIENT_FEEDBACK",
      title: "New client feedback assignment",
      body: updated.subject,
      ticketId: updated.ticketId ?? undefined,
    });

    if (updated.ticketId) {
      await logTicketActivity({
        ticketId: updated.ticketId,
        actorId: user.id,
        type: "CLIENT_FEEDBACK",
        summary: `Feedback assigned to ${assignee.name}`,
        metadata: { feedbackId: updated.id, assignedToId },
      });
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Feedback assign PATCH error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
