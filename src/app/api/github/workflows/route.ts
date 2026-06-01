import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { getGithubClient } from "@/lib/github";
import { Role } from "@/lib/db-types";

function canManageWorkflows(role: Role | undefined) {
  return role === Role.USER || role === Role.SUPER_ADMIN;
}

export async function GET(request: NextRequest) {
  try {
    const sessionUser = await getUserFromRequest(request);
    if (!sessionUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!canManageWorkflows(sessionUser.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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
        { error: "Owner and repo are required" },
        { status: 400 },
      );
    }

    const [workflowResult, runResult] = await Promise.all([
      github.octokit.rest.actions.listRepoWorkflows({
        owner,
        repo,
        per_page: 100,
      }),
      github.octokit.rest.actions.listWorkflowRunsForRepo({
        owner,
        repo,
        per_page: 30,
      }),
    ]);

    return NextResponse.json({
      workflows: workflowResult.data.workflows ?? [],
      runs: runResult.data.workflow_runs ?? [],
      authSource: github.auth.source,
    });
  } catch (error: any) {
    console.error("List workflows error:", error);
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
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

    if (!canManageWorkflows(sessionUser.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const github = await getGithubClient(sessionUser.id);
    if (!github) {
      return NextResponse.json(
        { error: "GitHub not connected" },
        { status: 400 },
      );
    }

    const body = await request.json();
    const owner = typeof body.owner === "string" ? body.owner.trim() : "";
    const repo = typeof body.repo === "string" ? body.repo.trim() : "";
    const ref = typeof body.ref === "string" ? body.ref.trim() : "main";
    const workflowId = body.workflowId;

    if (!owner || !repo || !workflowId) {
      return NextResponse.json(
        { error: "owner, repo, and workflowId are required" },
        { status: 400 },
      );
    }

    await github.octokit.rest.actions.createWorkflowDispatch({
      owner,
      repo,
      workflow_id: workflowId,
      ref,
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Dispatch workflow error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to dispatch workflow" },
      { status: 500 },
    );
  }
}
