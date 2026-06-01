/** @jest-environment node */

import { NextRequest } from "next/server";
import { GET, POST } from "@/app/api/tickets/route";
import { getUserFromRequest } from "@/lib/auth";
import { getUserWithTeamAccess, canAccessTeam } from "@/lib/access";

jest.mock("@/lib/auth", () => ({
  getUserFromRequest: jest.fn(),
}));

jest.mock("@/lib/access", () => ({
  canAccessTeam: jest.fn(),
  getClientRecordForUser: jest.fn(),
  getUserWithTeamAccess: jest.fn(),
  teamIdsForUser: jest.fn(),
}));

jest.mock("@/lib/db", () => ({
  db: {
    ticket: { findMany: jest.fn() },
    client: { findUnique: jest.fn() },
    project: { findUnique: jest.fn() },
  },
}));

jest.mock("@/lib/audit", () => ({
  writeAuditLog: jest.fn(),
}));

jest.mock("@/lib/ticketActivity", () => ({
  createNotification: jest.fn(),
  logTicketActivity: jest.fn(),
}));

const getUserFromRequestMock = getUserFromRequest as jest.MockedFunction<
  typeof getUserFromRequest
>;
const getUserWithTeamAccessMock = getUserWithTeamAccess as jest.MockedFunction<
  typeof getUserWithTeamAccess
>;
const canAccessTeamMock = canAccessTeam as jest.MockedFunction<
  typeof canAccessTeam
>;

describe("Tickets route behavior", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("GET /api/tickets returns 401 without session", async () => {
    getUserFromRequestMock.mockResolvedValue(null);

    const request = new NextRequest("http://localhost/api/tickets", {
      method: "GET",
    });
    const response = await GET(request);

    expect(response.status).toBe(401);
  });

  it("GET /api/tickets returns 400 for USER without teamId", async () => {
    getUserFromRequestMock.mockResolvedValue({ id: "u-1" } as any);
    getUserWithTeamAccessMock.mockResolvedValue({
      id: "u-1",
      role: "USER",
    } as any);

    const request = new NextRequest("http://localhost/api/tickets", {
      method: "GET",
    });
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toMatch(/teamId is required/i);
  });

  it("POST /api/tickets returns 403 for CLIENT role", async () => {
    getUserFromRequestMock.mockResolvedValue({ id: "u-client" } as any);
    getUserWithTeamAccessMock.mockResolvedValue({
      id: "u-client",
      role: "CLIENT",
    } as any);

    const request = new NextRequest("http://localhost/api/tickets", {
      method: "POST",
      body: JSON.stringify({ title: "Should fail" }),
      headers: { "Content-Type": "application/json" },
    });

    const response = await POST(request);
    expect(response.status).toBe(403);
  });

  it("POST /api/tickets validates title", async () => {
    getUserFromRequestMock.mockResolvedValue({ id: "u-1" } as any);
    getUserWithTeamAccessMock.mockResolvedValue({
      id: "u-1",
      role: "USER",
      teamMemberships: [{ teamId: "team-1" }],
    } as any);
    canAccessTeamMock.mockReturnValue(true);

    const request = new NextRequest("http://localhost/api/tickets", {
      method: "POST",
      body: JSON.stringify({ title: "   ", teamId: "team-1" }),
      headers: { "Content-Type": "application/json" },
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toMatch(/Title is required/i);
  });

  it("POST /api/tickets validates team membership", async () => {
    getUserFromRequestMock.mockResolvedValue({ id: "u-1" } as any);
    getUserWithTeamAccessMock.mockResolvedValue({
      id: "u-1",
      role: "USER",
    } as any);
    canAccessTeamMock.mockReturnValue(false);

    const request = new NextRequest("http://localhost/api/tickets", {
      method: "POST",
      body: JSON.stringify({ title: "Valid", teamId: "team-x" }),
      headers: { "Content-Type": "application/json" },
    });

    const response = await POST(request);
    expect(response.status).toBe(403);
  });
});
