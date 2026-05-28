import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";
import { getGithubClient } from "@/lib/github";

// GET /api/github/branches?owner=foo&repo=bar
// Fetches branches from GitHub for the specified repo
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

    const { data } = await github.octokit.rest.repos.listBranches({
      owner,
      repo,
      per_page: 50,
    });

    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Fetch branches error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch branches from GitHub" },
      { status: 500 },
    );
  }
}

// POST /api/github/branches
// Links a branch to a ticket
export async function POST(request: NextRequest) {
  try {
    const sessionUser = await getUserFromRequest(request);
    if (!sessionUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { ticketId, name, url } = await request.json();
    if (!ticketId || !name || !url) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    // Verify user can access ticket
    const ticket = await db.ticket.findUnique({ where: { id: ticketId } });
    if (!ticket) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }

    const branch = await db.githubBranch.create({
      data: {
        ticketId,
        name,
        url,
      },
    });

    return NextResponse.json(branch);
  } catch (error: any) {
    if (error.code === "P2002") {
      return NextResponse.json(
        { error: "Branch already linked to this ticket" },
        { status: 400 },
      );
    }
    console.error("Link branch error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// DELETE /api/github/branches?id=some-id
// Unlinks a branch from a ticket
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

    await db.githubBranch.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Unlink branch error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
