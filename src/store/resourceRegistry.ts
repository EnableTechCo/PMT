export type ResourceDefinition = {
  key: string;
  label: string;
  endpointPattern: string;
  staleMs: number;
};

// Inventory of loading/fetch resources discovered across src/**/*.{ts,tsx}.
export const RESOURCE_REGISTRY: ResourceDefinition[] = [
  {
    key: "notifications",
    label: "Notifications feed",
    endpointPattern: "/api/notifications",
    staleMs: 30000,
  },
  {
    key: "dashboard_sprints",
    label: "Dashboard sprints",
    endpointPattern: "/api/sprints?teamId=*",
    staleMs: 60000,
  },
  {
    key: "dashboard_tickets",
    label: "Dashboard tickets",
    endpointPattern: "/api/tickets?*",
    staleMs: 30000,
  },
  {
    key: "workload_users",
    label: "Workload users",
    endpointPattern: "/api/workload/users",
    staleMs: 300000,
  },
  {
    key: "github_repos",
    label: "GitHub repositories",
    endpointPattern: "/api/github/repos",
    staleMs: 300000,
  },
  {
    key: "github_branches",
    label: "GitHub branches",
    endpointPattern: "/api/github/branches*",
    staleMs: 120000,
  },
  {
    key: "github_pull_requests",
    label: "GitHub pull requests",
    endpointPattern: "/api/github/pull-requests*",
    staleMs: 30000,
  },
  {
    key: "github_auth",
    label: "GitHub auth status",
    endpointPattern: "/api/github/auth*",
    staleMs: 300000,
  },
  {
    key: "tickets_list",
    label: "Tickets list",
    endpointPattern: "/api/tickets?*",
    staleMs: 30000,
  },
  {
    key: "ticket_detail",
    label: "Ticket details",
    endpointPattern: "/api/tickets/:id",
    staleMs: 30000,
  },
  {
    key: "ticket_obligations",
    label: "Ticket obligations",
    endpointPattern: "/api/tickets/:id/obligations",
    staleMs: 30000,
  },
  {
    key: "ticket_comments",
    label: "Ticket comments",
    endpointPattern: "/api/tickets/:id/comments",
    staleMs: 30000,
  },
  {
    key: "ticket_attachments",
    label: "Ticket attachments",
    endpointPattern: "/api/tickets/:id/attachments",
    staleMs: 30000,
  },
  {
    key: "ticket_members",
    label: "Team members for ticket",
    endpointPattern: "/api/teams/:teamId/members",
    staleMs: 300000,
  },
  {
    key: "ticket_sprints",
    label: "Team sprints for ticket",
    endpointPattern: "/api/sprints?teamId=*",
    staleMs: 60000,
  },
  {
    key: "settings_notification_prefs",
    label: "Notification preferences",
    endpointPattern: "/api/settings/notifications",
    staleMs: 300000,
  },
  {
    key: "settings_smtp_diagnostic",
    label: "SMTP diagnostics",
    endpointPattern: "/api/settings/smtp-diagnostic",
    staleMs: 60000,
  },
  {
    key: "settings_backups",
    label: "Backup history",
    endpointPattern: "/api/settings/backups*",
    staleMs: 60000,
  },
  {
    key: "settings_backup_export",
    label: "Backup export",
    endpointPattern: "/api/settings/backup*",
    staleMs: 0,
  },
  {
    key: "projects_list",
    label: "Projects list",
    endpointPattern: "/api/projects*",
    staleMs: 60000,
  },
  {
    key: "project_detail",
    label: "Project details",
    endpointPattern: "/api/projects/:id",
    staleMs: 60000,
  },
  {
    key: "project_tickets",
    label: "Project tickets",
    endpointPattern: "/api/tickets?projectId=*",
    staleMs: 30000,
  },
  {
    key: "clients_list",
    label: "Clients list",
    endpointPattern: "/api/clients",
    staleMs: 120000,
  },
  {
    key: "client_projects",
    label: "Client projects",
    endpointPattern: "/api/clients/:id/projects",
    staleMs: 60000,
  },
  {
    key: "teams_list",
    label: "Teams list",
    endpointPattern: "/api/teams",
    staleMs: 300000,
  },
  {
    key: "docs_list",
    label: "Docs list",
    endpointPattern: "/api/docs",
    staleMs: 60000,
  },
  {
    key: "doc_detail",
    label: "Doc detail",
    endpointPattern: "/api/docs/:id",
    staleMs: 60000,
  },
  {
    key: "feedback_list",
    label: "Feedback list",
    endpointPattern: "/api/feedback?*",
    staleMs: 30000,
  },
  {
    key: "monitoring_overview",
    label: "Monitoring overview",
    endpointPattern: "/api/monitoring/overview",
    staleMs: 30000,
  },
  {
    key: "monitoring_inbox",
    label: "Sentry inbox",
    endpointPattern: "/api/monitoring/sentry-inbox*",
    staleMs: 30000,
  },
  {
    key: "github_workflows",
    label: "GitHub workflows",
    endpointPattern: "/api/github/workflows",
    staleMs: 60000,
  },
  {
    key: "github_workflow_runs",
    label: "GitHub workflow runs",
    endpointPattern: "/api/github/workflows/runs",
    staleMs: 30000,
  },
  {
    key: "analytics_executive",
    label: "Executive analytics",
    endpointPattern: "/api/analytics/executive*",
    staleMs: 60000,
  },
  {
    key: "auth_me",
    label: "Current user",
    endpointPattern: "/api/auth/me",
    staleMs: 300000,
  },
  {
    key: "client_dashboard_projects",
    label: "Client dashboard projects",
    endpointPattern: "/api/client/projects",
    staleMs: 60000,
  },
  {
    key: "sprints_page",
    label: "Sprints page data",
    endpointPattern: "/api/sprints*",
    staleMs: 60000,
  },
  {
    key: "admin_invite",
    label: "Admin invite",
    endpointPattern: "/api/admin/invite",
    staleMs: 0,
  },
];
