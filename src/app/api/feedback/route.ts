import { NextRequest, NextResponse } from "next/server";
import { Role } from "@/lib/db-types";
import { db } from "@/lib/db";
import { getAuthorizedUser } from "@/lib/ticketAccess";
import { findClientByEmail } from "@/lib/user-store";
import { canAccessTeam, teamIdsForUser } from "@/lib/access";
import { notifyTicketStakeholders } from "@/lib/client-feedback";

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthorizedUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const teamId = searchParams.get("teamId");
    const where: Record<string, unknown> = {};

    if (typeof status === "string" && status) {
      where.status = status;
    }

    if (user.role === Role.CLIENT) {
      where.fromEmail = user.email;
    } else if (user.role === Role.USER) {
      const teamIds = teamIdsForUser(user) ?? [];
      if (teamId) {
        if (!canAccessTeam(user, teamId)) {
          return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
        where.teamId = teamId;
      } else if (teamIds.length > 0) {
        where.teamId = { in: teamIds };
      } else {
        return NextResponse.json([]);
      }
    } else if (teamId) {
      where.teamId = teamId;
    }

    const rows = await db.clientFeedback.findMany({
      where,
      include: {
        assignedTo: { select: { id: true, name: true, email: true } },
        ticket: { select: { id: true, title: true, teamId: true } },
      },
      orderBy: { receivedAt: "desc" },
      take: 200,
    });

    return NextResponse.json(rows);
  } catch (error) {
    console.error("Feedback GET error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthorizedUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as {
      ticketId?: string;
      fromEmail?: string;
      subject?: string;
      message?: string;
    };

    const message = typeof body.message === "string" ? body.message.trim() : "";
    if (!message) {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 },
      );
    }

    const fromEmail =
      user.role === Role.CLIENT
        ? user.email
        : typeof body.fromEmail === "string"
          ? body.fromEmail.trim().toLowerCase()
          : "";

    if (!fromEmail) {
      return NextResponse.json(
        { error: "fromEmail is required" },
        { status: 400 },
      );
    }

    let teamId: string | null = null;
    let ticketId: string | null = null;
    let clientId: string | null = null;

    if (typeof body.ticketId === "string" && body.ticketId) {
      const ticket = await db.ticket.findUnique({
        where: { id: body.ticketId },
      });
      if (ticket) {
        ticketId = ticket.id;
        teamId = ticket.teamId;
      }
    }

    const client = await findClientByEmail(fromEmail);
    if (client) {
      clientId = client.id;
    }

    const row = await db.clientFeedback.create({
      data: {
        source: "PORTAL",
        status: "NEW",
        fromEmail,
        subject:
          typeof body.subject === "string" && body.subject.trim()
            ? body.subject.trim()
            : "Client feedback",
        body: message,
        ticketId,
        teamId,
        clientId,
      },
    });

    if (ticketId) {
      await notifyTicketStakeholders({
        ticketId,
        actorId: user.id,
        title: "New client feedback",
        body: row.subject,
      });
    }

    return NextResponse.json(row, { status: 201 });
  } catch (error) {
    console.error("Feedback POST error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
