import nodemailer from "nodemailer";
import { Resend } from "resend";

function parseBoolean(value: string | undefined, fallback: boolean) {
  if (value === undefined) return fallback;
  return value.toLowerCase() === "true";
}

type EmailProvider = "resend" | "smtp";

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
let resendClient: Resend | null = null;

function getEmailProvider(): EmailProvider {
  return process.env.RESEND_API_KEY ? "resend" : "smtp";
}

function getFromEmail() {
  if (getEmailProvider() === "resend") {
    return process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";
  }

  return process.env.SMTP_FROM_EMAIL || "dev@e-t.co.za";
}

function getFromName() {
  return (
    process.env.RESEND_FROM_NAME ||
    process.env.SMTP_FROM_NAME ||
    "Enable Project Management"
  );
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

function getResendClient() {
  if (!process.env.RESEND_API_KEY) {
    throw new Error("Resend configuration is incomplete. Set RESEND_API_KEY.");
  }

  if (!resendClient) {
    resendClient = new Resend(process.env.RESEND_API_KEY);
  }

  return resendClient;
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

    if (!process.env.RESEND_API_KEY) {
      missing.push("RESEND_API_KEY");
    }

    return {
      provider,
      configured: missing.length === 0,
      verified: missing.length === 0,
      verifyError: null,
      missing,
      fromEmail,
      fromName,
      host: null,
      port: null,
      secure: null,
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

async function sendEmail({ to, subject, html, text }: SendEmailArgs) {
  const fromEmail = getFromEmail();
  const fromName = getFromName();

  if (getEmailProvider() === "resend") {
    const resend = getResendClient();
    const result = await resend.emails.send({
      from: `${fromName} <${fromEmail}>`,
      to: [to],
      subject,
      html,
      text,
    });

    if (result.error) {
      throw new Error(
        result.error.message || "Failed to send email via Resend",
      );
    }

    console.log("✓ Resend email sent", {
      emailId: result.data?.id || null,
      recipientEmail: to,
      subject,
      fromEmail,
    });

    return {
      provider: "resend" as const,
      id: result.data?.id || null,
    };
  }

  const info = await getTransporter().sendMail({
    from: `${fromName} <${fromEmail}>`,
    to,
    subject,
    html,
    text,
  });

  console.log("✓ SMTP email sent", {
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
