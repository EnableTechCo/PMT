import { loadEnvConfig } from "@next/env";
import { sendTestEmail } from "../src/lib/email-service";

async function main() {
  loadEnvConfig(process.cwd());

  const recipientEmail = "ignatius@e-t.co.za";
  const recipientName = "Ignatius";

  console.log("Sending test email...", { recipientEmail });

  const result = await sendTestEmail(recipientEmail, recipientName);

  console.log("Test email sent.", {
    provider: result.provider,
    id: result.id,
  });
}

main().catch((error) => {
  console.error("Test email failed:", error);
  process.exitCode = 1;
});
