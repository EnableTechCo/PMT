import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createNotification } from "@/lib/ticketActivity";

function isReadyForReview(action: string, draft: boolean | undefined) {
  if (action === "ready_for_review") return true;
  if (action === "opened") return draft === false;
  if (action === "synchronize") return draft === false;
  return false;
}

export async function POST(request: NextRequest) {
  try {
    const event = request.headers.get("x-github-event") || "";
    if (event !== "pull_request") {
      return NextResponse.json({ ok: true, ignored: true });
    }

    const body = (await request.json()) as {
      action?: string;
      pull_request?: {
        draft?: boolean;
        title?: string;
        html_url?: string;
        number?: number;
        state?: string;
      };
    };

    const action = typeof body.action === "string" ? body.action : "";
    const pr = body.pull_request;

    if (!pr || typeof pr.number !== "number") {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    if (!isReadyForReview(action, pr.draft)) {
      return NextResponse.json({ ok: true, ignored: true });
    }

    const linkedPullRequests = await db.githubPullRequest.findMany({
      where: { number: pr.number },
      select: {
        ticketId: true,
        ticket: {
          select: {
            creatorId: true,
            assigneeId: true,
          },
        },
      },
    });

    let created = 0;
    for (const linked of linkedPullRequests) {
      const targets = new Set<string>();
      if (linked.ticket.creatorId) targets.add(linked.ticket.creatorId);
      if (linked.ticket.assigneeId) targets.add(linked.ticket.assigneeId);

      for (const userId of targets) {
        const title = `PR ready for review: ${pr.title || `#${pr.number}`}`;
        const body = pr.html_url || "";
        const existing = await db.notification.findFirst({
          where: {
            userId,
            type: "PR_READY_FOR_REVIEW",
            title,
            body: body || null,
            ticketId: linked.ticketId,
          },
          select: { id: true },
        });

        if (existing) continue;

        await createNotification({
          userId,
          type: "PR_READY_FOR_REVIEW",
          title,
          body: body || undefined,
          ticketId: linked.ticketId,
        });
        created += 1;
      }
    }

    return NextResponse.json({ ok: true, created });
  } catch (error) {
    console.error("GitHub webhook error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
