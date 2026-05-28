import { NextRequest, NextResponse } from "next/server";
import { Role, TicketStatus } from "@/lib/db-types";
import type { TicketPriority } from "@/lib/db-types";
import { db } from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";
import {
  canAccessTeam,
  getClientRecordForUser,
  getUserWithTeamAccess,
  teamIdsForUser,
} from "@/lib/access";
import { writeAuditLog } from "@/lib/audit";
import { createNotification, logTicketActivity } from "@/lib/ticketActivity";

/** Matches `enum TicketPriority` in schema; avoid `Object.values(TicketPriority)` when the client bundle omits the runtime enum. */
const PRIORITY_VALUES = new Set<string>([
  "NONE",
  "LOW",
  "MEDIUM",
  "HIGH",
  "URGENT",
]);

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
      githubRepos: {
        select: { id: true, owner: true, name: true, url: true },
      },
    },
  },
} as const;

function isTicketRelationError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const maybe = error as {
    code?: unknown;
    message?: unknown;
    details?: unknown;
  };
  const code = typeof maybe.code === "string" ? maybe.code : "";
  const message = typeof maybe.message === "string" ? maybe.message : "";
  const details = typeof maybe.details === "string" ? maybe.details : "";

  return (
    code === "PGRST200" &&
    (message.includes("Ticket") || details.includes("Ticket"))
  );
}

async function hydrateTickets(baseTickets: any[]) {
  const creatorIds = new Set<string>();
  const assigneeIds = new Set<string>();
  const clientIds = new Set<string>();
  const teamIds = new Set<string>();
  const projectIds = new Set<string>();

  for (const ticket of baseTickets) {
    if (ticket.creatorId) creatorIds.add(ticket.creatorId);
    if (ticket.assigneeId) assigneeIds.add(ticket.assigneeId);
    if (ticket.clientId) clientIds.add(ticket.clientId);
    if (ticket.teamId) teamIds.add(ticket.teamId);
    if (ticket.projectId) projectIds.add(ticket.projectId);
  }

  const userIds = Array.from(new Set([...creatorIds, ...assigneeIds]));

  const [users, clients, teams, projects] = await Promise.all([
    userIds.length
      ? db.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, name: true, email: true },
        })
      : Promise.resolve([]),
    clientIds.size
      ? db.client.findMany({
          where: { id: { in: Array.from(clientIds) } },
          select: { id: true, name: true, email: true },
        })
      : Promise.resolve([]),
    teamIds.size
      ? db.team.findMany({
          where: { id: { in: Array.from(teamIds) } },
          select: { id: true, name: true },
        })
      : Promise.resolve([]),
    projectIds.size
      ? db.project.findMany({
          where: { id: { in: Array.from(projectIds) } },
          select: {
            id: true,
            name: true,
            health: true,
            progress: true,
            githubRepos: {
              select: { id: true, owner: true, name: true, url: true },
            },
          },
        })
      : Promise.resolve([]),
  ]);

  const userById = new Map(users.map((u: any) => [u.id, u]));
  const clientById = new Map(clients.map((c: any) => [c.id, c]));
  const teamById = new Map(teams.map((t: any) => [t.id, t]));
  const projectById = new Map(projects.map((p: any) => [p.id, p]));

  return baseTickets.map((ticket: any) => ({
    ...ticket,
    creator: userById.get(ticket.creatorId) ?? {
      id: ticket.creatorId,
      name: "Unknown",
      email: "",
    },
    assignee: ticket.assigneeId
      ? (userById.get(ticket.assigneeId) ?? null)
      : null,
    client: ticket.clientId ? (clientById.get(ticket.clientId) ?? null) : null,
    team: ticket.teamId ? (teamById.get(ticket.teamId) ?? null) : null,
    project: ticket.projectId
      ? (projectById.get(ticket.projectId) ?? null)
      : null,
  }));
}

export async function GET(request: NextRequest) {
  try {
    const sessionUser = await getUserFromRequest(request);
    if (!sessionUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await getUserWithTeamAccess(sessionUser.id);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const clientId = searchParams.get("clientId");
    const teamIdParam = searchParams.get("teamId");
    const projectId = searchParams.get("projectId");
    const assigneeId = searchParams.get("assigneeId");
    const myWorkload = searchParams.get("myWorkload") === "1";
    const priorityParam = searchParams.get("priority");

    const where: Record<string, unknown> = {};

    if (priorityParam && PRIORITY_VALUES.has(priorityParam)) {
      where.priority = priorityParam;
    }

    if (status && (Object.values(TicketStatus) as string[]).includes(status)) {
      where.status = status;
    }
    if (clientId) {
      where.clientId = clientId;
    }
    if (projectId) {
      where.projectId = projectId;
    }

    if (user.role === Role.CLIENT) {
      const client = await getClientRecordForUser(user);
      if (!client) {
        return NextResponse.json([]);
      }
      where.clientId = client.id;
    } else if (user.role === Role.USER) {
      const allowedTeams = teamIdsForUser(user) ?? [];
      if (myWorkload) {
        where.assigneeId = user.id;
        if (allowedTeams.length === 0) {
          return NextResponse.json([]);
        }
        where.teamId = { in: allowedTeams };
      } else {
        if (!teamIdParam) {
          return NextResponse.json(
            { error: "teamId is required to view team tickets" },
            { status: 400 },
          );
        }
        if (!canAccessTeam(user, teamIdParam)) {
          return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
        where.teamId = teamIdParam;
        if (assigneeId) {
          where.assigneeId = assigneeId;
        }
      }
    } else if (user.role === Role.SUPER_ADMIN) {
      if (myWorkload) {
        where.assigneeId = user.id;
      } else if (teamIdParam) {
        where.teamId = teamIdParam;
      }
      if (assigneeId) {
        where.assigneeId = assigneeId;
      }
    }

    let tickets: any[];
    try {
      tickets = await db.ticket.findMany({
        where,
        include: ticketInclude,
        orderBy: { createdAt: "desc" },
      });
    } catch (error) {
      if (!isTicketRelationError(error)) throw error;
      const baseTickets = await db.ticket.findMany({
        where,
        orderBy: { createdAt: "desc" },
      });
      tickets = await hydrateTickets(baseTickets);
    }

    return NextResponse.json(tickets);
  } catch (error) {
    console.error("Get tickets error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
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
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const title = typeof body.title === "string" ? body.title.trim() : "";
    const status = body.status ?? "BACKLOG";
    const clientIdIn = body.clientId ?? null;
    const teamIdIn = typeof body.teamId === "string" ? body.teamId : null;
    const projectIdIn =
      typeof body.projectId === "string" ? body.projectId : null;
    const assigneeIdIn =
      typeof body.assigneeId === "string" ? body.assigneeId : null;
    const description =
      typeof body.description === "string"
        ? body.description.trim()
        : undefined;
    const acceptanceCriteria =
      typeof body.acceptanceCriteria === "string"
        ? body.acceptanceCriteria.trim()
        : undefined;

    let priority: TicketPriority = "MEDIUM";
    if (
      typeof body.priority === "string" &&
      PRIORITY_VALUES.has(body.priority)
    ) {
      priority = body.priority as TicketPriority;
    }

    let startDate: Date | undefined;
    let dueDate: Date | undefined;
    if (typeof body.startDate === "string" && body.startDate) {
      const d = new Date(body.startDate);
      if (!Number.isNaN(d.getTime())) startDate = d;
    }
    if (typeof body.dueDate === "string" && body.dueDate) {
      const d = new Date(body.dueDate);
      if (!Number.isNaN(d.getTime())) dueDate = d;
    }

    if (!title) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }

    if (!teamIdIn) {
      return NextResponse.json(
        { error: "teamId is required for new tickets" },
        { status: 400 },
      );
    }

    if (!canAccessTeam(user, teamIdIn)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    let finalClientId: string | null = null;
    if (clientIdIn) {
      const client = await db.client.findUnique({ where: { id: clientIdIn } });
      if (!client) {
        return NextResponse.json(
          { error: "Client not found" },
          { status: 400 },
        );
      }
      if (!client.isInvited) {
        return NextResponse.json(
          { error: "Only invited clients can be assigned to tickets" },
          { status: 400 },
        );
      }
      finalClientId = clientIdIn;
    }

    let projectForTicket: {
      id: string;
      name: string;
      teamId: string;
      clientId: string | null;
    } | null = null;

    if (projectIdIn) {
      projectForTicket = await db.project.findUnique({
        where: { id: projectIdIn },
        select: {
          id: true,
          name: true,
          teamId: true,
          clientId: true,
        },
      });

      if (!projectForTicket || projectForTicket.teamId !== teamIdIn) {
        return NextResponse.json(
          { error: "Project not found for this team" },
          { status: 400 },
        );
      }

      if (!projectForTicket.clientId) {
        return NextResponse.json(
          { error: "Selected project is not attached to a client" },
          { status: 400 },
        );
      }

      if (!finalClientId) {
        finalClientId = projectForTicket.clientId;
      }

      if (finalClientId !== projectForTicket.clientId) {
        return NextResponse.json(
          {
            error: "Selected project does not belong to the selected client",
          },
          { status: 400 },
        );
      }
    }

    let finalAssigneeId: string | null = null;
    if (assigneeIdIn) {
      const assignee = await getUserWithTeamAccess(assigneeIdIn);
      if (!assignee || assignee.role === Role.CLIENT) {
        return NextResponse.json(
          { error: "Invalid assignee" },
          { status: 400 },
        );
      }
      const ok =
        assignee.role === Role.SUPER_ADMIN ||
        canAccessTeam(assignee, teamIdIn as string);
      if (!ok) {
        return NextResponse.json(
          { error: "Assignee must belong to the team" },
          { status: 400 },
        );
      }
      finalAssigneeId = assigneeIdIn;
    }

    const ticket = await db.ticket.create({
      data: {
        title,
        description,
        acceptanceCriteria,
        status,
        priority,
        startDate: startDate ?? null,
        dueDate: dueDate ?? null,
        creatorId: user.id,
        clientId: finalClientId,
        assigneeId: finalAssigneeId,
        teamId: teamIdIn,
        projectId: projectIdIn,
      },
    });

    let responseTicket: any = ticket;
    try {
      const embedded = await db.ticket.findUnique({
        where: { id: ticket.id },
        include: ticketInclude,
      });
      if (embedded) responseTicket = embedded;
    } catch (error) {
      if (!isTicketRelationError(error)) throw error;
      const hydrated = await hydrateTickets([ticket]);
      responseTicket = hydrated[0] ?? ticket;
    }

    await logTicketActivity({
      ticketId: ticket.id,
      actorId: user.id,
      type: "CREATED",
      summary: `Ticket created: ${title}`,
    });

    if (projectForTicket) {
      try {
        const repos = await db.githubRepo.findMany({
          where: { projectId: projectForTicket.id },
          select: { id: true, owner: true, name: true, url: true },
        });

        if (repos.length > 0) {
          await logTicketActivity({
            ticketId: ticket.id,
            actorId: user.id,
            type: "REPO_CONTEXT_INHERITED",
            summary: `Inherited ${repos.length} project repo(s): ${repos
              .map((repo: any) => `${repo.owner}/${repo.name}`)
              .join(", ")}`,
            metadata: {
              projectId: projectForTicket.id,
              projectName: projectForTicket.name,
              repos,
            },
          });

          if (finalAssigneeId && finalAssigneeId !== user.id) {
            await createNotification({
              userId: finalAssigneeId,
              type: "GITHUB_REPO_CONTEXT",
              title: `Repo context inherited for ticket ${ticket.title}`,
              body: `Work from ${repos
                .map((repo: any) => `${repo.owner}/${repo.name}`)
                .join(", ")}. Check for latest changes before starting work.`,
              ticketId: ticket.id,
            });
          }
        }
      } catch (repoContextError) {
        console.warn("Failed to log inherited repo context", repoContextError);
      }
    }

    await writeAuditLog({
      actorId: user.id,
      action: "TICKET_CREATE",
      entityType: "Ticket",
      entityId: ticket.id,
      metadata: { title: ticket.title, teamId: teamIdIn },
    });

    return NextResponse.json(responseTicket);
  } catch (error) {
    console.error("Create ticket error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
