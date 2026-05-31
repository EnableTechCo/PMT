import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { Octokit } from "octokit";
import { getGithubClient, getSharedGithubToken } from "@/lib/github";
import { updateUserGithubToken } from "@/lib/user-store";

export async function POST(request: NextRequest) {
  try {
    const sessionUser = await getUserFromRequest(request);
    if (!sessionUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { token } = await request.json();
    if (!token || typeof token !== "string") {
      return NextResponse.json({ error: "Token is required" }, { status: 400 });
    }

    // Validate the token
    const octokit = new Octokit({ auth: token });
    let githubUser;
    try {
      const { data } = await octokit.rest.users.getAuthenticated();
      githubUser = data;
    } catch (_e: any) {
      return NextResponse.json(
        { error: "Invalid GitHub token. Please ensure it has the repo scope." },
        { status: 401 },
      );
    }

    // Save to DB
    await updateUserGithubToken(sessionUser.id, token);

    return NextResponse.json({
      success: true,
      githubUser: { login: githubUser.login, avatarUrl: githubUser.avatar_url },
    });
  } catch (error) {
    console.error("Save GitHub token error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const sessionUser = await getUserFromRequest(request);
    if (!sessionUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (getSharedGithubToken()) {
      return NextResponse.json(
        {
          error:
            "GitHub access is department-managed and cannot be disconnected per user.",
        },
        { status: 400 },
      );
    }

    await updateUserGithubToken(sessionUser.id, null);

    return NextResponse.json({ success: true });
  } catch (_error) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const sessionUser = await getUserFromRequest(request);
    if (!sessionUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const github = await getGithubClient(sessionUser.id);
    if (!github) {
      return NextResponse.json({ connected: false });
    }

    try {
      const { data } = await github.octokit.rest.users.getAuthenticated();
      return NextResponse.json({
        connected: true,
        source: github.auth.source,
        githubUser: {
          login: data.login,
          avatarUrl: data.avatar_url,
        },
      });
    } catch (_e) {
      if (github.auth.source === "user") {
        await updateUserGithubToken(sessionUser.id, null);
      }

      return NextResponse.json({ connected: false });
    }
  } catch (_error) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
