import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";
import { getUserWithTeamAccess } from "@/lib/access";
import { TicketStatus } from "@/lib/db-types";
import { getGithubClient } from "@/lib/github";

export async function POST(request: NextRequest) {
  try {
    const sessionUser = await getUserFromRequest(request);
    if (!sessionUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await getUserWithTeamAccess(sessionUser.id);
    if (!user || user.role === "CLIENT") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { owner, repo, number, ticketId, selectorId } = await request.json();

    if (
      typeof owner !== "string" ||
      typeof repo !== "string" ||
      typeof number !== "number"
    ) {
      return NextResponse.json(
        { error: "owner, repo and number are required" },
        { status: 400 },
      );
    }

    let resolvedTicketId = typeof ticketId === "string" ? ticketId : "";

    if (!resolvedTicketId && typeof selectorId === "number") {
      const ticketFromSelector = await db.ticket.findFirst({
        where: { selectorId },
        select: { id: true },
      });
      resolvedTicketId = ticketFromSelector?.id ?? "";
    }

    if (!resolvedTicketId) {
      return NextResponse.json(
        { error: "ticketId or selectorId is required" },
        { status: 400 },
      );
    }

    const ticket = await db.ticket.findUnique({
      where: { id: resolvedTicketId },
      select: { id: true },
    });

    if (!ticket) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }

    const github = await getGithubClient(sessionUser.id);
    if (!github) {
      return NextResponse.json(
        { error: "GitHub not connected" },
        { status: 400 },
      );
    }

    const { data: pr } = await github.octokit.rest.pulls.get({
      owner,
      repo,
      pull_number: number,
    });

    const linked = await db.githubPullRequest.upsert({
      where: {
        ticketId_number: {
          ticketId: resolvedTicketId,
          number,
        },
      },
      update: {
        title: pr.title,
        url: pr.html_url,
        state: pr.merged_at ? "merged" : pr.state,
      },
      create: {
        ticketId: resolvedTicketId,
        title: pr.title,
        number,
        url: pr.html_url,
        state: pr.merged_at ? "merged" : pr.state,
      },
    });

    if (pr.state === "open") {
      await db.ticket.update({
        where: { id: resolvedTicketId },
        data: { status: TicketStatus.IN_REVIEW },
      });

      await db.ticketActivity.create({
        data: {
          ticketId: resolvedTicketId,
          actorId: sessionUser.id,
          type: "PR_OPENED",
          summary: `Existing PR linked: ${pr.title}`,
          metadata: JSON.stringify({
            source: "manual_assign",
            repo: `${owner}/${repo}`,
            prNumber: number,
            prUrl: pr.html_url,
            autoStatus: TicketStatus.IN_REVIEW,
          }),
        },
      });
    }

    return NextResponse.json({ ok: true, pullRequest: linked });
  } catch (error) {
    console.error("Assign existing PR error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
