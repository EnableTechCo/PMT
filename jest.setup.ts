import "@testing-library/jest-dom";

// Stable defaults so server-side modules can be imported in tests.
process.env.NEXT_PUBLIC_SUPABASE_URL ??= "https://example.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= "ci_dummy_anon_key";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "ci_dummy_service_role_key";
process.env.DATABASE_URL ??=
  "postgresql://postgres:postgres@localhost:5432/postgres";
process.env.JWT_SECRET ??= "ci_dummy_jwt_secret";
process.env.NEXT_PUBLIC_APP_URL ??= "http://localhost:3000";
process.env.RESEND_API_KEY ??= "re_dummy_key";

jest.mock("octokit", () => ({
  Octokit: class Octokit {
    rest = {
      users: {
        getAuthenticated: async () => ({
          data: {
            login: "mock-user",
            avatar_url: "https://example.com/avatar.png",
          },
        }),
      },
      repos: {
        listForAuthenticatedUser: async () => ({ data: [] }),
        get: async () => ({ data: {} }),
        listBranches: async () => ({ data: [] }),
      },
      pulls: {
        list: async () => ({ data: [] }),
      },
      actions: {
        listRepoWorkflows: async () => ({ data: { workflows: [] } }),
        listWorkflowRunsForRepo: async () => ({ data: { workflow_runs: [] } }),
        createWorkflowDispatch: async () => ({ data: {} }),
        reRunWorkflow: async () => ({ data: {} }),
        cancelWorkflowRun: async () => ({ data: {} }),
      },
    };
  },
}));

jest.mock("@octokit/auth-oauth-user", () => ({
  createOAuthUserAuth: () => async () => ({
    token: "mock-oauth-token",
  }),
}));
