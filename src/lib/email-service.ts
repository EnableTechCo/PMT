import nodemailer from "nodemailer";
import { Resend } from "resend";

function parseBoolean(value: string | undefined, fallback: boolean) {
  if (value === undefined) return fallback;
  return value.toLowerCase() === "true";
}

type EmailProvider = "smtp" | "resend";

type Diagnostics = {
  provider: EmailProvider;
  configured: boolean;
  verified: boolean;
  verifyError: string | null;
  missing: string[];
  fromEmail: string;
  fromName: string;
  host: string | null;
  port: number | null;
  secure: boolean | null;
  hasUser: boolean;
  hasPassword: boolean;
  hasApiKey: boolean;
};

type SendEmailArgs = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

function hasResendCredentials() {
  return Boolean(process.env.RESEND_API_KEY);
}

const smtpPort = parseInt(process.env.SMTP_PORT || "465", 10);
const smtpSecure = parseBoolean(process.env.SMTP_SECURE, smtpPort === 465);

const smtpConfig = {
  host: process.env.SMTP_HOST,
  port: smtpPort,
  secure: smtpSecure,
  connectionTimeout: 10000,
  greetingTimeout: 10000,
  socketTimeout: 15000,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD,
  },
};

let transporter: nodemailer.Transporter | null = null;

function normalizeProvider(value: string | undefined): EmailProvider | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === "smtp") return "smtp";
  if (normalized === "resend") return "resend";
  return null;
}

function getEmailProvider(): EmailProvider {
  const explicit = normalizeProvider(process.env.EMAIL_PROVIDER);
  if (explicit) return explicit;

  if (hasResendCredentials()) return "resend";
  return "smtp";
}

function getFromEmail() {
  if (getEmailProvider() === "resend") {
    const fromEmail = process.env.RESEND_FROM_EMAIL?.trim();
    if (!fromEmail) {
      throw new Error("Resend is selected but RESEND_FROM_EMAIL is not set.");
    }

    if (
      process.env.NODE_ENV === "production" &&
      fromEmail.toLowerCase().endsWith("@resend.dev")
    ) {
      throw new Error(
        "RESEND_FROM_EMAIL cannot use @resend.dev in production. Use an address from your verified domain.",
      );
    }

    return fromEmail;
  }

  return (
    process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER || "dev@e-t.co.za"
  );
}

function getFromName() {
  if (getEmailProvider() === "resend") {
    return (
      process.env.RESEND_FROM_NAME ||
      process.env.SMTP_FROM_NAME ||
      "Enable Project Management"
    );
  }

  return process.env.SMTP_FROM_NAME || "Enable Project Management";
}

function buildInviteLink(inviteToken: string, invitePathOrUrl: string) {
  if (/^https?:\/\//i.test(invitePathOrUrl)) {
    return invitePathOrUrl;
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  if (invitePathOrUrl.includes("{token}")) {
    return `${baseUrl}${invitePathOrUrl.replace("{token}", inviteToken)}`;
  }

  return `${baseUrl}${invitePathOrUrl}${inviteToken}`;
}

function getTransporter() {
  if (!transporter) {
    if (
      !process.env.SMTP_HOST ||
      !process.env.SMTP_USER ||
      !process.env.SMTP_PASSWORD
    ) {
      throw new Error(
        "SMTP configuration is incomplete. Set SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, and SMTP_PASSWORD.",
      );
    }

    transporter = nodemailer.createTransport(smtpConfig);
  }

  return transporter;
}

export async function getEmailDiagnostics(): Promise<Diagnostics> {
  const provider = getEmailProvider();
  const fromEmail = getFromEmail();
  const fromName = getFromName();

  if (provider === "resend") {
    const missing: string[] = [];

    if (!process.env.RESEND_API_KEY) missing.push("RESEND_API_KEY");
    if (!process.env.RESEND_FROM_EMAIL) {
      missing.push("RESEND_FROM_EMAIL");
    }

    return {
      provider,
      configured: missing.length === 0,
      verified: missing.length === 0,
      verifyError: null,
      missing,
      fromEmail,
      fromName,
      host: "api.resend.com",
      port: null,
      secure: true,
      hasUser: false,
      hasPassword: false,
      hasApiKey: Boolean(process.env.RESEND_API_KEY),
    };
  }

  const missing: string[] = [];

  if (!process.env.SMTP_HOST) missing.push("SMTP_HOST");
  if (!process.env.SMTP_USER) missing.push("SMTP_USER");
  if (!process.env.SMTP_PASSWORD) missing.push("SMTP_PASSWORD");

  const diagnostics: Diagnostics = {
    provider,
    configured: missing.length === 0,
    verified: false,
    verifyError: null,
    missing,
    fromEmail,
    fromName,
    host: process.env.SMTP_HOST || null,
    port: smtpPort,
    secure: smtpSecure,
    hasUser: Boolean(process.env.SMTP_USER),
    hasPassword: Boolean(process.env.SMTP_PASSWORD),
    hasApiKey: false,
  };

  if (!diagnostics.configured) {
    return diagnostics;
  }

  try {
    await getTransporter().verify();
    diagnostics.verified = true;
    console.log("✓ SMTP diagnostics verified", {
      host: diagnostics.host,
      port: diagnostics.port,
      secure: diagnostics.secure,
      hasUser: diagnostics.hasUser,
    });
  } catch (error) {
    diagnostics.verifyError =
      error instanceof Error ? error.message : "SMTP verification failed";
    console.error("✗ SMTP diagnostics verify failed:", error, {
      host: diagnostics.host,
      port: diagnostics.port,
      secure: diagnostics.secure,
      hasUser: diagnostics.hasUser,
    });
  }

  return diagnostics;
}

function canUseDevEmailFallback(error: unknown) {
  if (process.env.NODE_ENV === "production") return false;
  if (!(error instanceof Error)) return true;

  const err = error as Error & { code?: string };
  return (
    err.code === "EAUTH" ||
    err.code === "ECONNECTION" ||
    err.code === "ETIMEDOUT"
  );
}

async function sendViaSmtp({
  to,
  subject,
  html,
  text,
  fromEmail,
  fromName,
}: SendEmailArgs & { fromEmail: string; fromName: string }) {
  const info = await getTransporter().sendMail({
    from: `${fromName} <${fromEmail}>`,
    to,
    subject,
    html,
    text,
  });

  console.log("SMTP email sent", {
    messageId: info.messageId,
    recipientEmail: to,
    subject,
    fromEmail,
  });

  return {
    provider: "smtp" as const,
    id: info.messageId,
  };
}

async function sendViaResend({
  to,
  subject,
  html,
  text,
  fromEmail,
  fromName,
}: SendEmailArgs & { fromEmail: string; fromName: string }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("Resend is not configured. Set RESEND_API_KEY.");
  }

  const resend = new Resend(apiKey);
  const from = `${fromName} <${fromEmail}>`;
  const { data, error } = await resend.emails.send({
    from,
    to: [to],
    subject,
    html,
    text,
  });

  if (error) {
    throw new Error(error.message || "Resend send failed");
  }

  console.log("Resend email sent", {
    id: data?.id ?? null,
    recipientEmail: to,
    subject,
    fromEmail,
  });

  return {
    provider: "resend" as const,
    id: data?.id ?? null,
  };
}

async function sendEmail({ to, subject, html, text }: SendEmailArgs) {
  const provider = getEmailProvider();
  const fromEmail = getFromEmail();
  const fromName = getFromName();

  if (provider === "resend") {
    return sendViaResend({
      to,
      subject,
      html,
      text,
      fromEmail,
      fromName,
    });
  }

  return sendViaSmtp({
    to,
    subject,
    html,
    text,
    fromEmail,
    fromName,
  });
}

async function loadTemplate(
  templateName: string,
  replacements: Record<string, string>,
) {
  try {
    const fs = await import("fs/promises");
    const path = await import("path");
    const templatePath = path.join(
      process.cwd(),
      "public",
      "email-templates",
      templateName,
    );
    let template = await fs.readFile(templatePath, "utf8");

    for (const [token, value] of Object.entries(replacements)) {
      template = template.replace(
        new RegExp(`<!--\\s*${token}\\s*-->`, "g"),
        value,
      );
    }

    return template;
  } catch (error) {
    console.warn(
      "Email template load failed, falling back to inline content:",
      {
        templateName,
        error,
      },
    );
    return null;
  }
}

export async function verifyEmailService(): Promise<boolean> {
  try {
    const diagnostics = await getEmailDiagnostics();
    console.log("✓ Email service diagnostics", diagnostics);
    return diagnostics.configured && diagnostics.verified;
  } catch (error) {
    console.error("✗ Email service connection failed:", error);
    return false;
  }
}

export async function sendTestEmail(
  recipientEmail: string,
  recipientName: string,
) {
  const subject = "Enable Project Management email test";
  const text = `Hi ${recipientName}, this is a test email from Enable Project Management. If you received this, email delivery is working.`;
  const html = `<p>Hi ${recipientName},</p><p>This is a test email from <strong>Enable Project Management</strong>.</p><p>If you received this, email delivery is working.</p>`;

  try {
    return await sendEmail({
      to: recipientEmail,
      subject,
      text,
      html,
    });
  } catch (error) {
    console.error("✗ Failed to send test email:", error, {
      recipientEmail,
      recipientName,
      provider: getEmailProvider(),
    });
    throw error;
  }
}

export async function sendAdminInviteEmail(
  recipientEmail: string,
  inviteToken: string,
  recipientName: string,
  teamName?: string,
  invitePathOrUrl: string = "/auth/invite?token=",
) {
  const inviteLink = buildInviteLink(inviteToken, invitePathOrUrl);

  let htmlContent = await loadTemplate("invite.html", {
    RECIPIENT_NAME: recipientName || "",
    INVITE_LINK: inviteLink,
    TEAM_NAME: teamName || "",
  });

  if (!htmlContent) {
    htmlContent = `Hi ${recipientName}, you have been invited to join Enable. Accept here: ${inviteLink}`;
  }

  try {
    return await sendEmail({
      to: recipientEmail,
      subject: "You've been invited to join Enable Project Management",
      html: htmlContent,
      text: `You've been invited to join Enable Project Management. Visit: ${inviteLink}`,
    });
  } catch (error) {
    if (getEmailProvider() === "smtp" && canUseDevEmailFallback(error)) {
      console.warn(
        "⚠ Invite email fallback enabled (development mode):",
        error,
      );
      console.log("Invite link:", inviteLink);
      return { provider: "smtp" as const, id: "dev-fallback-invite" };
    }

    console.error("✗ Failed to send invite email:", error);
    throw error;
  }
}

export async function sendPasswordResetEmail(
  recipientEmail: string,
  resetToken: string,
  recipientName: string,
  teamName?: string,
) {
  const resetLink = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/auth/reset-password?token=${resetToken}`;

  let htmlContent = await loadTemplate("reset-password.html", {
    RECIPIENT_NAME: recipientName || "",
    RESET_LINK: resetLink,
    TEAM_NAME: teamName || "",
  });

  if (!htmlContent) {
    htmlContent = `Hi ${recipientName}, reset your password here: ${resetLink}`;
  }

  try {
    return await sendEmail({
      to: recipientEmail,
      subject: "Reset your Enable Project Management password",
      html: htmlContent,
      text: `Reset your password: ${resetLink}`,
    });
  } catch (error) {
    if (getEmailProvider() === "smtp" && canUseDevEmailFallback(error)) {
      console.warn(
        "⚠ Password reset email fallback enabled (development mode):",
        error,
      );
      console.log("Password reset link:", resetLink);
      return { provider: "smtp" as const, id: "dev-fallback-reset" };
    }

    console.error("✗ Failed to send password reset email:", error);
    throw error;
  }
}
