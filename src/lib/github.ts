import { Octokit } from "octokit";
import { findUserById } from "@/lib/user-store";

export type GithubAuthSource = "system" | "user";

export interface GithubAuthContext {
  token: string;
  source: GithubAuthSource;
}

const SHARED_TOKEN_ENV_KEYS = [
  "GITHUB_TOKEN",
  "GITHUB_ACCESS_TOKEN",
  "GITHUB_PAT",
] as const;

export function getSharedGithubToken() {
  for (const key of SHARED_TOKEN_ENV_KEYS) {
    const value = process.env[key]?.trim();
    if (value) return value;
  }

  return null;
}

export async function getGithubAuthContext(userId?: string | null) {
  const sharedToken = getSharedGithubToken();
  if (sharedToken) {
    return {
      token: sharedToken,
      source: "system",
    } satisfies GithubAuthContext;
  }

  if (!userId) {
    return null;
  }

  const user = await findUserById(userId);

  if (!user?.githubToken) {
    return null;
  }

  return {
    token: user.githubToken,
    source: "user",
  } satisfies GithubAuthContext;
}

export async function getGithubClient(userId?: string | null) {
  const auth = await getGithubAuthContext(userId);
  if (!auth) return null;

  return {
    auth,
    octokit: new Octokit({ auth: auth.token }),
  };
}
