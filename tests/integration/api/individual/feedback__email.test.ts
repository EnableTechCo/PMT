/** @jest-environment node */

import { NextRequest } from "next/server";
import * as routeModule from "@/app/api/feedback/email/route";

describe("src/app/api/feedback/email/route.ts", () => {
  it("POST returns an HTTP response object", async () => {
    const request = new NextRequest("http://localhost/api/feedback/email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-feedback-secret": "invalid",
      },
      body: JSON.stringify({
        from: "client@example.com",
        subject: "Feedback",
        text: "Need updates",
      }),
    });

    const response = await Promise.resolve(routeModule.POST(request));
    expect(response).toBeInstanceOf(Response);
    expect(response.status).toBeGreaterThanOrEqual(100);
    expect(response.status).toBeLessThan(600);
  });
});
