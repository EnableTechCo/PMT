import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { Role } from "@/lib/db-types";

type SentryInboxAlert = {
  uid: number;
  date: string;
  from: string;
  to: string;
  issueKey: string | null;
  errorTitle: string;
  errorMessage: string | null;
  level: string | null;
  sentryUrl: string | null;
  project: string | null;
  environment: string | null;
  culprit: string | null;
  eventId: string | null;
  alertRuleId: string | null;
  requestUrl: string | null;
  requestMethod: string | null;
  userIp: string | null;
  exceptionText: string | null;
  exceptionType: string | null;
  projectKey: string | null;
  details: string[];
  subject: string;
};

type ProjectSummary = {
  key: string;
  label: string;
  count: number;
};

function parseBoolean(value: string | undefined, fallback: boolean) {
  if (value === undefined) return fallback;
  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
}

function parseCsv(value: string | undefined, fallback: string) {
  return (value || fallback)
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

function decodeQuotedPrintable(input: string) {
  const joined = input.replace(/=\r?\n/g, "");
  return joined.replace(/=([A-Fa-f0-9]{2})/g, (_, hex: string) => {
    const code = Number.parseInt(hex, 16);
    return Number.isNaN(code) ? _ : String.fromCharCode(code);
  });
}

function stripHtml(input: string) {
  return input
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\r/g, "");
}

function normalizeEmailText(raw: string) {
  const decoded = decodeQuotedPrintable(raw);
  return stripHtml(decoded);
}

function getRequiredEnv(name: string) {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value.trim();
}

function formatAddressList(
  addresses:
    | Array<{ mailbox?: string; host?: string; name?: string }>
    | undefined,
) {
  if (!Array.isArray(addresses)) return "";

  return addresses
    .map((entry) => {
      const mailbox = entry.mailbox || "";
      const host = entry.host || "";
      const email = mailbox && host ? `${mailbox}@${host}` : "";
      const name = entry.name || "";
      return name && email ? `${name} <${email}>` : email || name;
    })
    .filter(Boolean)
    .join(", ");
}

function extractSentryUrl(raw: string) {
  const match = raw.match(/https?:\/\/[^\s<>"]*sentry\.io[^\s<>"]*/i);
  return match?.[0] || null;
}

function extractLevel(raw: string, subject: string) {
  const rawMatch = raw.match(
    /\blevel\s*[:=]\s*(fatal|error|warning|info|debug)\b/i,
  );
  if (rawMatch?.[1]) return rawMatch[1].toLowerCase();

  const subjectMatch = subject.match(/\b(fatal|error|warning|info|debug)\b/i);
  if (subjectMatch?.[1]) return subjectMatch[1].toLowerCase();

  return null;
}

function parseSubjectAlert(subject: string) {
  const trimmed = subject.trim();
  const issueMatch = trimmed.match(/^([A-Za-z0-9_-]+-\d+)\s*-\s*(.+)$/);
  const issueKey = issueMatch?.[1] || null;
  const remainder = issueMatch?.[2] || trimmed;

  const parts = remainder.split(":");
  if (parts.length >= 2) {
    const title = parts.shift()?.trim() || "Sentry alert";
    const message = parts.join(":").trim() || null;
    return { issueKey, errorTitle: title, errorMessage: message };
  }

  return {
    issueKey,
    errorTitle: remainder || "Sentry alert",
    errorMessage: null,
  };
}

function extractLabeledValue(text: string, label: string) {
  const pattern = new RegExp(`(?:^|\\n)\\s*${label}\\s*[:=-]\\s*(.+)$`, "im");
  const match = text.match(pattern);
  return match?.[1]?.trim() || null;
}

function extractSectionByHeading(text: string, heading: string) {
  const pattern = new RegExp(
    `(?:^|\\n)#+\\s*${heading}\\s*\\n([\\s\\S]*?)(?=\\n#{2,}\\s+|$)`,
    "i",
  );
  const match = text.match(pattern);
  return match?.[1]?.trim() || null;
}

function extractExceptionText(text: string) {
  const codeBlockMatch = text.match(/```([\s\S]*?)```/);
  if (codeBlockMatch?.[1]) {
    return codeBlockMatch[1].trim();
  }

  const exceptionSection = extractSectionByHeading(text, "Exception");
  if (exceptionSection) {
    return exceptionSection.trim();
  }

  return null;
}

function extractRequestUrl(text: string) {
  const direct = text.match(/\bURL\s*(https?:\/\/[^\s]+)/i);
  if (direct?.[1]) return direct[1].trim();

  const fallback = text.match(/https?:\/\/[^\s<>\"]+/i);
  return fallback?.[0] || null;
}

function extractRequestMethod(text: string) {
  const match = text.match(
    /\bMethod\s*(GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD)\b/i,
  );
  return match?.[1]?.toUpperCase() || null;
}

function extractUserIp(text: string) {
  const match = text.match(/\bIP Address\s*:?\s*([^\s]+)/i);
  return match?.[1]?.trim() || null;
}

function extractExceptionType(exceptionText: string | null) {
  if (!exceptionText) return null;
  const firstLine = exceptionText.split("\n")[0]?.trim() || "";
  const typeMatch = firstLine.match(/^([A-Za-z0-9_$.-]+)(?::|\s|$)/);
  return typeMatch?.[1] || null;
}

function normalizeProjectKey(value: string | null | undefined) {
  if (!value) return null;
  const cleaned = value.trim().toLowerCase();
  return cleaned.length > 0 ? cleaned : null;
}

function inferProjectFromIssueKey(issueKey: string | null) {
  if (!issueKey) return null;
  const match = issueKey.match(/^([A-Za-z][A-Za-z0-9_-]*)-/);
  return match?.[1] || null;
}

function parseSentryUrlMeta(sentryUrl: string | null) {
  if (!sentryUrl) {
    return {
      environment: null,
      alertRuleId: null,
    };
  }

  try {
    const url = new URL(sentryUrl);
    return {
      environment: url.searchParams.get("environment"),
      alertRuleId: url.searchParams.get("alert_rule_id"),
    };
  } catch {
    return {
      environment: null,
      alertRuleId: null,
    };
  }
}

function extractDetails(text: string, max = 8) {
  const blockedPrefixes = [
    "content-type:",
    "mime-version:",
    "content-transfer-encoding:",
    "return-path:",
    "dkim-signature:",
    "received:",
    "from:",
    "to:",
    "subject:",
    "date:",
  ];

  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .filter(
      (line) =>
        !blockedPrefixes.some((prefix) =>
          line.toLowerCase().startsWith(prefix),
        ),
    )
    .filter((line) => !line.startsWith("--"));

  const distinct: string[] = [];
  for (const line of lines) {
    if (distinct[distinct.length - 1] === line) continue;
    distinct.push(line);
    if (distinct.length >= max) break;
  }

  return distinct;
}

function isLikelySentryEmail(
  input: { from: string; to: string; subject: string; raw: string },
  rules: { fromPatterns: string[]; toPatterns: string[] },
) {
  const fromText = input.from.toLowerCase();
  const toText = input.to.toLowerCase();
  const subjectText = input.subject.toLowerCase();
  const rawText = input.raw.toLowerCase();

  const fromHit = rules.fromPatterns.some((pattern) =>
    fromText.includes(pattern),
  );
  const toHit = rules.toPatterns.some((pattern) => toText.includes(pattern));

  if (fromHit || toHit) {
    return true;
  }

  const subjectHit = subjectText.includes("sentry");
  const bodyHit = rawText.includes("sentry.io");
  return subjectHit && bodyHit;
}

async function scanSentryInbox(): Promise<{
  inbox: string;
  checkedAt: string;
  scannedCount: number;
  lookbackHours: number;
  foundCount: number;
  projects: ProjectSummary[];
  alerts: SentryInboxAlert[];
}> {
  const host = getRequiredEnv("SMTP_HOST");
  const user = getRequiredEnv("SMTP_USER");
  const pass = getRequiredEnv("SMTP_PASSWORD");

  const port = Number(process.env.IMAP_PORT || 993);
  const secure = parseBoolean(process.env.IMAP_SECURE, port === 993);
  const mailbox = process.env.MAILBOX || "INBOX";
  const lookbackHours = Number(process.env.SENTRY_INBOX_LOOKBACK_HOURS || 168);
  const maxMessages = Number(process.env.SENTRY_INBOX_MAX_MESSAGES || 300);
  const rejectUnauthorized = parseBoolean(
    process.env.IMAP_REJECT_UNAUTHORIZED,
    true,
  );

  const rules = {
    fromPatterns: parseCsv(
      process.env.SENTRY_ALERT_FROM_MATCH,
      "sentry.io,sentry",
    ),
    toPatterns: parseCsv(process.env.SENTRY_ALERT_TO_MATCH, "dev@sentry"),
  };

  const since = new Date(Date.now() - lookbackHours * 60 * 60 * 1000);

  const { ImapFlow } = (await import("imapflow")) as any;
  const client = new ImapFlow({
    host,
    port,
    secure,
    auth: { user, pass },
    logger: false,
    tls: { rejectUnauthorized },
  });

  await client.connect();

  let scannedCount = 0;
  const alerts: SentryInboxAlert[] = [];
  const lock = await client.getMailboxLock(mailbox);

  try {
    const uids = await client.search({ since });
    const selected = uids.slice(-Math.max(1, maxMessages));

    for await (const message of client.fetch(
      selected,
      {
        uid: true,
        envelope: true,
        internalDate: true,
        source: true,
      },
      { uid: true },
    )) {
      scannedCount += 1;
      const from = formatAddressList(message.envelope?.from);
      const to = formatAddressList(message.envelope?.to);
      const subject = message.envelope?.subject || "(No subject)";
      const raw = message.source
        ? message.source.toString("utf8").slice(0, 500000)
        : "";

      if (!isLikelySentryEmail({ from, to, subject, raw }, rules)) {
        continue;
      }

      const normalizedText = normalizeEmailText(raw);
      const parsed = parseSubjectAlert(subject);
      const sentryUrl = extractSentryUrl(raw);
      const urlMeta = parseSentryUrlMeta(sentryUrl);

      const project = extractLabeledValue(normalizedText, "project");
      const issueProject = inferProjectFromIssueKey(parsed.issueKey);
      const projectLabel = project || issueProject || null;
      const environmentFromBody = extractLabeledValue(
        normalizedText,
        "environment",
      );
      const culprit =
        extractLabeledValue(normalizedText, "culprit") ||
        extractLabeledValue(normalizedText, "transaction");
      const eventId = extractLabeledValue(normalizedText, "event id");
      const exceptionText = extractExceptionText(normalizedText);
      const requestUrl = extractRequestUrl(normalizedText);
      const requestMethod = extractRequestMethod(normalizedText);
      const userIp = extractUserIp(normalizedText);
      const details = extractDetails(normalizedText, 10);

      alerts.push({
        uid: message.uid,
        date: message.internalDate
          ? new Date(message.internalDate).toISOString()
          : "unknown",
        from,
        to,
        issueKey: parsed.issueKey,
        errorTitle: parsed.errorTitle,
        errorMessage: parsed.errorMessage,
        level: extractLevel(normalizedText, subject),
        sentryUrl,
        project: projectLabel,
        environment: environmentFromBody || urlMeta.environment,
        culprit,
        eventId,
        alertRuleId: urlMeta.alertRuleId,
        requestUrl,
        requestMethod,
        userIp,
        exceptionText,
        exceptionType: extractExceptionType(exceptionText),
        projectKey: normalizeProjectKey(projectLabel),
        details,
        subject,
      });
    }
  } finally {
    lock.release();
    await client.logout();
  }

  const sortedAlerts = alerts.sort((a, b) => {
    if (a.date === "unknown") return 1;
    if (b.date === "unknown") return -1;
    return new Date(b.date).getTime() - new Date(a.date).getTime();
  });

  const projectMap = new Map<string, ProjectSummary>();
  for (const alert of sortedAlerts) {
    const key = alert.projectKey || "unknown";
    const label = alert.project || "Unknown";
    const existing = projectMap.get(key);
    if (existing) {
      existing.count += 1;
      continue;
    }
    projectMap.set(key, { key, label, count: 1 });
  }

  const projects = Array.from(projectMap.values()).sort((a, b) =>
    a.label.localeCompare(b.label),
  );

  return {
    inbox: mailbox,
    checkedAt: new Date().toISOString(),
    scannedCount,
    lookbackHours,
    foundCount: sortedAlerts.length,
    projects,
    alerts: sortedAlerts,
  };
}

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (user.role !== Role.SUPER_ADMIN) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const result = await scanSentryInbox();

    const selectedProjectRaw =
      request.nextUrl.searchParams.get("project") || "all";
    const selectedProject = normalizeProjectKey(selectedProjectRaw) || "all";

    const filteredAlerts =
      selectedProject === "all"
        ? result.alerts
        : result.alerts.filter((alert) => alert.projectKey === selectedProject);

    return NextResponse.json({
      ok: true,
      ...result,
      selectedProject,
      foundCount: filteredAlerts.length,
      alerts: filteredAlerts,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Inbox scan failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
