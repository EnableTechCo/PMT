import { NextRequest, NextResponse } from "next/server";
import { Role, TicketStatus } from "@/lib/db-types";
import { db } from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";
import { canAccessTeam, getUserWithTeamAccess } from "@/lib/access";

export async function GET(request: NextRequest) {
  try {
    const session = await getUserFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await getUserWithTeamAccess(session.id);
    if (!user || user.role === Role.CLIENT) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const teamId = searchParams.get("teamId");
    if (!teamId) {
      return NextResponse.json(
        { error: "teamId is required" },
        { status: 400 },
      );
    }
    if (!canAccessTeam(user, teamId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const since = new Date();
    since.setDate(since.getDate() - 70);

    const done = await db.ticket.findMany({
      where: {
        teamId,
        status: TicketStatus.COMPLETE,
        updatedAt: { gte: since },
      },
      select: { updatedAt: true },
    });

    const weeks: number[] = [];
    const now = new Date();
    for (let i = 7; i >= 1; i--) {
      const wk = new Date(now);
      wk.setDate(wk.getDate() - i * 7);
      const wkStart = new Date(wk);
      wkStart.setDate(wkStart.getDate() - wkStart.getDay());
      const wkEnd = new Date(wkStart);
      wkEnd.setDate(wkEnd.getDate() + 7);
      const c = done.filter(
        (t: { updatedAt: Date }) =>
          t.updatedAt >= wkStart && t.updatedAt < wkEnd,
      ).length;
      weeks.push(c);
    }

    const avg = weeks.reduce((a, b) => a + b, 0) / Math.max(1, weeks.length);
    const backlog = await db.ticket.count({
      where: {
        teamId,
        status: { not: TicketStatus.COMPLETE },
      },
    });

    const projectedWeeks =
      avg < 0.25 ? null : Math.ceil(backlog / Math.max(avg, 0.25));

    return NextResponse.json({
      averageCompletedPerWeek: Number(avg.toFixed(2)),
      openTickets: backlog,
      sampleWeeks: weeks,
      projectedWeeksToClearAtCurrentPace: projectedWeeks,
    });
  } catch (error) {
    console.error("Forecast error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
