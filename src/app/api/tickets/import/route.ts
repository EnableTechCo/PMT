import { NextRequest, NextResponse } from "next/server";
import { Role, TicketStatus } from "@/lib/db-types";
import type { TicketPriority } from "@/lib/db-types";
import { db } from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";
import { canAccessTeam, getUserWithTeamAccess } from "@/lib/access";
import { writeAuditLog } from "@/lib/audit";

type ImportTaskInput = {
  title?: unknown;
  description?: unknown;
  acceptanceCriteria?: unknown;
  status?: unknown;
  priority?: unknown;
  creatorEmail?: unknown;
  assigneeEmail?: unknown;
  teamName?: unknown;
  teamId?: unknown;
  clientEmail?: unknown;
  projectName?: unknown;
  projectId?: unknown;
  startDate?: unknown;
  dueDate?: unknown;
};

type ResolvedRow = {
  title: string;
  description?: string;
  acceptanceCriteria?: string;
  status: string;
  priority: TicketPriority;
  creatorId: string;
  assigneeId: string | null;
  teamId: string;
  clientId: string | null;
  projectId: string | null;
  startDate: Date | null;
  dueDate: Date | null;
};

type RowResult = {
  index: number;
  title: string;
  status: "validated" | "created" | "error";
  message: string;
  ticketId?: string;
};

const PRIORITY_VALUES = new Set<string>([
  "NONE",
  "LOW",
  "MEDIUM",
  "HIGH",
  "URGENT",
]);

function asTrimmedString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function parseIsoDate(value: unknown): Date | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

async function resolveRow(
  row: ImportTaskInput,
  actorId: string,
): Promise<{ resolved?: ResolvedRow; error?: string }> {
  const title = asTrimmedString(row.title);
  if (!title) {
    return { error: "title is required" };
  }

  const description = asTrimmedString(row.description) ?? undefined;
  const acceptanceCriteria =
    asTrimmedString(row.acceptanceCriteria) ?? undefined;

  const statusIn = asTrimmedString(row.status) ?? "BACKLOG";
  if (!(Object.values(TicketStatus) as string[]).includes(statusIn)) {
    return {
      error:
        "status is invalid. Use BACKLOG, TODO, REFINE, IN_PROGRESS, IN_REVIEW, QA, REVISIONS, CLIENT_REVIEW, COMPLETE",
    };
  }

  const priorityIn = asTrimmedString(row.priority) ?? "MEDIUM";
  if (!PRIORITY_VALUES.has(priorityIn)) {
    return {
      error: "priority is invalid. Use NONE, LOW, MEDIUM, HIGH, URGENT",
    };
  }

  const creatorEmail = asTrimmedString(row.creatorEmail)?.toLowerCase();
  const creator = creatorEmail
    ? await db.user.findFirst({
        where: { email: creatorEmail },
        select: { id: true, role: true },
      })
    : null;

  if (creatorEmail && !creator) {
    return { error: `creatorEmail not found: ${creatorEmail}` };
  }

  if (creator && creator.role === Role.CLIENT) {
    return { error: "creatorEmail cannot be a CLIENT user" };
  }

  const teamIdIn = asTrimmedString(row.teamId);
  const teamNameIn = asTrimmedString(row.teamName);
  if (!teamIdIn && !teamNameIn) {
    return { error: "teamId or teamName is required" };
  }

  let team: { id: string; name: string } | null = null;
  if (teamIdIn) {
    team = await db.team.findUnique({
      where: { id: teamIdIn },
      select: { id: true, name: true },
    });
  } else if (teamNameIn) {
    team = await db.team.findFirst({
      where: { name: teamNameIn },
      select: { id: true, name: true },
    });
  }

  if (!team) {
    return {
      error: teamIdIn
        ? `teamId not found: ${teamIdIn}`
        : `teamName not found: ${teamNameIn}`,
    };
  }

  const assigneeEmail = asTrimmedString(row.assigneeEmail)?.toLowerCase();
  const assignee = assigneeEmail
    ? await db.user.findFirst({
        where: { email: assigneeEmail },
        select: { id: true, role: true },
      })
    : null;

  if (assigneeEmail && !assignee) {
    return { error: `assigneeEmail not found: ${assigneeEmail}` };
  }

  if (assignee && assignee.role === Role.CLIENT) {
    return { error: "assigneeEmail cannot be a CLIENT user" };
  }

  if (assignee) {
    const assigneeWithAccess = await getUserWithTeamAccess(assignee.id);
    if (!assigneeWithAccess) {
      return { error: "assignee could not be resolved" };
    }
    const ok =
      assigneeWithAccess.role === Role.SUPER_ADMIN ||
      canAccessTeam(assigneeWithAccess, team.id);
    if (!ok) {
      return { error: "assignee does not belong to selected team" };
    }
  }

  const clientEmail = asTrimmedString(row.clientEmail)?.toLowerCase();
  const client = clientEmail
    ? await db.client.findFirst({
        where: { email: clientEmail },
        select: { id: true, isInvited: true },
      })
    : null;

  if (clientEmail && !client) {
    return { error: `clientEmail not found: ${clientEmail}` };
  }

  if (client && !client.isInvited) {
    return { error: "clientEmail exists but client is not invited" };
  }

  const projectIdIn = asTrimmedString(row.projectId);
  const projectNameIn = asTrimmedString(row.projectName);

  let project: {
    id: string;
    name: string;
    teamId: string;
    clientId: string | null;
  } | null = null;

  if (projectIdIn) {
    project = await db.project.findUnique({
      where: { id: projectIdIn },
      select: { id: true, name: true, teamId: true, clientId: true },
    });
  } else if (projectNameIn) {
    project = await db.project.findFirst({
      where: { name: projectNameIn, teamId: team.id },
      select: { id: true, name: true, teamId: true, clientId: true },
    });
  }

  if ((projectIdIn || projectNameIn) && !project) {
    return {
      error: projectIdIn
        ? `projectId not found: ${projectIdIn}`
        : `projectName not found for team: ${projectNameIn}`,
    };
  }

  if (project && project.teamId !== team.id) {
    return { error: "project does not belong to selected team" };
  }

  let finalClientId: string | null = client?.id ?? null;
  if (project?.clientId && !finalClientId) {
    finalClientId = project.clientId;
  }
  if (
    project?.clientId &&
    finalClientId &&
    project.clientId !== finalClientId
  ) {
    return { error: "project client does not match clientEmail" };
  }

  const startDate = parseIsoDate(row.startDate);
  if (row.startDate && !startDate) {
    return { error: "startDate is invalid ISO datetime" };
  }

  const dueDate = parseIsoDate(row.dueDate);
  if (row.dueDate && !dueDate) {
    return { error: "dueDate is invalid ISO datetime" };
  }

  return {
    resolved: {
      title,
      description,
      acceptanceCriteria,
      status: statusIn,
      priority: priorityIn as TicketPriority,
      creatorId: creator?.id ?? actorId,
      assigneeId: assignee?.id ?? null,
      teamId: team.id,
      clientId: finalClientId,
      projectId: project?.id ?? null,
      startDate,
      dueDate,
    },
  };
}

export async function POST(request: NextRequest) {
  try {
    const sessionUser = await getUserFromRequest(request);
    if (!sessionUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await getUserWithTeamAccess(sessionUser.id);
    if (!user || user.role !== Role.SUPER_ADMIN) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const tasks = Array.isArray(body)
      ? body
      : Array.isArray(body?.tasks)
        ? body.tasks
        : null;
    const dryRun = Boolean(body?.dryRun);

    if (!tasks) {
      return NextResponse.json(
        { error: "Request body must be an array or { tasks: [] }" },
        { status: 400 },
      );
    }

    const results: RowResult[] = [];
    let createdCount = 0;
    let failedCount = 0;

    for (let i = 0; i < tasks.length; i += 1) {
      const row = tasks[i] as ImportTaskInput;
      const title = asTrimmedString(row.title) ?? "(untitled)";

      const { resolved, error } = await resolveRow(row, user.id);
      if (error || !resolved) {
        failedCount += 1;
        results.push({
          index: i,
          title,
          status: "error",
          message: error ?? "Row validation failed",
        });
        continue;
      }

      if (dryRun) {
        results.push({
          index: i,
          title: resolved.title,
          status: "validated",
          message: "Valid",
        });
        continue;
      }

      const created = await db.ticket.create({
        data: {
          title: resolved.title,
          description: resolved.description,
          acceptanceCriteria: resolved.acceptanceCriteria,
          status: resolved.status,
          priority: resolved.priority,
          creatorId: resolved.creatorId,
          assigneeId: resolved.assigneeId,
          teamId: resolved.teamId,
          clientId: resolved.clientId,
          projectId: resolved.projectId,
          startDate: resolved.startDate,
          dueDate: resolved.dueDate,
        },
      });

      createdCount += 1;
      results.push({
        index: i,
        title: resolved.title,
        status: "created",
        message: "Ticket created",
        ticketId: created.id,
      });
    }

    if (!dryRun) {
      await writeAuditLog({
        actorId: user.id,
        action: "TICKET_IMPORT",
        entityType: "Ticket",
        entityId: "bulk",
        metadata: {
          totalRows: tasks.length,
          createdCount,
          failedCount,
        },
      });
    }

    const validatedCount = results.filter(
      (r) => r.status === "validated",
    ).length;

    return NextResponse.json({
      summary: {
        total: tasks.length,
        created: createdCount,
        validated: validatedCount,
        failed: failedCount,
        dryRun,
      },
      rows: results,
    });
  } catch (error) {
    console.error("Ticket import error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
