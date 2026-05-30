import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { getGithubClient } from "@/lib/github";
import { Role } from "@/lib/db-types";

export async function GET(request: NextRequest) {
  try {
    const sessionUser = await getUserFromRequest(request);
    if (!sessionUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (sessionUser.role !== Role.SUPER_ADMIN) {
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
    const workflowId = searchParams.get("workflowId");

    if (!owner || !repo) {
      return NextResponse.json(
        { error: "Owner and repo are required" },
        { status: 400 },
      );
    }

    if (workflowId) {
      const { data } = await github.octokit.rest.actions.listWorkflowRuns({
        owner,
        repo,
        workflow_id: workflowId,
        per_page: 50,
      });

      return NextResponse.json({ runs: data.workflow_runs ?? [] });
    }

    const { data } = await github.octokit.rest.actions.listWorkflowRunsForRepo({
      owner,
      repo,
      per_page: 50,
    });

    return NextResponse.json({ runs: data.workflow_runs ?? [] });
  } catch (error: any) {
    console.error("List workflow runs error:", error);
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

    if (sessionUser.role !== Role.SUPER_ADMIN) {
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
    const action = typeof body.action === "string" ? body.action.trim() : "";
    const runId = Number(body.runId);

    if (!owner || !repo || !action || !Number.isFinite(runId)) {
      return NextResponse.json(
        { error: "owner, repo, runId, and action are required" },
        { status: 400 },
      );
    }

    if (action === "rerun") {
      await github.octokit.rest.actions.reRunWorkflow({
        owner,
        repo,
        run_id: runId,
      });
      return NextResponse.json({ success: true });
    }

    if (action === "cancel") {
      await github.octokit.rest.actions.cancelWorkflowRun({
        owner,
        repo,
        run_id: runId,
      });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    console.error("Workflow run action error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to apply workflow run action" },
      { status: 500 },
    );
  }
}
