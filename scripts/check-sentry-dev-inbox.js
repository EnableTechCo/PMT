const fs = require("fs");
const path = require("path");

function loadEnvFiles() {
  const root = process.cwd();
  const files = [".env.local", ".env"];

  for (const file of files) {
    const filePath = path.join(root, file);
    if (!fs.existsSync(filePath)) continue;
    const contents = fs.readFileSync(filePath, "utf8");

    for (const line of contents.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIndex = trimmed.indexOf("=");
      if (eqIndex <= 0) continue;

      const key = trimmed.slice(0, eqIndex).trim();
      let value = trimmed.slice(eqIndex + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }

      if (!(key in process.env)) {
        process.env[key] = value;
      }
    }
  }
}

function parseCsv(value, fallback = "") {
  return (value || fallback)
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

function parseBoolean(value, fallback) {
  if (value === undefined) return fallback;
  const normalized = String(value).trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
}

function getRequiredEnv(name) {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value.trim();
}

function formatAddressList(addresses) {
  if (!Array.isArray(addresses)) return "";

  return addresses
    .map((entry) => {
      if (!entry) return "";
      const mailbox = entry.mailbox || "";
      const host = entry.host || "";
      const email = mailbox && host ? `${mailbox}@${host}` : "";
      const name = entry.name || "";
      return name && email ? `${name} <${email}>` : email || name;
    })
    .filter(Boolean)
    .join(", ");
}

function isLikelySentryEmail({ from, to, subject, raw }, rules) {
  const fromText = from.toLowerCase();
  const toText = to.toLowerCase();
  const subjectText = subject.toLowerCase();
  const rawText = raw.toLowerCase();

  const fromHit = rules.fromPatterns.some((p) => fromText.includes(p));
  const toHit = rules.toPatterns.some((p) => toText.includes(p));

  if (fromHit || toHit) {
    return true;
  }

  const subjectHit = subjectText.includes("sentry");
  const bodyHit = rawText.includes("sentry.io");

  return subjectHit && bodyHit;
}

async function main() {
  loadEnvFiles();

  let ImapFlow;
  try {
    ({ ImapFlow } = require("imapflow"));
  } catch {
    throw new Error(
      "Missing dependency 'imapflow'. Install it with: pnpm add imapflow",
    );
  }

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
    keywordPatterns: parseCsv(
      process.env.SENTRY_ALERT_KEYWORDS,
      "sentry.io,sentry,exception,error alert,issue alert",
    ),
  };

  const since = new Date(Date.now() - lookbackHours * 60 * 60 * 1000);

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
  const matches = [];
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

      if (isLikelySentryEmail({ from, to, subject, raw }, rules)) {
        matches.push({
          uid: message.uid,
          date: message.internalDate
            ? new Date(message.internalDate).toISOString()
            : "unknown",
          from,
          to,
          subject,
        });
      }
    }
  } finally {
    lock.release();
    await client.logout();
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        inbox: mailbox,
        scannedCount,
        lookbackHours,
        sentryFound: matches.length > 0,
        foundCount: matches.length,
      },
      null,
      2,
    ),
  );

  if (matches.length === 0) {
    console.log("No Sentry emails found in the scanned window.");
    return;
  }

  console.log("Sentry emails found:");
  for (const item of matches.slice(0, 20)) {
    console.log(
      `- UID ${item.uid} | ${item.date} | FROM ${item.from} | TO ${item.to} | SUBJECT ${item.subject}`,
    );
  }

  if (matches.length > 20) {
    console.log(`...and ${matches.length - 20} more`);
  }
}

main().catch((error) => {
  console.error("Failed to check dev inbox for Sentry emails:", error.message);
  process.exit(1);
});
