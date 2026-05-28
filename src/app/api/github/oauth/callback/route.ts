import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { Octokit } from "octokit";
import { updateUserGithubToken } from "@/lib/user-store";

const OAUTH_STATE_COOKIE = "github_oauth_state";

function redirectToSettings(request: NextRequest, status: string) {
  return NextResponse.redirect(
    new URL(`/settings?github=${status}`, request.url),
  );
}

export async function GET(request: NextRequest) {
  const sessionUser = await getUserFromRequest(request);
  if (!sessionUser) {
    return NextResponse.redirect(new URL("/auth/login", request.url));
  }

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const storedState = request.cookies.get(OAUTH_STATE_COOKIE)?.value;

  if (!code || !state || !storedState || state !== storedState) {
    const response = redirectToSettings(request, "oauth_state_invalid");
    response.cookies.set(OAUTH_STATE_COOKIE, "", {
      path: "/",
      maxAge: 0,
    });
    return response;
  }

  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    const response = redirectToSettings(request, "oauth_not_configured");
    response.cookies.set(OAUTH_STATE_COOKIE, "", {
      path: "/",
      maxAge: 0,
    });
    return response;
  }

  try {
    const tokenRes = await fetch(
      "https://github.com/login/oauth/access_token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          client_id: clientId,
          client_secret: clientSecret,
          code,
          state,
          redirect_uri: `${request.nextUrl.origin}/api/github/oauth/callback`,
        }),
      },
    );

    const tokenData = await tokenRes.json();
    const accessToken = tokenData?.access_token;
    if (!tokenRes.ok || !accessToken) {
      const response = redirectToSettings(request, "oauth_failed");
      response.cookies.set(OAUTH_STATE_COOKIE, "", {
        path: "/",
        maxAge: 0,
      });
      return response;
    }

    const octokit = new Octokit({ auth: accessToken });
    await octokit.rest.users.getAuthenticated();

    await updateUserGithubToken(sessionUser.id, accessToken);

    const response = redirectToSettings(request, "connected");
    response.cookies.set(OAUTH_STATE_COOKIE, "", {
      path: "/",
      maxAge: 0,
    });
    return response;
  } catch (error) {
    console.error("GitHub OAuth callback error:", error);
    const response = redirectToSettings(request, "oauth_failed");
    response.cookies.set(OAUTH_STATE_COOKIE, "", {
      path: "/",
      maxAge: 0,
    });
    return response;
  }
}
