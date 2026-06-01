export class Octokit {
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
      listPullRequestsAssociatedWithCommit: async () => ({ data: [] }),
    },
    actions: {
      listRepoWorkflows: async () => ({ data: { workflows: [] } }),
      listWorkflowRunsForRepo: async () => ({ data: { workflow_runs: [] } }),
      createWorkflowDispatch: async () => ({ data: {} }),
      reRunWorkflow: async () => ({ data: {} }),
      cancelWorkflowRun: async () => ({ data: {} }),
    },
  };

  constructor(_config?: unknown) {}
}
