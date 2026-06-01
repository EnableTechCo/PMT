import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";
import { getGithubClient } from "@/lib/github";
import { createNotification } from "@/lib/ticketActivity";

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

    const { data } = await github.octokit.rest.pulls.list({
      owner,
      repo,
      state: "all",
      per_page: 50,
    });

    return NextResponse.json(data);
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

    const { ticketId, title, number, url, state } = await request.json();
    if (!ticketId || !title || number === undefined || !url || !state) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    // Verify user can access ticket
    const ticket = await db.ticket.findUnique({
      where: { id: ticketId },
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
          ticketId,
          number: parseInt(number, 10),
        },
      },
      update: {
        title,
        url,
        state,
      },
      create: {
        ticketId,
        title,
        number: parseInt(number, 10),
        url,
        state,
      },
    });

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
          ticketId,
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
