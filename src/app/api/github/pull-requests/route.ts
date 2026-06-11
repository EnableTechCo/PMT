import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";
import { getGithubClient } from "@/lib/github";
import { createNotification } from "@/lib/ticketActivity";
import { TicketStatus } from "@/lib/db-types";

// GET /api/github/pull-requests?owner=foo&repo=bar
// Fetches pull requests from GitHub for the specified repo
export async function GET(request: NextRequest) {
  try {
    const sessionUser = await getUserFromRequest(request);
    if (!sessionUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const github = await getGithubClient(sessionUser.id);
    if (!github) {
      return NextResponse.json(
        { error: "GitHub not connected" },
        { status: 400 },
      );
    }

    const { searchParams } = new URL(request.url);
    const owner = searchParams.get("owner");
    const repo = searchParams.get("repo");

    if (!owner || !repo) {
      return NextResponse.json(
        { error: "Owner and Repo are required" },
        { status: 400 },
      );
    }

    const pullRequests: any[] = [];
    let page = 1;

    try {
      while (page <= 5) {
        const { data } = await github.octokit.rest.pulls.list({
          owner,
          repo,
          state: "all",
          per_page: 100,
          page,
        });

        pullRequests.push(...data);

        if (data.length < 100) {
          break;
        }

        page += 1;
      }

      return NextResponse.json(pullRequests);
    } catch (primaryError: any) {
      // Fallback for token/repo combinations where pulls.list may be restricted.
      const query = `repo:${owner}/${repo} is:pr`;
      const searchItems: any[] = [];
      let searchPage = 1;

      while (searchPage <= 5) {
        const { data } = await github.octokit.rest.search.issuesAndPullRequests(
          {
            q: query,
            per_page: 100,
            page: searchPage,
          },
        );

        searchItems.push(...data.items);

        if (data.items.length < 100) {
          break;
        }

        searchPage += 1;
      }

      if (!searchItems.length && primaryError?.message) {
        throw primaryError;
      }

      const mapped = searchItems.map((item) => ({
        id: item.id,
        number: item.number,
        title: item.title,
        state: item.state,
        html_url: item.html_url,
        user: item.user ? { login: item.user.login } : undefined,
      }));

      return NextResponse.json(mapped);
    }
  } catch (error: any) {
    console.error("Fetch PRs error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch pull requests from GitHub" },
      { status: 500 },
    );
  }
}

// POST /api/github/pull-requests
// Links a pull request to a ticket
export async function POST(request: NextRequest) {
  try {
    const sessionUser = await getUserFromRequest(request);
    if (!sessionUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { ticketId, selectorId, title, number, url, state, branchRef } =
      await request.json();

    let resolvedTicketId =
      typeof ticketId === "string" && ticketId ? ticketId : null;

    if (!resolvedTicketId && typeof selectorId === "number") {
      const matchedTicket = await db.ticket.findFirst({
        where: { selectorId },
        select: { id: true },
      });
      resolvedTicketId = matchedTicket?.id ?? null;
    }

    if (!resolvedTicketId || !title || number === undefined || !url || !state) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    // Verify user can access ticket
    const ticket = await db.ticket.findUnique({
      where: { id: resolvedTicketId },
      select: {
        id: true,
        title: true,
        creatorId: true,
        assigneeId: true,
      },
    });
    if (!ticket) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }

    const pr = await db.githubPullRequest.upsert({
      where: {
        ticketId_number: {
          ticketId: resolvedTicketId,
          number: parseInt(number, 10),
        },
      },
      update: {
        title,
        url,
        state,
      },
      create: {
        ticketId: resolvedTicketId,
        title,
        number: parseInt(number, 10),
        url,
        state,
      },
    });

    if (state === "open") {
      await db.ticket.update({
        where: { id: resolvedTicketId },
        data: { status: TicketStatus.IN_REVIEW },
      });

      await db.ticketActivity.create({
        data: {
          ticketId: resolvedTicketId,
          actorId: sessionUser.id,
          type: "PR_OPENED",
          summary: `PR opened${branchRef ? ` (${branchRef})` : ""}: ${title}`,
          metadata: JSON.stringify({
            source: "manual_link",
            prNumber: parseInt(number, 10),
            prUrl: url,
            branchRef: typeof branchRef === "string" ? branchRef : null,
            autoStatus: TicketStatus.IN_REVIEW,
          }),
        },
      });
    }

    if (state === "open") {
      const targets = new Set<string>();
      if (ticket.creatorId) targets.add(ticket.creatorId);
      if (ticket.assigneeId) targets.add(ticket.assigneeId);
      targets.delete(sessionUser.id);

      for (const userId of targets) {
        await createNotification({
          userId,
          type: "PR_READY_FOR_REVIEW",
          title: `PR ready for review: ${title}`,
          body: url,
          ticketId: resolvedTicketId,
        });
      }
    }

    return NextResponse.json(pr);
  } catch (error: any) {
    console.error("Link pull request error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// DELETE /api/github/pull-requests?id=some-id
// Unlinks a pull request from a ticket
export async function DELETE(request: NextRequest) {
  try {
    const sessionUser = await getUserFromRequest(request);
    if (!sessionUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "ID is required" }, { status: 400 });
    }

    await db.githubPullRequest.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Unlink pull request error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
