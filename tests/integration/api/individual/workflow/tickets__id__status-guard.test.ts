/** @jest-environment node */

import { NextRequest } from "next/server";
import { PATCH } from "@/app/api/tickets/[id]/route";
import { getUserFromRequest } from "@/lib/auth";
import { canAccessTeam, getUserWithTeamAccess } from "@/lib/access";

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
    ticket: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
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

const { db } = jest.requireMock("@/lib/db") as {
  db: {
    ticket: {
      findUnique: jest.Mock;
      update: jest.Mock;
    };
  };
};

describe("Ticket status guardrails", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getUserFromRequestMock.mockResolvedValue({ id: "user-1" } as any);
    getUserWithTeamAccessMock.mockResolvedValue({
      id: "user-1",
      role: "USER",
    } as any);
    canAccessTeamMock.mockReturnValue(true);
  });

  it("rejects COMPLETE when ticket is not in QA", async () => {
    db.ticket.findUnique.mockResolvedValue({
      id: "ticket-1",
      title: "Test",
      status: "IN_REVIEW",
      assigneeId: "user-2",
      teamId: "team-1",
    });

    const request = new NextRequest("http://localhost/api/tickets/ticket-1", {
      method: "PATCH",
      body: JSON.stringify({ status: "COMPLETE" }),
      headers: { "Content-Type": "application/json" },
    });

    const response = await PATCH(request, {
      params: Promise.resolve({ id: "ticket-1" }),
    });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toMatch(/Only tickets in QA/i);
    expect(db.ticket.update).not.toHaveBeenCalled();
  });

  it("rejects assignee completing QA ticket", async () => {
    db.ticket.findUnique.mockResolvedValue({
      id: "ticket-1",
      title: "Test",
      status: "QA",
      assigneeId: "user-1",
      teamId: "team-1",
    });

    const request = new NextRequest("http://localhost/api/tickets/ticket-1", {
      method: "PATCH",
      body: JSON.stringify({ status: "COMPLETE" }),
      headers: { "Content-Type": "application/json" },
    });

    const response = await PATCH(request, {
      params: Promise.resolve({ id: "ticket-1" }),
    });
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toMatch(/Assignees cannot mark tickets Complete/i);
    expect(db.ticket.update).not.toHaveBeenCalled();
  });
});
