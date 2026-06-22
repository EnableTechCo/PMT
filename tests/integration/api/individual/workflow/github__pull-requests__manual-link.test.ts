/** @jest-environment node */

import { NextRequest } from "next/server";
import { POST } from "@/app/api/github/pull-requests/route";
import { getUserFromRequest } from "@/lib/auth";
import { createNotification } from "@/lib/ticketActivity";

jest.mock("@/lib/auth", () => ({
  getUserFromRequest: jest.fn(),
}));

jest.mock("@/lib/ticketActivity", () => ({
  createNotification: jest.fn(),
}));

jest.mock("@/lib/github", () => ({
  getGithubClient: jest.fn(),
}));

jest.mock("@/lib/db", () => ({
  db: {
    ticket: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    githubPullRequest: {
      upsert: jest.fn(),
    },
    ticketActivity: {
      create: jest.fn(),
    },
  },
}));

const getUserFromRequestMock = getUserFromRequest as jest.MockedFunction<
  typeof getUserFromRequest
>;
const createNotificationMock = createNotification as jest.MockedFunction<
  typeof createNotification
>;

const { db } = jest.requireMock("@/lib/db") as {
  db: {
    ticket: {
      findUnique: jest.Mock;
      update: jest.Mock;
    };
    githubPullRequest: {
      upsert: jest.Mock;
    };
    ticketActivity: {
      create: jest.Mock;
    };
  };
};

describe("Manual PR link guardrails", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getUserFromRequestMock.mockResolvedValue({ id: "actor-1" } as any);

    db.ticket.findUnique.mockResolvedValue({
      id: "ticket-1",
      title: "Completed ticket",
      status: "COMPLETE",
      creatorId: "creator-1",
      assigneeId: "assignee-1",
    });

    db.githubPullRequest.upsert.mockResolvedValue({ id: "pr-link-1" });
  });

  it("does not auto-reopen COMPLETE ticket to IN_REVIEW when linking open PR manually", async () => {
    const request = new NextRequest(
      "http://localhost/api/github/pull-requests",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticketId: "ticket-1",
          title: "Open PR",
          number: 22,
          url: "https://github.com/org/repo/pull/22",
          state: "open",
        }),
      },
    );

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(db.ticket.update).not.toHaveBeenCalled();
    expect(db.ticketActivity.create).not.toHaveBeenCalled();
    expect(createNotificationMock).not.toHaveBeenCalled();
  });
});
