import { NextRequest, NextResponse } from "next/server";
import { Role, TicketStatus } from "@/lib/db-types";
import { db } from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";

function startOfWeek(d: Date) {
  const x = new Date(d);
  const day = x.getDay();
  const diff = x.getDate() - day + (day === 0 ? -6 : 1);
  x.setDate(diff);
  x.setHours(0, 0, 0, 0);
  return x;
}

function weekKey(d: Date) {
  const s = startOfWeek(d);
  return s.toISOString().slice(0, 10);
}

export async function GET(request: NextRequest) {
  try {
    const session = await getUserFromRequest(request);
    if (!session || session.role !== Role.SUPER_ADMIN) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const [
      ticketStatusRows,
      projectHealthRows,
      projectStatusRows,
      openTickets,
    ] = await Promise.all([
      db.ticket.findMany({
        select: { status: true },
      }),
      db.project.findMany({
        select: { health: true },
      }),
      db.project.findMany({
        select: { status: true },
      }),
      db.ticket.count({
        where: { status: { not: TicketStatus.COMPLETE } },
      }),
    ]);

    const countBy = <T extends string>(
      rows: Array<{ value: T | null | undefined }>,
    ) => {
      const counts = new Map<string, number>();
      for (const row of rows) {
        if (!row.value) continue;
        counts.set(row.value, (counts.get(row.value) ?? 0) + 1);
      }
      return Array.from(counts.entries()).map(([key, count]) => ({
        key,
        count,
      }));
    };

    const ticketsByStatus = countBy(
      ticketStatusRows.map((row: any) => ({ value: row.status })),
    );
    const projectsByHealth = countBy(
      projectHealthRows.map((row: any) => ({ value: row.health })),
    );
    const projectsByStatus = countBy(
      projectStatusRows.map((row: any) => ({ value: row.status })),
    );

    const since = new Date();
    since.setDate(since.getDate() - 56);

    const completedTickets = await db.ticket.findMany({
      where: {
        status: TicketStatus.COMPLETE,
        updatedAt: { gte: since },
      },
      select: { updatedAt: true },
    });

    const weekly: Record<string, number> = {};
    for (const t of completedTickets) {
      const k = weekKey(t.updatedAt);
      weekly[k] = (weekly[k] ?? 0) + 1;
    }

    const keys = Object.keys(weekly).sort();
    const completedPerWeek = keys.map((k) => ({ week: k, count: weekly[k] }));

    const [teamsBase, teamTicketRows] = await Promise.all([
      db.team.findMany({
        select: {
          id: true,
          name: true,
        },
      }),
      db.ticket.findMany({
        select: {
          teamId: true,
        },
      }),
    ]);

    const ticketCountByTeam = new Map<string, number>();
    for (const row of teamTicketRows as Array<{ teamId?: string | null }>) {
      if (!row.teamId) continue;
      ticketCountByTeam.set(
        row.teamId,
        (ticketCountByTeam.get(row.teamId) ?? 0) + 1,
      );
    }

    const teams = teamsBase.map((team: any) => ({
      id: team.id,
      name: team.name,
      _count: {
        tickets: ticketCountByTeam.get(team.id) ?? 0,
      },
    }));

    return NextResponse.json({
      ticketsByStatus: ticketsByStatus.map((r) => ({
        status: r.key,
        count: r.count,
      })),
      projectsByHealth: projectsByHealth.map((r) => ({
        health: r.key,
        count: r.count,
      })),
      projectsByStatus: projectsByStatus.map((r) => ({
        status: r.key,
        count: r.count,
      })),
      openTickets,
      completedPerWeek,
      teams,
    });
  } catch (error) {
    console.error("Executive analytics error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
