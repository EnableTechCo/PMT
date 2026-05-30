import { db } from "@/lib/db";

export const BACKUP_TABLE_NAMES = [
  "teams",
  "users",
  "clients",
  "teamMemberships",
  "portfolios",
  "projects",
  "milestones",
  "tickets",
  "ticketComments",
  "ticketAttachments",
  "ticketChecklistItems",
  "ticketActivities",
  "auditLogs",
  "documents",
  "automationRules",
  "githubBranches",
  "githubPullRequests",
  "githubRepos",
  "notifications",
  "savedViews",
  "organizationSettings",
  "passwordResets",
  "inviteTokens",
] as const;

export type BackupTableName = (typeof BACKUP_TABLE_NAMES)[number];

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

export type BackupRecord = {
  id: string;
  label: string;
  triggerType: string;
  generatedAt: string;
  generatedById: string | null;
  generatedByEmail: string | null;
  generatedByName: string | null;
  restoredAt: string | null;
  restoredById: string | null;
  tableCounts: Record<BackupTableName, number>;
  snapshot: BackupSnapshot;
  createdAt: string;
};

type BackupSelection = {
  orderBy: { createdAt: "asc" | "desc" };
};

type BackupMeta = {
  triggerType: string;
  label?: string;
  generatedBy?: {
    userId: string;
    email: string;
    name: string;
  } | null;
};

const BACKUP_SELECTION: BackupSelection = { orderBy: { createdAt: "asc" } };

const BACKUP_DELETE_ORDER: Array<keyof typeof deleteTargets> = [];

const deleteTargets = {
  inviteTokens: db.inviteToken,
  passwordResets: db.passwordReset,
  savedViews: db.savedView,
  notifications: db.notification,
  githubRepos: db.githubRepo,
  githubPullRequests: db.githubPullRequest,
  githubBranches: db.githubBranch,
  automationRules: db.automationRule,
  documents: db.document,
  auditLogs: db.auditLog,
  ticketActivities: db.ticketActivity,
  ticketChecklistItems: db.ticketChecklistItem,
  ticketAttachments: db.ticketAttachment,
  ticketComments: db.ticketComment,
  tickets: db.ticket,
  milestones: db.milestone,
  projects: db.project,
  portfolios: db.portfolio,
  teamMemberships: db.teamMembership,
  users: db.user,
  clients: db.client,
  teams: db.team,
  organizationSettings: db.organizationSettings,
} as const;

const createTargets = {
  teams: db.team,
  users: db.user,
  clients: db.client,
  teamMemberships: db.teamMembership,
  portfolios: db.portfolio,
  projects: db.project,
  milestones: db.milestone,
  tickets: db.ticket,
  ticketComments: db.ticketComment,
  ticketAttachments: db.ticketAttachment,
  ticketChecklistItems: db.ticketChecklistItem,
  ticketActivities: db.ticketActivity,
  auditLogs: db.auditLog,
  documents: db.document,
  automationRules: db.automationRule,
  githubBranches: db.githubBranch,
  githubPullRequests: db.githubPullRequest,
  githubRepos: db.githubRepo,
  notifications: db.notification,
  savedViews: db.savedView,
  organizationSettings: db.organizationSettings,
  passwordResets: db.passwordReset,
  inviteTokens: db.inviteToken,
} as const;

function safeJsonParse<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function labelForBackup(triggerType: string, generatedAt: string) {
  return `${triggerType.replace(/_/g, " ")} ${generatedAt}`;
}

function sanitizeRow<T extends Record<string, unknown>>(row: T): T {
  return JSON.parse(JSON.stringify(row)) as T;
}

export async function createBackupSnapshot(
  input: {
    generatedBy?: {
      userId: string;
      email: string;
      name: string;
    } | null;
  } = {},
): Promise<BackupSnapshot> {
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
    db.team.findMany(BACKUP_SELECTION),
    db.user.findMany(BACKUP_SELECTION),
    db.client.findMany(BACKUP_SELECTION),
    db.teamMembership.findMany(BACKUP_SELECTION),
    db.portfolio.findMany(BACKUP_SELECTION),
    db.project.findMany(BACKUP_SELECTION),
    db.milestone.findMany(BACKUP_SELECTION),
    db.ticket.findMany(BACKUP_SELECTION),
    db.ticketComment.findMany(BACKUP_SELECTION),
    db.ticketAttachment.findMany(BACKUP_SELECTION),
    db.ticketChecklistItem.findMany(BACKUP_SELECTION),
    db.ticketActivity.findMany(BACKUP_SELECTION),
    db.auditLog.findMany(BACKUP_SELECTION),
    db.document.findMany(BACKUP_SELECTION),
    db.automationRule.findMany(BACKUP_SELECTION),
    db.githubBranch.findMany(BACKUP_SELECTION),
    db.githubPullRequest.findMany(BACKUP_SELECTION),
    db.githubRepo.findMany(BACKUP_SELECTION),
    db.notification.findMany(BACKUP_SELECTION),
    db.savedView.findMany(BACKUP_SELECTION),
    db.organizationSettings.findMany(BACKUP_SELECTION),
    db.passwordReset.findMany(BACKUP_SELECTION),
    db.inviteToken.findMany(BACKUP_SELECTION),
  ]);

  const tables = {
    teams: teams.map(sanitizeRow),
    users: users.map(sanitizeRow),
    clients: clients.map(sanitizeRow),
    teamMemberships: teamMemberships.map(sanitizeRow),
    portfolios: portfolios.map(sanitizeRow),
    projects: projects.map(sanitizeRow),
    milestones: milestones.map(sanitizeRow),
    tickets: tickets.map(sanitizeRow),
    ticketComments: ticketComments.map(sanitizeRow),
    ticketAttachments: ticketAttachments.map(sanitizeRow),
    ticketChecklistItems: ticketChecklistItems.map(sanitizeRow),
    ticketActivities: ticketActivities.map(sanitizeRow),
    auditLogs: auditLogs.map(sanitizeRow),
    documents: documents.map(sanitizeRow),
    automationRules: automationRules.map(sanitizeRow),
    githubBranches: githubBranches.map(sanitizeRow),
    githubPullRequests: githubPullRequests.map(sanitizeRow),
    githubRepos: githubRepos.map(sanitizeRow),
    notifications: notifications.map(sanitizeRow),
    savedViews: savedViews.map(sanitizeRow),
    organizationSettings: organizationSettings.map(sanitizeRow),
    passwordResets: passwordResets.map(sanitizeRow),
    inviteTokens: inviteTokens.map(sanitizeRow),
  } satisfies Record<BackupTableName, unknown[]>;

  const tableCounts = Object.fromEntries(
    Object.entries(tables).map(([name, rows]) => [name, rows.length]),
  ) as Record<BackupTableName, number>;

  return {
    format: "pmt-backup",
    version: 2,
    generatedAt: new Date().toISOString(),
    generatedBy: input.generatedBy ?? null,
    tableCounts,
    tables,
  };
}

export async function persistBackupSnapshot(
  snapshot: BackupSnapshot,
  meta: BackupMeta,
) {
  return db.backupSnapshot.create({
    data: {
      label:
        meta.label || labelForBackup(meta.triggerType, snapshot.generatedAt),
      triggerType: meta.triggerType,
      generatedAt: snapshot.generatedAt,
      generatedById: meta.generatedBy?.userId ?? null,
      generatedByEmail: meta.generatedBy?.email ?? null,
      generatedByName: meta.generatedBy?.name ?? null,
      snapshot: JSON.stringify(snapshot),
      tableCounts: JSON.stringify(snapshot.tableCounts),
    },
  });
}

export async function createAndStoreBackupSnapshot(meta: BackupMeta) {
  const snapshot = await createBackupSnapshot({
    generatedBy: meta.generatedBy ?? null,
  });
  const record = await persistBackupSnapshot(snapshot, meta);
  return { snapshot, record };
}

export async function listBackupRecords(take = 20): Promise<BackupRecord[]> {
  const rows = await db.backupSnapshot.findMany({
    orderBy: { createdAt: "desc" },
    take,
  });

  return rows.map((row: any) => ({
    id: row.id,
    label: row.label,
    triggerType: row.triggerType,
    generatedAt: row.generatedAt,
    generatedById: row.generatedById ?? null,
    generatedByEmail: row.generatedByEmail ?? null,
    generatedByName: row.generatedByName ?? null,
    restoredAt: row.restoredAt ?? null,
    restoredById: row.restoredById ?? null,
    tableCounts: safeJsonParse<Record<BackupTableName, number>>(
      row.tableCounts,
      {
        teams: 0,
        users: 0,
        clients: 0,
        teamMemberships: 0,
        portfolios: 0,
        projects: 0,
        milestones: 0,
        tickets: 0,
        ticketComments: 0,
        ticketAttachments: 0,
        ticketChecklistItems: 0,
        ticketActivities: 0,
        auditLogs: 0,
        documents: 0,
        automationRules: 0,
        githubBranches: 0,
        githubPullRequests: 0,
        githubRepos: 0,
        notifications: 0,
        savedViews: 0,
        organizationSettings: 0,
        passwordResets: 0,
        inviteTokens: 0,
      },
    ),
    snapshot: safeJsonParse<BackupSnapshot>(row.snapshot, {
      format: "pmt-backup",
      version: 2,
      generatedAt: row.generatedAt,
      generatedBy: null,
      tableCounts: {
        teams: 0,
        users: 0,
        clients: 0,
        teamMemberships: 0,
        portfolios: 0,
        projects: 0,
        milestones: 0,
        tickets: 0,
        ticketComments: 0,
        ticketAttachments: 0,
        ticketChecklistItems: 0,
        ticketActivities: 0,
        auditLogs: 0,
        documents: 0,
        automationRules: 0,
        githubBranches: 0,
        githubPullRequests: 0,
        githubRepos: 0,
        notifications: 0,
        savedViews: 0,
        organizationSettings: 0,
        passwordResets: 0,
        inviteTokens: 0,
      },
      tables: Object.fromEntries(
        BACKUP_TABLE_NAMES.map((name) => [name, []]),
      ) as Record<BackupTableName, unknown[]>,
    }),
    createdAt: row.createdAt,
  }));
}

export async function loadBackupRecordById(
  id: string,
): Promise<BackupRecord | null> {
  const row: any = await db.backupSnapshot.findUnique({
    where: { id },
  });

  if (!row) return null;

  return {
    id: row.id,
    label: row.label,
    triggerType: row.triggerType,
    generatedAt: row.generatedAt,
    generatedById: row.generatedById ?? null,
    generatedByEmail: row.generatedByEmail ?? null,
    generatedByName: row.generatedByName ?? null,
    restoredAt: row.restoredAt ?? null,
    restoredById: row.restoredById ?? null,
    tableCounts: safeJsonParse<Record<BackupTableName, number>>(
      row.tableCounts,
      {
        teams: 0,
        users: 0,
        clients: 0,
        teamMemberships: 0,
        portfolios: 0,
        projects: 0,
        milestones: 0,
        tickets: 0,
        ticketComments: 0,
        ticketAttachments: 0,
        ticketChecklistItems: 0,
        ticketActivities: 0,
        auditLogs: 0,
        documents: 0,
        automationRules: 0,
        githubBranches: 0,
        githubPullRequests: 0,
        githubRepos: 0,
        notifications: 0,
        savedViews: 0,
        organizationSettings: 0,
        passwordResets: 0,
        inviteTokens: 0,
      },
    ),
    snapshot: safeJsonParse<BackupSnapshot>(row.snapshot, {
      format: "pmt-backup",
      version: 2,
      generatedAt: row.generatedAt,
      generatedBy: null,
      tableCounts: {
        teams: 0,
        users: 0,
        clients: 0,
        teamMemberships: 0,
        portfolios: 0,
        projects: 0,
        milestones: 0,
        tickets: 0,
        ticketComments: 0,
        ticketAttachments: 0,
        ticketChecklistItems: 0,
        ticketActivities: 0,
        auditLogs: 0,
        documents: 0,
        automationRules: 0,
        githubBranches: 0,
        githubPullRequests: 0,
        githubRepos: 0,
        notifications: 0,
        savedViews: 0,
        organizationSettings: 0,
        passwordResets: 0,
        inviteTokens: 0,
      },
      tables: Object.fromEntries(
        BACKUP_TABLE_NAMES.map((name) => [name, []]),
      ) as Record<BackupTableName, unknown[]>,
    }),
    createdAt: row.createdAt,
  };
}

async function clearRestoreTargets() {
  await db.inviteToken.deleteMany({ where: {} });
  await db.passwordReset.deleteMany({ where: {} });
  await db.savedView.deleteMany({ where: {} });
  await db.notification.deleteMany({ where: {} });
  await db.githubRepo.deleteMany({ where: {} });
  await db.githubPullRequest.deleteMany({ where: {} });
  await db.githubBranch.deleteMany({ where: {} });
  await db.automationRule.deleteMany({ where: {} });
  await db.document.deleteMany({ where: {} });
  await db.auditLog.deleteMany({ where: {} });
  await db.ticketActivity.deleteMany({ where: {} });
  await db.ticketChecklistItem.deleteMany({ where: {} });
  await db.ticketAttachment.deleteMany({ where: {} });
  await db.ticketComment.deleteMany({ where: {} });
  await db.ticket.deleteMany({ where: {} });
  await db.milestone.deleteMany({ where: {} });
  await db.project.deleteMany({ where: {} });
  await db.portfolio.deleteMany({ where: {} });
  await db.teamMembership.deleteMany({ where: {} });
  await db.user.deleteMany({ where: {} });
  await db.client.deleteMany({ where: {} });
  await db.team.deleteMany({ where: {} });
  await db.organizationSettings.deleteMany({ where: {} });
}

async function insertRows(tableName: BackupTableName, rows: unknown[]) {
  const target = createTargets[tableName] as {
    create: (params: { data: unknown }) => Promise<unknown>;
  };

  for (const row of rows) {
    await target.create({ data: sanitizeRow(row as Record<string, unknown>) });
  }
}

export async function restoreBackupSnapshot(snapshot: BackupSnapshot) {
  await clearRestoreTargets();

  for (const tableName of BACKUP_TABLE_NAMES) {
    const rows = snapshot.tables[tableName] ?? [];
    await insertRows(tableName, rows);
  }
}

export function emptyBackupTableCounts(): Record<BackupTableName, number> {
  return BACKUP_TABLE_NAMES.reduce(
    (counts, name) => {
      counts[name] = 0;
      return counts;
    },
    {} as Record<BackupTableName, number>,
  );
}
