/** @jest-environment node */

import { NextRequest } from "next/server";
import * as routeModule from "@/app/api/tickets/[id]/obligations/[obligationId]/route";

const params = { id: "ticket-1", obligationId: "obl-1" };

describe("src/app/api/tickets/[id]/obligations/[obligationId]/route.ts", () => {
  it("PATCH returns an HTTP response object", async () => {
    const request = new NextRequest(
      "http://localhost/api/tickets/ticket-1/obligations/obl-1",
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "SUBMITTED" }),
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
