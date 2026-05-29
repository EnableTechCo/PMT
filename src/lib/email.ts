import nodemailer from "nodemailer";

function parseBoolean(value: string | undefined, fallback: boolean) {
  if (value === undefined) return fallback;
  return value.toLowerCase() === "true";
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

export async function getSmtpDiagnostics() {
  const missing: string[] = [];

  if (!process.env.SMTP_HOST) missing.push("SMTP_HOST");
  if (!process.env.SMTP_USER) missing.push("SMTP_USER");
  if (!process.env.SMTP_PASSWORD) missing.push("SMTP_PASSWORD");

  const diagnostics = {
    host: process.env.SMTP_HOST || null,
    port: smtpPort,
    secure: smtpSecure,
    hasUser: Boolean(process.env.SMTP_USER),
    hasPassword: Boolean(process.env.SMTP_PASSWORD),
    configured: missing.length === 0,
    missing,
    verified: false,
    verifyError: null as string | null,
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

export async function verifyEmailService(): Promise<boolean> {
  try {
    const transporter = getTransporter();
    await transporter.verify();
    console.log("✓ Email service connected successfully");
    return true;
  } catch (error) {
    console.error("✗ Email service connection failed:", error);
    return false;
  }
}

export async function sendTestEmail(
  recipientEmail: string,
  recipientName: string,
) {
  const transporter = getTransporter();
  const fromEmail = process.env.SMTP_FROM_EMAIL || "dev@e-t.co.za";
  const fromName = process.env.SMTP_FROM_NAME || "Enable Project Management";

  const subject = "Enable Project Management email test";
  const text = `Hi ${recipientName}, this is a test email from Enable Project Management. If you received this, SMTP is working.`;

  try {
    const info = await transporter.sendMail({
      from: `${fromName} <${fromEmail}>`,
      to: recipientEmail,
      subject,
      text,
      html: `<p>Hi ${recipientName},</p><p>This is a test email from <strong>Enable Project Management</strong>.</p><p>If you received this, SMTP is working.</p>`,
    });

    console.log("✓ Test email sent:", info.messageId, {
      recipientEmail,
      recipientName,
    });

    return info;
  } catch (error) {
    console.error("✗ Failed to send test email:", error, {
      recipientEmail,
      recipientName,
    });
    throw error;
  }
}

export async function sendAdminInviteEmail(
  recipientEmail: string,
  inviteToken: string,
  recipientName: string,
  teamName?: string,
  invitePath: string = "/auth/invite?token=",
) {
  const inviteLink = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}${invitePath}${inviteToken}`;
  const transporter = getTransporter();
  const fromEmail = process.env.SMTP_FROM_EMAIL || "dev@e-t.co.za";
  const fromName = process.env.SMTP_FROM_NAME || "Enable Project Management";

  // Try to load the standalone HTML template from public/email-templates
  let htmlContent: string | null = null;
  try {
    const fs = await import("fs/promises");
    const path = await import("path");
    const templatePath = path.join(
      process.cwd(),
      "public",
      "email-templates",
      "invite.html",
    );
    let template = await fs.readFile(templatePath, "utf8");
    template = template.replace(
      /<!--\s*RECIPIENT_NAME\s*-->/g,
      recipientName || "",
    );
    template = template.replace(/<!--\s*INVITE_LINK\s*-->/g, inviteLink);
    template = template.replace(/<!--\s*TEAM_NAME\s*-->/g, teamName || "");
    htmlContent = template;
  } catch (err) {
    console.warn(
      "Invite template not found or failed to load, falling back to inline template:",
      err,
    );
  }

  if (!htmlContent) {
    htmlContent = `Hi ${recipientName}, you have been invited to join Enable. Accept here: ${inviteLink}`;
  }

  try {
    const info = await transporter.sendMail({
      from: `${fromName} <${fromEmail}>`,
      to: recipientEmail,
      subject: "You've been invited to join Enable Project Management",
      html: htmlContent,
      text: `You've been invited to join Enable Project Management. Visit: ${inviteLink}`,
    });
    console.log("✓ Invite email sent:", info.messageId);
    return info;
  } catch (error) {
    if (canUseDevEmailFallback(error)) {
      console.warn(
        "⚠ Invite email fallback enabled (development mode):",
        error,
      );
      console.log("Invite link:", inviteLink);
      return { messageId: "dev-fallback-invite" };
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
  const transporter = getTransporter();
  const fromEmail = process.env.SMTP_FROM_EMAIL || "dev@e-t.co.za";
  const fromName = process.env.SMTP_FROM_NAME || "Enable Project Management";

  let htmlContent: string | null = null;
  try {
    const fs = await import("fs/promises");
    const path = await import("path");
    const templatePath = path.join(
      process.cwd(),
      "public",
      "email-templates",
      "reset-password.html",
    );
    let template = await fs.readFile(templatePath, "utf8");
    template = template.replace(
      /<!--\s*RECIPIENT_NAME\s*-->/g,
      recipientName || "",
    );
    template = template.replace(/<!--\s*RESET_LINK\s*-->/g, resetLink);
    htmlContent = template;
  } catch (err) {
    console.warn(
      "Reset password template not found or failed to load, falling back to inline template:",
      err,
    );
  }

  if (!htmlContent) {
    htmlContent = `Hi ${recipientName}, reset your password here: ${resetLink}`;
  }

  try {
    const info = await transporter.sendMail({
      from: `${fromName} <${fromEmail}>`,
      to: recipientEmail,
      subject: "Reset your Enable Project Management password",
      html: htmlContent,
      text: `Reset your password: ${resetLink}`,
    });
    console.log("✓ Password reset email sent:", info.messageId);
    return info;
  } catch (error) {
    if (canUseDevEmailFallback(error)) {
      console.warn(
        "⚠ Password reset email fallback enabled (development mode):",
        error,
      );
      console.log("Password reset link:", resetLink);
      return { messageId: "dev-fallback-reset" };
    }
    console.error("✗ Failed to send password reset email:", error);
    throw error;
  }
}
