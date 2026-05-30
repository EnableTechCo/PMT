import { db } from "@/lib/db";

export type BackupTableName =
  | "teams"
  | "users"
  | "clients"
  | "teamMemberships"
  | "portfolios"
  | "projects"
  | "milestones"
  | "tickets"
  | "ticketComments"
  | "ticketAttachments"
  | "ticketChecklistItems"
  | "ticketActivities"
  | "auditLogs"
  | "documents"
  | "automationRules"
  | "githubBranches"
  | "githubPullRequests"
  | "githubRepos"
  | "notifications"
  | "savedViews"
  | "organizationSettings"
  | "passwordResets"
  | "inviteTokens";

export type BackupSnapshot = {
  format: "pmt-backup";
  version: number;
  generatedAt: string;
  generatedBy: {
    userId: string;
    email: string;
    name: string;
  } | null;
  tableCounts: Record<BackupTableName, number>;
  tables: Record<BackupTableName, unknown[]>;
};

type BackupSelection = {
  orderBy: { createdAt: "asc" | "desc" };
};

export async function createBackupSnapshot(input: {
  generatedBy?: {
    userId: string;
    email: string;
    name: string;
  } | null;
} = {}): Promise<BackupSnapshot> {
  const selection: BackupSelection = { orderBy: { createdAt: "asc" } };

  const [
    teams,
    users,
    clients,
    teamMemberships,
    portfolios,
    projects,
    milestones,
    tickets,
    ticketComments,
    ticketAttachments,
    ticketChecklistItems,
    ticketActivities,
    auditLogs,
    documents,
    automationRules,
    githubBranches,
    githubPullRequests,
    githubRepos,
    notifications,
    savedViews,
    organizationSettings,
    passwordResets,
    inviteTokens,
  ] = await Promise.all([
    db.team.findMany(selection),
    db.user.findMany(selection),
    db.client.findMany(selection),
    db.teamMembership.findMany(selection),
    db.portfolio.findMany(selection),
    db.project.findMany(selection),
    db.milestone.findMany(selection),
    db.ticket.findMany(selection),
    db.ticketComment.findMany(selection),
    db.ticketAttachment.findMany(selection),
    db.ticketChecklistItem.findMany(selection),
    db.ticketActivity.findMany(selection),
    db.auditLog.findMany(selection),
    db.document.findMany(selection),
    db.automationRule.findMany(selection),
    db.githubBranch.findMany(selection),
    db.githubPullRequest.findMany(selection),
    db.githubRepo.findMany(selection),
    db.notification.findMany(selection),
    db.savedView.findMany(selection),
    db.organizationSettings.findMany(selection),
    db.passwordReset.findMany(selection),
    db.inviteToken.findMany(selection),
  ]);

  const tables = {
    teams,
    users,
    clients,
    teamMemberships,
    portfolios,
    projects,
    milestones,
    tickets,
    ticketComments,
    ticketAttachments,
    ticketChecklistItems,
    ticketActivities,
    auditLogs,
    documents,
    automationRules,
    githubBranches,
    githubPullRequests,
    githubRepos,
    notifications,
    savedViews,
    organizationSettings,
    passwordResets,
    inviteTokens,
  } satisfies Record<BackupTableName, unknown[]>;

  const tableCounts = Object.fromEntries(
    Object.entries(tables).map(([name, rows]) => [name, rows.length]),
  ) as Record<BackupTableName, number>;

  return {
    format: "pmt-backup",
    version: 1,
    generatedAt: new Date().toISOString(),
    generatedBy: input.generatedBy ?? null,
    tableCounts,
    tables,
  };
}