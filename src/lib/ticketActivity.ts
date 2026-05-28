import { db } from "@/lib/db";

export async function logTicketActivity(input: {
  ticketId: string;
  actorId: string;
  type: string;
  summary: string;
  metadata?: Record<string, unknown>;
}) {
  await db.ticketActivity.create({
    data: {
      ticketId: input.ticketId,
      actorId: input.actorId,
      type: input.type,
      summary: input.summary,
      metadata: input.metadata ? JSON.stringify(input.metadata) : undefined,
    },
  });
}

export async function createNotification(input: {
  userId: string;
  type: string;
  title: string;
  body?: string;
  ticketId?: string;
}) {
  await db.notification.create({
    data: {
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body,
      ticketId: input.ticketId,
    },
  });
}
