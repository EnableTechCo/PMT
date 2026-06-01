import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { Role } from "@/lib/db-types";
import {
  notifyTicketStakeholders,
  parseTicketIdFromSubject,
} from "@/lib/client-feedback";
import { createNotification } from "@/lib/ticketActivity";
import { findClientByEmail } from "@/lib/user-store";

function normalizeFromEmail(input: string): string {
  const trimmed = input.trim().toLowerCase();
  const bracketMatch = trimmed.match(/<([^>]+)>/);
  if (bracketMatch?.[1]) {
    return bracketMatch[1].trim().toLowerCase();
  }
  return trimmed;
}

function isAuthorizedRequest(request: NextRequest) {
  const required = process.env.FEEDBACK_INGEST_SECRET;
  if (!required) return false;
  const provided = request.headers.get("x-feedback-secret");
  return Boolean(provided && provided === required);
}

function parseCsvValues(value?: string) {
  if (!value) return [];
  return value
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

function isSentryAlertEmail(input: {
  from: string;
  to?: string;
  subject: string;
  message: string;
}) {
  const from = input.from.toLowerCase();
  const to = (input.to || "").toLowerCase();
  const subject = input.subject.toLowerCase();
  const message = input.message.toLowerCase();

  const allowedFrom = parseCsvValues(process.env.SENTRY_ALERT_FROM_ALLOWLIST);
  const allowedTo = parseCsvValues(process.env.SENTRY_ALERT_TO_ALLOWLIST);

  if (allowedFrom.some((value) => from.includes(value))) {
    return true;
  }

  if (allowedTo.some((value) => to.includes(value))) {
    return true;
  }

  // Default fallback for teams that have not configured allowlists yet.
  if (to.includes("dev@sentry")) {
    return true;
  }

  if (from.includes("sentry.io") || from.includes("sentry")) {
    return true;
  }

  if (subject.includes("sentry")) {
    return true;
  }

  return message.includes("sentry.io");
}

function extractSentryLink(message: string) {
  const match = message.match(/https?:\/\/[^\s<>"]*sentry\.io[^\s<>"]*/i);
  return match?.[0] || null;
}

export async function POST(request: NextRequest) {
  try {
    if (!isAuthorizedRequest(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as {
      from?: string;
      subject?: string;
      text?: string;
      html?: string;
      ticketId?: string;
      attachments?: Array<{
        filename?: string;
        contentType?: string;
        size?: number;
        url?: string;
      }>;
      raw?: unknown;
    };

    const from =
      typeof body.from === "string" ? normalizeFromEmail(body.from) : "";
    const to = typeof (body as { to?: string }).to === "string"
      ? normalizeFromEmail((body as { to?: string }).to || "")
      : "";
    const subject =
      typeof body.subject === "string" ? body.subject.trim() : "(No subject)";
    const message =
      typeof body.text === "string" && body.text.trim()
        ? body.text.trim()
        : typeof body.html === "string" && body.html.trim()
          ? body.html.trim()
          : "";

    if (!from || !message) {
      return NextResponse.json(
        { error: "from and message are required" },
        { status: 400 },
      );
    }

    if (isSentryAlertEmail({ from, to, subject, message })) {
      const sentryLink = extractSentryLink(message);

      const row = await db.clientFeedback.create({
        data: {
          source: "SENTRY_EMAIL",
          status: "NEW",
          fromEmail: from,
          subject,
          body: message,
          attachmentJson: Array.isArray(body.attachments)
            ? JSON.stringify(body.attachments)
            : null,
          rawPayload: body.raw ? JSON.stringify(body.raw) : null,
        },
      });

      const superAdmins = await db.user.findMany({
        where: { role: Role.SUPER_ADMIN },
        select: { id: true },
      });

      const title = `Sentry email alert: ${subject}`;
      const notificationBody = sentryLink || message.slice(0, 180);

      for (const admin of superAdmins) {
        const existing = await db.notification.findFirst({
          where: {
            userId: admin.id,
            type: "MONITORING_ERROR",
            title,
            body: notificationBody,
          },
          select: { id: true },
        });

        if (existing) continue;

        await createNotification({
          userId: admin.id,
          type: "MONITORING_ERROR",
          title,
          body: notificationBody,
        });
      }

      return NextResponse.json(
        { ok: true, feedbackId: row.id, source: "SENTRY_EMAIL" },
        { status: 201 },
      );
    }

    const parsedTicketId =
      (typeof body.ticketId === "string" && body.ticketId) ||
      parseTicketIdFromSubject(subject);

    let ticketId: string | null = null;
    let teamId: string | null = null;

    if (parsedTicketId) {
      const ticket = await db.ticket.findUnique({
        where: { id: parsedTicketId },
      });
      if (ticket) {
        ticketId = ticket.id;
        teamId = ticket.teamId;
      }
    }

    const client = await findClientByEmail(from);
    if (!client || !client.isInvited) {
      return NextResponse.json(
        {
          error:
            "Sender email is not an invited client account. Please send from the invited client email.",
        },
        { status: 403 },
      );
    }

    const row = await db.clientFeedback.create({
      data: {
        source: "EMAIL",
        status: "NEW",
        fromEmail: from,
        subject,
        body: message,
        ticketId,
        teamId,
        clientId: client.id,
        attachmentJson: Array.isArray(body.attachments)
          ? JSON.stringify(body.attachments)
          : null,
        rawPayload: body.raw ? JSON.stringify(body.raw) : null,
      },
    });

    if (ticketId) {
      await notifyTicketStakeholders({
        ticketId,
        title: "Inbound client email",
        body: subject,
      });
    }

    return NextResponse.json({ ok: true, feedbackId: row.id }, { status: 201 });
  } catch (error) {
    console.error("Feedback email POST error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
