export function resolveAppBaseUrl(requestUrl?: string): string {
  const envUrl =
    process.env.NEXT_PUBLIC_APP_URL?.trim() || process.env.APP_URL?.trim();

  if (envUrl) {
    return envUrl.replace(/\/$/, "");
  }

  if (requestUrl) {
    try {
      return new URL(requestUrl).origin;
    } catch {
      // Ignore malformed request URL and fall back to local development default.
    }
  }

  return "http://localhost:3000";
}
