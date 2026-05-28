import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";
import { getGithubClient } from "@/lib/github";

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
    const query = searchParams.get("q") || "";

    if (!query) {
      // Just return their own repos if no query
      const { data } = await github.octokit.rest.repos.listForAuthenticatedUser(
        {
          sort: "updated",
          per_page: 20,
        },
      );
      return NextResponse.json(data);
    }

    const { data } = await github.octokit.rest.search.repos({
      q: `${query} in:name`,
      per_page: 20,
    });

    return NextResponse.json(data.items);
  } catch (error) {
    console.error("Search GitHub repos error:", error);
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

    const { projectId, owner, name, url } = await request.json();
    if (!projectId || !owner || !name || !url) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    // Verify user can access project
    const project = await db.project.findUnique({ where: { id: projectId } });
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const repo = await db.githubRepo.create({
      data: {
        projectId,
        owner,
        name,
        url,
      },
    });

    return NextResponse.json(repo);
  } catch (error: any) {
    if (error.code === "P2002") {
      return NextResponse.json(
        { error: "Repository already linked to this project" },
        { status: 400 },
      );
    }
    console.error("Link GitHub repo error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
