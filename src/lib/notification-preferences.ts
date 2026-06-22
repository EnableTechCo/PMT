export type NotificationPreferenceKey =
  | "ticketWorkflow"
  | "codeReview"
  | "systemReleases"
  | "monitoringAlerts"
  | "clientFeedback";

export type NotificationPreferences = Record<
  NotificationPreferenceKey,
  boolean
>;

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  ticketWorkflow: true,
  codeReview: true,
  systemReleases: true,
  monitoringAlerts: true,
  clientFeedback: true,
};

const TICKET_WORKFLOW_TYPES = new Set([
  "ASSIGNMENT",
  "COMMENT",
  "CHECKLIST",
  "ATTACHMENT",
  "CLIENT_OBLIGATION",
  "TICKET_COMPLETED",
  "CREATED",
  "REPO_CONTEXT_INHERITED",
  "GITHUB_REPO_CONTEXT",
]);

function resolvePreferenceKey(type: string): NotificationPreferenceKey | null {
  if (typeof type !== "string") return null;
  const normalized = type.trim().toUpperCase();
  if (!normalized) return null;

  if (normalized.startsWith("MONITORING_")) return "monitoringAlerts";
  if (
    normalized.startsWith("SYSTEM_") ||
    normalized === "DEPLOYMENT_SUCCEEDED"
  ) {
    return "systemReleases";
  }
  if (normalized.startsWith("PR_") || normalized.startsWith("GH_")) {
    return "codeReview";
  }
  if (normalized === "CLIENT_FEEDBACK") return "clientFeedback";
  if (TICKET_WORKFLOW_TYPES.has(normalized)) return "ticketWorkflow";

  return null;
}

export function normalizeNotificationPreferences(
  value: unknown,
): NotificationPreferences {
  const parsed =
    typeof value === "object" && value !== null
      ? (value as Partial<NotificationPreferences>)
      : {};

  return {
    ...DEFAULT_NOTIFICATION_PREFERENCES,
    ...parsed,
  };
}

export function shouldDisplayNotification(
  type: string,
  preferences: NotificationPreferences,
): boolean {
  const key = resolvePreferenceKey(type);
  if (!key) return true;
  return preferences[key];
}
