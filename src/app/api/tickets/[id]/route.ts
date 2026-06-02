import { NextRequest, NextResponse } from "next/server";
import { Role } from "@/lib/db-types";
import { db } from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";
import {
  canAccessTeam,
  getClientRecordForUser,
  getUserWithTeamAccess,
} from "@/lib/access";
import { writeAuditLog } from "@/lib/audit";
import { createNotification, logTicketActivity } from "@/lib/ticketActivity";

const ticketInclude = {
  creator: { select: { id: true, name: true, email: true } },
  assignee: { select: { id: true, name: true, email: true } },
  client: { select: { id: true, name: true, email: true } },
  team: { select: { id: true, name: true } },
  project: {
    select: {
      id: true,
      name: true,
      health: true,
      progress: true,
    },
  },
} as const;

const fullTicketInclude = {
  ...ticketInclude,
  comments: {
    orderBy: { createdAt: "asc" as const },
    include: {
      author: { select: { id: true, name: true, email: true } },
    },
  },
  checklistItems: { orderBy: { sortOrder: "asc" as const } },
  attachments: {
    orderBy: { createdAt: "desc" as const },
    include: { uploadedBy: { select: { id: true, name: true } } },
  },
  activities: {
    orderBy: { createdAt: "desc" as const },
    take: 200,
    include: { actor: { select: { id: true, name: true } } },
  },
  githubBranches: {
    orderBy: { createdAt: "desc" as const },
  },
  githubPullRequests: {
    orderBy: { createdAt: "desc" as const },
  },
} as const;

function isTicketRelationError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const maybe = error as { code?: unknown };
  const code = typeof maybe.code === "string" ? maybe.code : "";
  return code.startsWith("PGRST2");
}

async function loadTicketForAuth(id: string) {
  return db.ticket.findUnique({
    where: { id },
  });
}

async function attachProjectRepos(ticket: any) {
  const projectId = ticket?.project?.id;
  if (!projectId) return ticket;

  const githubRepos = await db.githubRepo.findMany({
    where: { projectId },
    select: { id: true, owner: true, name: true, url: true },
  });

  return {
    ...ticket,
    project: {
      ...ticket.project,
      githubRepos,
    },
  };
}

async function hydrateTicketFallback(baseTicket: any) {
  if (!baseTicket) return null;

  const [creator, assignee, client, team, project] = await Promise.all([
    baseTicket.creatorId
      ? db.user.findUnique({
          where: { id: baseTicket.creatorId },
          select: { id: true, name: true, email: true },
        })
      : Promise.resolve(null),
    baseTicket.assigneeId
      ? db.user.findUnique({
          where: { id: baseTicket.assigneeId },
          select: { id: true, name: true, email: true },
        })
      : Promise.resolve(null),
    baseTicket.clientId
      ? db.client.findUnique({
          where: { id: baseTicket.clientId },
          select: { id: true, name: true, email: true },
        })
      : Promise.resolve(null),
    baseTicket.teamId
      ? db.team.findUnique({
          where: { id: baseTicket.teamId },
          select: { id: true, name: true },
        })
      : Promise.resolve(null),
    baseTicket.projectId
      ? db.project.findUnique({
          where: { id: baseTicket.projectId },
          select: {
            id: true,
            name: true,
            health: true,
            progress: true,
          },
        })
      : Promise.resolve(null),
  ]);

  let projectWithRepos = project;
  if (project) {
    const repos = await db.githubRepo.findMany({
      where: { projectId: project.id },
      select: { id: true, owner: true, name: true, url: true },
    });
    projectWithRepos = {
      ...project,
      githubRepos: repos,
    };
  }

  return {
    ...baseTicket,
    creator,
    assignee,
    client,
    team,
    project: projectWithRepos,
    comments: [],
    checklistItems: [],
    attachments: [],
    activities: [],
    githubBranches: [],
    githubPullRequests: [],
  };
}

async function assertCanReadTicket(
  user: NonNullable<Awaited<ReturnType<typeof getUserWithTeamAccess>>>,
  ticket: { clientId: string | null; teamId: string | null },
) {
  if (user.role === Role.CLIENT) {
    const client = await getClientRecordForUser(user);
    if (!client || ticket.clientId !== client.id) return false;
    return true;
  }
  if (user.role === Role.USER || user.role === Role.SUPER_ADMIN) {
    if (ticket.teamId && !canAccessTeam(user, ticket.teamId)) return false;
    return true;
  }
  return false;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const sessionUser = await getUserFromRequest(_request);
    if (!sessionUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await getUserWithTeamAccess(sessionUser.id);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let ticket: any = null;
    try {
      ticket = await db.ticket.findUnique({
        where: { id },
        include: fullTicketInclude,
      });
    } catch (error) {
      if (!isTicketRelationError(error)) throw error;
      const baseTicket = await db.ticket.findUnique({ where: { id } });
      ticket = await hydrateTicketFallback(baseTicket);
    }

    if (!ticket) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }

    const ok = await assertCanReadTicket(user, ticket);
    if (!ok) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json(await attachProjectRepos(ticket));
  } catch (e) {
    console.error("GET ticket error:", e);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

const PRIORITY_SET = new Set<string>([
  "NONE",
  "LOW",
  "MEDIUM",
  "HIGH",
  "URGENT",
]);

function parseOptionalDate(v: unknown): Date | null | undefined {
  if (v === undefined) return undefined;
  if (v === null || v === "") return null;
  if (typeof v !== "string") return undefined;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return undefined;
  return d;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const sessionUser = await getUserFromRequest(request);
    if (!sessionUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await getUserWithTeamAccess(sessionUser.id);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const ticket = await loadTicketForAuth(id);
    if (!ticket) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }

    let updates = (await request.json()) as Record<string, unknown>;

    if (user.role === Role.CLIENT) {
      const client = await getClientRecordForUser(user);
      if (!client || ticket.clientId !== client.id) {
        return NextResponse.json(
          { error: "Ticket not found" },
          { status: 404 },
        );
      }

      if (ticket.status !== "CLIENT_REVIEW") {
        return NextResponse.json(
          { error: "Clients can only update tickets in Client Review status" },
          { status: 400 },
        );
      }

      const newStatus = updates.status as string | undefined;
      if (!newStatus || !["COMPLETE", "REVISIONS"].includes(newStatus)) {
        return NextResponse.json(
          {
            error:
              "Clients can only mark tickets as Complete or request Revisions",
          },
          { status: 400 },
        );
      }
      updates = { status: newStatus };
      await logTicketActivity({
        ticketId: id,
        actorId: user.id,
        type: "STATUS_CHANGE",
        summary: `Status: ${ticket.status} → ${newStatus}`,
        metadata: { from: ticket.status, to: newStatus },
      });
    } else {
      if (ticket.teamId && !canAccessTeam(user, ticket.teamId)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      const allowed: Record<string, unknown> = {};
      if (typeof updates.title === "string") {
        allowed.title = updates.title.trim();
      }
      if (typeof updates.description === "string") {
        allowed.description = updates.description;
      }
      if (typeof updates.acceptanceCriteria === "string") {
        allowed.acceptanceCriteria = updates.acceptanceCriteria;
      }
      if (
        typeof updates.status === "string" &&
        [
          "BACKLOG",
          "TODO",
          "REFINE",
          "IN_PROGRESS",
          "REVISIONS",
          "CLIENT_REVIEW",
          "COMPLETE",
        ].includes(updates.status)
      ) {
        allowed.status = updates.status;
      }
      if (
        typeof updates.priority === "string" &&
        PRIORITY_SET.has(updates.priority)
      ) {
        allowed.priority = updates.priority;
      }

      const startDate = parseOptionalDate(updates.startDate);
      if (startDate !== undefined) allowed.startDate = startDate;
      const dueDate = parseOptionalDate(updates.dueDate);
      if (dueDate !== undefined) allowed.dueDate = dueDate;

      if (updates.assigneeId === null || updates.assigneeId === "") {
        allowed.assigneeId = null;
      } else if (typeof updates.assigneeId === "string") {
        allowed.assigneeId = updates.assigneeId;
      }
      if (typeof updates.projectId === "string") {
        const proj = await db.project.findUnique({
          where: { id: updates.projectId },
        });
        if (
          !proj ||
          (ticket.teamId && proj.teamId !== ticket.teamId) ||
          (!ticket.teamId && proj.teamId)
        ) {
          return NextResponse.json(
            { error: "Invalid project for this ticket" },
            { status: 400 },
          );
        }
        allowed.projectId = updates.projectId;
      }
      if (updates.projectId === null) {
        allowed.projectId = null;
      }

      updates = allowed;
      if (Object.keys(updates).length === 0) {
        return NextResponse.json(
          { error: "No valid fields to update" },
          { status: 400 },
        );
      }

      if (updates.assigneeId && typeof updates.assigneeId === "string") {
        const assignee = await getUserWithTeamAccess(updates.assigneeId);
        if (!assignee || assignee.role === Role.CLIENT) {
          return NextResponse.json(
            { error: "Invalid assignee" },
            { status: 400 },
          );
        }
        if (ticket.teamId) {
          const ok =
            assignee.role === Role.SUPER_ADMIN ||
            canAccessTeam(assignee, ticket.teamId);
          if (!ok) {
            return NextResponse.json(
              { error: "Assignee must belong to the ticket team" },
              { status: 400 },
            );
          }
        }
      }

      /** Activity + notification (before mutate, compare to `ticket`) */
      const prev = ticket;
      if (updates.status && updates.status !== prev.status) {
        await logTicketActivity({
          ticketId: id,
          actorId: user.id,
          type: "STATUS_CHANGE",
          summary: `Status: ${prev.status} → ${updates.status}`,
          metadata: { from: prev.status, to: updates.status },
        });
      }
      if ("assigneeId" in updates && updates.assigneeId !== prev.assigneeId) {
        await logTicketActivity({
          ticketId: id,
          actorId: user.id,
          type: "ASSIGNMENT",
          summary:
            updates.assigneeId == null
              ? "Assignee removed"
              : "Assignee updated",
          metadata: {
            from: prev.assigneeId,
            to: updates.assigneeId,
          },
        });
        if (
          typeof updates.assigneeId === "string" &&
          updates.assigneeId !== user.id
        ) {
          await createNotification({
            userId: updates.assigneeId,
            type: "ASSIGNMENT",
            title: "You were assigned a ticket",
            body: prev.title,
            ticketId: id,
          });
        }
      }
      if (updates.priority && updates.priority !== prev.priority) {
        await logTicketActivity({
          ticketId: id,
          actorId: user.id,
          type: "FIELD",
          summary: `Priority set to ${updates.priority}`,
          metadata: { from: prev.priority, to: updates.priority },
        });
      }
      if (
        "dueDate" in updates &&
        String(updates.dueDate) !== String(prev.dueDate ?? "")
      ) {
        await logTicketActivity({
          ticketId: id,
          actorId: user.id,
          type: "FIELD",
          summary: updates.dueDate ? `Due date updated` : `Due date cleared`,
          metadata: { dueDate: updates.dueDate },
        });
      }
      if (
        "startDate" in updates &&
        String(updates.startDate) !== String(prev.startDate ?? "")
      ) {
        await logTicketActivity({
          ticketId: id,
          actorId: user.id,
          type: "FIELD",
          summary: updates.startDate
            ? `Start date updated`
            : `Start date cleared`,
          metadata: { startDate: updates.startDate },
        });
      }
      if (updates.title && updates.title !== prev.title) {
        await logTicketActivity({
          ticketId: id,
          actorId: user.id,
          type: "FIELD",
          summary: "Title updated",
        });
      }
      if (
        typeof updates.description === "string" &&
        updates.description !== (prev.description ?? "")
      ) {
        await logTicketActivity({
          ticketId: id,
          actorId: user.id,
          type: "FIELD",
          summary: "Description updated",
        });
      }
      if (
        typeof updates.acceptanceCriteria === "string" &&
        updates.acceptanceCriteria !== (prev.acceptanceCriteria ?? "")
      ) {
        await logTicketActivity({
          ticketId: id,
          actorId: user.id,
          type: "FIELD",
          summary: "Acceptance criteria updated",
        });
      }
    }

    const updated = await db.ticket.update({
      where: { id },
      data: updates as Record<string, unknown>,
    });

    let updatedTicket: any;
    try {
      updatedTicket = await db.ticket.findUnique({
        where: { id: updated.id },
        include: fullTicketInclude,
      });
    } catch (error) {
      if (!isTicketRelationError(error)) throw error;
      updatedTicket = await hydrateTicketFallback(updated);
    }

    await writeAuditLog({
      actorId: user.id,
      action: "TICKET_UPDATE",
      entityType: "Ticket",
      entityId: id,
      metadata: updates as Record<string, unknown>,
    });

    return NextResponse.json(await attachProjectRepos(updatedTicket));
  } catch (error) {
    console.error("Update ticket error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const sessionUser = await getUserFromRequest(request);
    if (!sessionUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await getUserWithTeamAccess(sessionUser.id);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (user.role === Role.CLIENT) {
      return NextResponse.json(
        { error: "Clients cannot delete tickets" },
        { status: 403 },
      );
    }

    const ticket = await db.ticket.findUnique({ where: { id } });
    if (!ticket) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }

    if (ticket.teamId && !canAccessTeam(user, ticket.teamId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const canDelete =
      user.role === Role.SUPER_ADMIN || ticket.creatorId === user.id;

    if (!canDelete) {
      return NextResponse.json(
        { error: "Only the creator or a super admin can delete this ticket" },
        { status: 403 },
      );
    }

    await db.ticket.delete({ where: { id } });

    await writeAuditLog({
      actorId: user.id,
      action: "TICKET_DELETE",
      entityType: "Ticket",
      entityId: id,
      metadata: { title: ticket.title },
    });

    return NextResponse.json({ message: "Ticket deleted successfully" });
  } catch (error) {
    console.error("Delete ticket error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
