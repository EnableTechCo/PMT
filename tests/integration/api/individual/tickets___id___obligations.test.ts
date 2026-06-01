/** @jest-environment node */

import { NextRequest } from "next/server";
import * as routeModule from "@/app/api/tickets/[id]/obligations/route";

const params = { id: "ticket-1" };

describe("src/app/api/tickets/[id]/obligations/route.ts", () => {
  it("GET returns an HTTP response object", async () => {
    const request = new NextRequest(
      "http://localhost/api/tickets/ticket-1/obligations",
      {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      },
    );

    const response = await Promise.resolve(
      routeModule.GET(request, { params: Promise.resolve(params) }),
    );
    expect(response).toBeInstanceOf(Response);
    expect(response.status).toBeGreaterThanOrEqual(100);
    expect(response.status).toBeLessThan(600);
  });

  it("POST returns an HTTP response object", async () => {
    const request = new NextRequest(
      "http://localhost/api/tickets/ticket-1/obligations",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Submit signed scope",
          dueAt: new Date().toISOString(),
        }),
      },
    );

    const response = await Promise.resolve(
      routeModule.POST(request, { params: Promise.resolve(params) }),
    );
    expect(response).toBeInstanceOf(Response);
    expect(response.status).toBeGreaterThanOrEqual(100);
    expect(response.status).toBeLessThan(600);
  });
});
