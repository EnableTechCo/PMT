/** @jest-environment node */

import { NextRequest } from "next/server";
import * as routeModule from "@/app/api/feedback/[id]/assign/route";

const params = { id: "feedback-1" };

describe("src/app/api/feedback/[id]/assign/route.ts", () => {
  it("PATCH returns an HTTP response object", async () => {
    const request = new NextRequest(
      "http://localhost/api/feedback/feedback-1/assign",
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignedToId: "user-1" }),
      },
    );

    const response = await Promise.resolve(
      routeModule.PATCH(request, { params: Promise.resolve(params) }),
    );
    expect(response).toBeInstanceOf(Response);
    expect(response.status).toBeGreaterThanOrEqual(100);
    expect(response.status).toBeLessThan(600);
  });
});
