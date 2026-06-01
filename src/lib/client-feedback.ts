import { db } from "@/lib/db";
import { createNotification, logTicketActivity } from "@/lib/ticketActivity";

export function parseTicketIdFromSubject(subject: string | null | undefined) {
  if (!subject) return null;
  const explicit = subject.match(/\[ticket:([a-f0-9-]{8,})\]/i);
  if (explicit?.[1]) return explicit[1];

  const loose = subject.match(/ticket\s*[:#-]\s*([a-f0-9-]{8,})/i);
  if (loose?.[1]) return loose[1];

  return null;
}

export async function notifyTicketStakeholders(input: {
  ticketId: string;
  actorId?: string;
  title: string;
  body?: string;
  type?: string;
}) {
  const ticket = await db.ticket.findUnique({ where: { id: input.ticketId } });
  if (!ticket) return;

  const targets = new Set<string>();
  if (ticket.creatorId) targets.add(ticket.creatorId);
  if (ticket.assigneeId) targets.add(ticket.assigneeId);
  if (input.actorId) targets.delete(input.actorId);

  for (const userId of targets) {
    await createNotification({
      userId,
      type: input.type ?? "CLIENT_FEEDBACK",
      title: input.title,
      body: input.body,
      ticketId: input.ticketId,
    });
  }
}

export async function logClientAccountabilityActivity(input: {
  ticketId: string;
  actorId: string;
  summary: string;
  metadata?: Record<string, unknown>;
}) {
  await logTicketActivity({
    ticketId: input.ticketId,
    actorId: input.actorId,
    type: "CLIENT_ACCOUNTABILITY",
    summary: input.summary,
    metadata: input.metadata,
  });
}
