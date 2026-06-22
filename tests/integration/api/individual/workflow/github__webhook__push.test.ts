/** @jest-environment node */

import { NextRequest } from "next/server";
import { POST } from "@/app/api/github/webhook/route";
import { createNotification } from "@/lib/ticketActivity";

jest.mock("@/lib/ticketActivity", () => ({
  createNotification: jest.fn(),
}));

jest.mock("@/lib/github", () => ({
  getSharedGithubToken: jest.fn(() => null),
}));

jest.mock("@/lib/db", () => ({
  db: {
    ticket: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    githubPullRequest: {
      findMany: jest.fn(),
      upsert: jest.fn(),
    },
    ticketActivity: {
      create: jest.fn(),
    },
    notification: {
      findFirst: jest.fn(),
    },
    teamMembership: {
      findMany: jest.fn(),
    },
    user: {
      findMany: jest.fn(),
    },
  },
}));

const createNotificationMock = createNotification as jest.MockedFunction<
  typeof createNotification
>;

const { db } = jest.requireMock("@/lib/db") as {
  db: {
    ticket: {
      findFirst: jest.Mock;
      update: jest.Mock;
    };
    ticketActivity: {
      create: jest.Mock;
    };
  };
};

describe("GitHub webhook push workflow", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    db.ticket.findFirst.mockResolvedValue({
      id: "ticket-1",
      status: "REVISIONS",
      creatorId: "creator-1",
      assigneeId: "assignee-1",
      teamId: "team-1",
    });
  });

  it("moves REVISIONS back to IN_REVIEW on push and emits no notifications", async () => {
    const payload = {
      ref: "refs/heads/feat/10123-revision-fixes",
      commits: [{ id: "c1" }, { id: "c2" }],
      pusher: { name: "dev-user" },
    };

    const request = new NextRequest("http://localhost/api/github/webhook", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-github-event": "push",
      },
      body: JSON.stringify(payload),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.statusMappedTo).toBe("IN_REVIEW");
    expect(db.ticket.update).toHaveBeenCalledWith({
      where: { id: "ticket-1" },
      data: { status: "IN_REVIEW" },
    });
    expect(createNotificationMock).not.toHaveBeenCalled();
  });
});
