export function createOAuthUserAuth() {
  return async () => ({
    token: "mock-oauth-token",
  });
}
