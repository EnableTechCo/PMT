import { createHmac, timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { Octokit } from "octokit";
import { db } from "@/lib/db";
import { createNotification } from "@/lib/ticketActivity";
import { TicketStatus } from "@/lib/db-types";
import { getSharedGithubToken } from "@/lib/github";
import { parseSelectorIdFromBranch } from "@/lib/ticket-selector";

type LinkedTicket = {
  id: string;
  status: string;
  creatorId: string;
  assigneeId: string | null;
  teamId: string | null;
};

const CHECK_PASSING = new Set(["success", "neutral", "skipped"]);

function trimSummary(input: unknown, max = 180) {
  const text = typeof input === "string" ? input.trim() : "";
  if (!text) return "";
  return text.length > max ? `${text.slice(0, max - 1)}...` : text;
}

function getGithubSignature(rawBody: string, secret: string) {
  const digest = createHmac("sha256", secret).update(rawBody).digest("hex");
  return `sha256=${digest}`;
}

function verifyWebhookSignature(rawBody: string, signatureHeader: string) {
  const secret = process.env.GITHUB_WEBHOOK_SECRET?.trim();
  if (!secret) return true;
  if (!signatureHeader) return false;

  const expected = getGithubSignature(rawBody, secret);
  const expectedBuffer = Buffer.from(expected, "utf8");
  const providedBuffer = Buffer.from(signatureHeader, "utf8");

  if (expectedBuffer.length !== providedBuffer.length) return false;
  return timingSafeEqual(expectedBuffer, providedBuffer);
}

async function notifyIfMissing(input: {
  userId: string;
  type: string;
  title: string;
  body?: string;
  ticketId?: string;
}) {
  const existing = await db.notification.findFirst({
    where: {
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body ?? null,
      ticketId: input.ticketId ?? null,
    },
    select: { id: true },
  });

  if (existing) return;
  await createNotification(input);
}

async function loadLinkedTicketsByPrNumber(prNumber: number) {
  const rows = await db.githubPullRequest.findMany({
    where: { number: prNumber },
    select: {
      ticketId: true,
      ticket: {
        select: {
          id: true,
          status: true,
          creatorId: true,
          assigneeId: true,
          teamId: true,
        },
      },
    },
  });

  const tickets = new Map<string, LinkedTicket>();
  for (const row of rows as Array<{ ticket: LinkedTicket; ticketId: string }>) {
    if (!row.ticket?.id) continue;
    tickets.set(row.ticket.id, row.ticket);
  }

  return Array.from(tickets.values());
}

async function upsertPullRequestLink(input: {
  ticketId: string;
  prNumber: number;
  prTitle: string;
  prUrl: string;
  prState: string;
}) {
  await db.githubPullRequest.upsert({
    where: {
      ticketId_number: {
        ticketId: input.ticketId,
        number: input.prNumber,
      },
    },
    update: {
      title: input.prTitle,
      url: input.prUrl,
      state: input.prState,
    },
    create: {
      ticketId: input.ticketId,
      title: input.prTitle,
      number: input.prNumber,
      url: input.prUrl,
      state: input.prState,
    },
  });
}

async function resolveTicketBySelector(selectorId: number | null) {
  if (selectorId === null) return null;
  return db.ticket.findFirst({
    where: { selectorId },
    select: {
      id: true,
      status: true,
      creatorId: true,
      assigneeId: true,
      teamId: true,
    },
  });
}

async function logGithubActivity(input: {
  ticketId: string;
  actorId: string;
  type: string;
  summary: string;
  metadata?: Record<string, unknown>;
}) {
  await db.ticketActivity.create({
    data: {
      ticketId: input.ticketId,
      actorId: input.actorId,
      type: input.type,
      summary: input.summary,
      metadata: input.metadata ? JSON.stringify(input.metadata) : undefined,
    },
  });
}

async function updateTicketStatusIfChanged(
  ticket: LinkedTicket,
  nextStatus: string | null,
  summary: string,
  metadata?: Record<string, unknown>,
) {
  if (!nextStatus || ticket.status === nextStatus) return;

  await db.ticket.update({
    where: { id: ticket.id },
    data: { status: nextStatus },
  });

  await logGithubActivity({
    ticketId: ticket.id,
    actorId: ticket.creatorId,
    type: "STATUS_CHANGE",
    summary,
    metadata,
  });
}

function statusForPullRequestEvent(action: string, merged: boolean) {
  if (merged) return TicketStatus.QA;
  if (
    ["opened", "review_requested", "ready_for_review", "synchronize"].includes(
      action,
    )
  ) {
    return TicketStatus.IN_REVIEW;
  }
  return null;
}

function getOctokitForWebhook() {
  const token = getSharedGithubToken();
  if (!token) return null;
  return new Octokit({ auth: token });
}

async function fetchCheckSummary(input: {
  owner: string;
  repo: string;
  ref: string;
}) {
  const octokit = getOctokitForWebhook();
  if (!octokit) {
    return { allGreen: false, failing: [], pending: [] };
  }

  const { data } = await octokit.rest.checks.listForRef({
    owner: input.owner,
    repo: input.repo,
    ref: input.ref,
    per_page: 100,
  });

  const runs = data.check_runs ?? [];
  const failing = runs
    .filter(
      (run) =>
        run.status === "completed" &&
        !CHECK_PASSING.has((run.conclusion || "").toLowerCase()),
    )
    .map((run) => ({
      name: run.name,
      conclusion: run.conclusion,
      url: run.html_url,
    }));

  const pending = runs
    .filter((run) => run.status !== "completed")
    .map((run) => ({ name: run.name, status: run.status, url: run.html_url }));

  const allGreen =
    runs.length > 0 && failing.length === 0 && pending.length === 0;
  return { allGreen, failing, pending };
}

async function fetchReviewThreadCounts(input: {
  owner: string;
  repo: string;
  number: number;
}) {
  const octokit = getOctokitForWebhook();
  if (!octokit) return null;

  const data = await octokit.graphql<{
    repository: {
      pullRequest: { reviewThreads: { nodes: Array<{ isResolved: boolean }> } };
    };
  }>(
    `query($owner: String!, $repo: String!, $number: Int!) {
      repository(owner: $owner, name: $repo) {
        pullRequest(number: $number) {
          reviewThreads(first: 100) {
            nodes {
              isResolved
            }
          }
        }
      }
    }`,
    {
      owner: input.owner,
      repo: input.repo,
      number: input.number,
    },
  );

  const nodes = data.repository?.pullRequest?.reviewThreads?.nodes ?? [];
  const resolved = nodes.filter((node) => node.isResolved).length;
  const unresolved = nodes.length - resolved;
  return { total: nodes.length, resolved, unresolved };
}

async function notifyAssignee(
  ticket: LinkedTicket,
  input: { type: string; title: string; body?: string },
) {
  if (!ticket.assigneeId) return;
  await notifyIfMissing({
    userId: ticket.assigneeId,
    type: input.type,
    title: input.title,
    body: input.body,
    ticketId: ticket.id,
  });
}

async function notifyQa(
  ticket: LinkedTicket,
  input: { type: string; title: string; body?: string },
) {
  if (!ticket.teamId) return;

  const memberships = await db.teamMembership.findMany({
    where: { teamId: ticket.teamId },
    select: { userId: true },
  });

  const qaUsers = await db.user.findMany({
    where: {
      id: { in: memberships.map((membership: any) => membership.userId) },
      role: { in: ["USER", "SUPER_ADMIN"] },
    },
    select: { id: true },
  });

  for (const qaUser of qaUsers as Array<{ id: string }>) {
    if (qaUser.id === ticket.assigneeId) continue;
    await notifyIfMissing({
      userId: qaUser.id,
      type: input.type,
      title: input.title,
      body: input.body,
      ticketId: ticket.id,
    });
  }
}

async function _notifyPm(
  ticket: LinkedTicket,
  input: { type: string; title: string; body?: string },
) {
  const pmUsers = await db.user.findMany({
    where: { role: "SUPER_ADMIN" },
    select: { id: true },
  });

  for (const pmUser of pmUsers as Array<{ id: string }>) {
    await notifyIfMissing({
      userId: pmUser.id,
      type: input.type,
      title: input.title,
      body: input.body,
      ticketId: ticket.id,
    });
  }
}

async function notifyInternalUsers(input: {
  type: string;
  title: string;
  body?: string;
}) {
  const internalUsers = await db.user.findMany({
    where: { role: { in: ["USER", "SUPER_ADMIN"] } },
    select: { id: true },
  });

  for (const internalUser of internalUsers as Array<{ id: string }>) {
    await notifyIfMissing({
      userId: internalUser.id,
      type: input.type,
      title: input.title,
      body: input.body,
    });
  }
}

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get("x-hub-signature-256") || "";
    if (!verifyWebhookSignature(rawBody, signature)) {
      return NextResponse.json(
        { error: "Invalid webhook signature" },
        { status: 401 },
      );
    }

    const event = request.headers.get("x-github-event") || "";
    const body = JSON.parse(rawBody) as any;

    if (event === "pull_request") {
      const action = typeof body.action === "string" ? body.action : "";
      const pr = body.pull_request as
        | {
            title?: string;
            html_url?: string;
            number?: number;
            state?: string;
            merged?: boolean;
            merged_at?: string | null;
            head?: { ref?: string; sha?: string };
            base?: { ref?: string };
            user?: { login?: string };
          }
        | undefined;

      if (!pr || typeof pr.number !== "number") {
        return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
      }

      const owner =
        typeof body.repository?.owner?.login === "string"
          ? body.repository.owner.login
          : "";
      const repo =
        typeof body.repository?.name === "string" ? body.repository.name : "";
      const repoFullName =
        typeof body.repository?.full_name === "string"
          ? body.repository.full_name
          : "";
      const branchRef = pr.head?.ref ?? "";
      const targetRef = pr.base?.ref ?? "";
      const selectorId = parseSelectorIdFromBranch(branchRef);
      const prState = pr.merged || pr.merged_at ? "merged" : pr.state || "open";

      let linkedTickets = await loadLinkedTicketsByPrNumber(pr.number);

      if (selectorId !== null) {
        const matchedTicket = await resolveTicketBySelector(selectorId);
        if (matchedTicket) {
          await upsertPullRequestLink({
            ticketId: matchedTicket.id,
            prNumber: pr.number,
            prTitle: pr.title || `PR #${pr.number}`,
            prUrl: pr.html_url || "",
            prState,
          });

          if (!linkedTickets.some((ticket) => ticket.id === matchedTicket.id)) {
            linkedTickets = [...linkedTickets, matchedTicket as LinkedTicket];
          }
        }
      }

      if (action === "closed" && (pr.merged || pr.merged_at)) {
        if (targetRef === "develop") {
          await notifyInternalUsers({
            type: "SYSTEM_DEV_BRANCH_UPDATED",
            title: `Develop updated from merged PR: ${pr.title || `#${pr.number}`}`,
            body: `${repoFullName || "Repository"} -> develop\n${pr.html_url || ""}`,
          });
        }

        if (targetRef === "main") {
          await notifyInternalUsers({
            type: "SYSTEM_RELEASE_STABLE_PUBLISHED",
            title: `Main updated (stable release): ${pr.title || `#${pr.number}`}`,
            body: `${repoFullName || "Repository"} -> main\n${pr.html_url || ""}`,
          });
        }
      }

      const nextStatus = statusForPullRequestEvent(
        action,
        Boolean(pr.merged || pr.merged_at),
      );

      for (const ticket of linkedTickets) {
        await upsertPullRequestLink({
          ticketId: ticket.id,
          prNumber: pr.number,
          prTitle: pr.title || `PR #${pr.number}`,
          prUrl: pr.html_url || "",
          prState,
        });

        if (nextStatus) {
          await updateTicketStatusIfChanged(
            ticket,
            nextStatus,
            `PR ${action.replaceAll("_", " ")}: ${pr.title || `#${pr.number}`}`,
            {
              source: "github_webhook",
              event,
              action,
              prNumber: pr.number,
              prUrl: pr.html_url,
              branchRef,
              repo: repoFullName,
              autoStatus: nextStatus,
            },
          );
        }

        if (
          ["opened", "review_requested", "ready_for_review"].includes(action)
        ) {
          await notifyAssignee(ticket, {
            type: "PR_REVIEW_REQUESTED",
            title: `PR awaiting review: ${pr.title || `#${pr.number}`}`,
            body: pr.html_url || undefined,
          });
        }

        if (action === "closed" && (pr.merged || pr.merged_at)) {
          await notifyQa(ticket, {
            type: "PR_MERGED",
            title: `PR merged: ${pr.title || `#${pr.number}`}`,
            body: pr.html_url || undefined,
          });
        }

        if (action === "closed" && !(pr.merged || pr.merged_at)) {
          await updateTicketStatusIfChanged(
            ticket,
            TicketStatus.REVISIONS,
            `PR closed without merge: ${pr.title || `#${pr.number}`}`,
            {
              source: "github_webhook",
              event,
              action,
              prNumber: pr.number,
              prUrl: pr.html_url,
              branchRef,
              repo: repoFullName,
              autoStatus: TicketStatus.REVISIONS,
            },
          );

          await notifyAssignee(ticket, {
            type: "PR_CLOSED_UNMERGED",
            title: `PR closed without merge: ${pr.title || `#${pr.number}`}`,
            body: pr.html_url || undefined,
          });
        }
      }

      // If an assignee pushes to the PR branch, keep ticket in review.
      if (action === "synchronize") {
        for (const ticket of linkedTickets) {
          await logGithubActivity({
            ticketId: ticket.id,
            actorId: ticket.creatorId,
            type: "GH_PR_SYNC",
            summary: `PR updated with new commits: ${pr.title || `#${pr.number}`}`,
            metadata: {
              source: "github_webhook",
              action,
              event,
              prNumber: pr.number,
              prUrl: pr.html_url,
              branchRef,
              author: pr.user?.login,
            },
          });
        }
      }

      // Inline check refresh to support approved+green -> QA gate.
      if (
        action === "ready_for_review" ||
        action === "synchronize" ||
        action === "opened"
      ) {
        const sha = pr.head?.sha ?? "";
        if (owner && repo && sha) {
          const checkSummary = await fetchCheckSummary({
            owner,
            repo,
            ref: sha,
          });
          if (checkSummary.failing.length > 0) {
            for (const ticket of linkedTickets) {
              await notifyAssignee(ticket, {
                type: "PR_CHECKS_FAILED",
                title: `Checks failed for PR #${pr.number}`,
                body: checkSummary.failing
                  .map((check) => check.name)
                  .join(", "),
              });
            }
          }
        }
      }

      return NextResponse.json({
        ok: true,
        linkedTickets: linkedTickets.map((ticket) => ticket.id),
        selectorId,
        branchRef,
        targetRef,
        statusMappedTo: nextStatus,
      });
    }

    if (event === "pull_request_review") {
      const reviewState =
        typeof body.review?.state === "string"
          ? body.review.state.toLowerCase()
          : "";
      const prNumber =
        typeof body.pull_request?.number === "number"
          ? body.pull_request.number
          : null;
      const owner =
        typeof body.repository?.owner?.login === "string"
          ? body.repository.owner.login
          : "";
      const repo =
        typeof body.repository?.name === "string" ? body.repository.name : "";
      const sha =
        typeof body.pull_request?.head?.sha === "string"
          ? body.pull_request.head.sha
          : "";

      if (!prNumber) {
        return NextResponse.json({ ok: true, ignored: true });
      }

      const linkedTickets = await loadLinkedTicketsByPrNumber(prNumber);
      const threadCounts =
        owner && repo
          ? await fetchReviewThreadCounts({ owner, repo, number: prNumber })
          : null;

      for (const ticket of linkedTickets) {
        await logGithubActivity({
          ticketId: ticket.id,
          actorId: ticket.creatorId,
          type: "GH_REVIEW_STATE",
          summary: `Review ${reviewState}: PR #${prNumber}`,
          metadata: {
            source: "github_webhook",
            event,
            state: reviewState,
            prNumber,
            url: body.review?.html_url,
            author: body.review?.user?.login,
            body: trimSummary(body.review?.body),
          },
        });

        if (threadCounts) {
          await logGithubActivity({
            ticketId: ticket.id,
            actorId: ticket.creatorId,
            type: "GH_REVIEW_THREAD_COUNTS",
            summary: `Review threads: ${threadCounts.unresolved} unresolved, ${threadCounts.resolved} resolved`,
            metadata: {
              source: "github_webhook",
              prNumber,
              ...threadCounts,
            },
          });
        }

        if (reviewState === "changes_requested") {
          await updateTicketStatusIfChanged(
            ticket,
            TicketStatus.REVISIONS,
            `Review changes requested on PR #${prNumber}`,
            {
              source: "github_webhook",
              event,
              state: reviewState,
              prNumber,
            },
          );

          await notifyAssignee(ticket, {
            type: "PR_CHANGES_REQUESTED",
            title: `Changes requested on PR #${prNumber}`,
            body: body.review?.html_url || undefined,
          });
        }

        if (reviewState === "approved") {
          const checks =
            owner && repo && sha
              ? await fetchCheckSummary({ owner, repo, ref: sha })
              : { allGreen: false, failing: [], pending: [] };

          await logGithubActivity({
            ticketId: ticket.id,
            actorId: ticket.creatorId,
            type: "GH_CHECK_GATE",
            summary: checks.allGreen
              ? `Approved with passing checks: PR #${prNumber}`
              : `Approved but checks still failing/pending: PR #${prNumber}`,
            metadata: {
              source: "github_webhook",
              event,
              prNumber,
              allGreen: checks.allGreen,
              failingChecks: checks.failing,
              pendingChecks: checks.pending,
            },
          });

          await updateTicketStatusIfChanged(
            ticket,
            TicketStatus.QA,
            checks.allGreen
              ? `PR #${prNumber} approved and moved to QA`
              : `PR #${prNumber} approved (checks pending/failing) and moved to QA`,
            {
              source: "github_webhook",
              event,
              prNumber,
              autoStatus: TicketStatus.QA,
              allGreen: owner && repo && sha ? checks.allGreen : null,
            },
          );

          await notifyQa(ticket, {
            type: "PR_READY_FOR_QA",
            title: `Ready for QA: PR #${prNumber}`,
            body: body.pull_request?.html_url || undefined,
          });
        }
      }

      return NextResponse.json({
        ok: true,
        linkedTickets: linkedTickets.length,
      });
    }

    if (event === "pull_request_review_comment" || event === "issue_comment") {
      const prNumber =
        typeof body.pull_request?.number === "number"
          ? body.pull_request.number
          : typeof body.issue?.number === "number" && body.issue?.pull_request
            ? body.issue.number
            : null;

      if (!prNumber) {
        return NextResponse.json({ ok: true, ignored: true });
      }

      const linkedTickets = await loadLinkedTicketsByPrNumber(prNumber);
      const text = trimSummary(body.comment?.body);
      const author =
        body.comment?.user?.login || body.sender?.login || "unknown";
      const htmlUrl =
        body.comment?.html_url ||
        body.pull_request?.html_url ||
        body.issue?.html_url;

      for (const ticket of linkedTickets) {
        await logGithubActivity({
          ticketId: ticket.id,
          actorId: ticket.creatorId,
          type: "GH_INLINE_COMMENT",
          summary: `GitHub ${event.replaceAll("_", " ")} by @${author}: ${text || "(no text)"}`,
          metadata: {
            source: "github_webhook",
            event,
            prNumber,
            url: htmlUrl,
            comment: text,
            author,
            path: body.comment?.path,
            line: body.comment?.line,
            side: body.comment?.side,
          },
        });
      }

      return NextResponse.json({
        ok: true,
        linkedTickets: linkedTickets.length,
      });
    }

    if (event === "push") {
      const branchRefRaw = typeof body.ref === "string" ? body.ref : "";
      const branchRef = branchRefRaw.startsWith("refs/heads/")
        ? branchRefRaw.slice("refs/heads/".length)
        : branchRefRaw;
      const selectorId = parseSelectorIdFromBranch(branchRef);
      const selectorTicket = await resolveTicketBySelector(selectorId);

      if (!selectorTicket) {
        return NextResponse.json({ ok: true, ignored: true });
      }

      const ticket = selectorTicket as LinkedTicket;
      const commitCount = Array.isArray(body.commits) ? body.commits.length : 0;
      const pusher =
        typeof body.pusher?.name === "string"
          ? body.pusher.name
          : typeof body.sender?.login === "string"
            ? body.sender.login
            : "unknown";

      await logGithubActivity({
        ticketId: ticket.id,
        actorId: ticket.creatorId,
        type: "GH_PUSH",
        summary: `Push to ${branchRef || "branch"} (${commitCount} commit${commitCount === 1 ? "" : "s"})`,
        metadata: {
          source: "github_webhook",
          event,
          selectorId,
          branchRef,
          commitCount,
          pusher,
        },
      });

      const targetStatus =
        ticket.status === TicketStatus.REVISIONS
          ? TicketStatus.IN_REVIEW
          : ticket.status === TicketStatus.BACKLOG ||
              ticket.status === TicketStatus.TODO ||
              ticket.status === TicketStatus.REFINE
            ? TicketStatus.IN_PROGRESS
            : null;

      if (targetStatus) {
        await updateTicketStatusIfChanged(
          ticket,
          targetStatus,
          `Auto-moved to ${targetStatus === TicketStatus.IN_PROGRESS ? "In Progress" : "In Review"} from push activity`,
          {
            source: "github_webhook",
            event,
            selectorId,
            branchRef,
            autoStatus: targetStatus,
            commitCount,
          },
        );
      }

      return NextResponse.json({
        ok: true,
        linkedTicket: ticket.id,
        selectorId,
        branchRef,
        statusMappedTo: targetStatus,
      });
    }

    if (event === "check_run") {
      const action = typeof body.action === "string" ? body.action : "";
      const checkRun = body.check_run;
      const prNumber =
        typeof checkRun?.pull_requests?.[0]?.number === "number"
          ? checkRun.pull_requests[0].number
          : null;
      const branchRef =
        typeof checkRun?.check_suite?.head_branch === "string"
          ? checkRun.check_suite.head_branch
          : "";
      const selectorId = parseSelectorIdFromBranch(branchRef);

      let linkedTickets = prNumber
        ? await loadLinkedTicketsByPrNumber(prNumber)
        : [];
      if (linkedTickets.length === 0) {
        const selectorTicket = await resolveTicketBySelector(selectorId);
        if (selectorTicket) linkedTickets = [selectorTicket as LinkedTicket];
      }

      for (const ticket of linkedTickets) {
        await logGithubActivity({
          ticketId: ticket.id,
          actorId: ticket.creatorId,
          type: "GH_CHECK_RUN",
          summary: `Check ${checkRun?.name || "unknown"}: ${checkRun?.conclusion || checkRun?.status || action}`,
          metadata: {
            source: "github_webhook",
            event,
            action,
            prNumber,
            selectorId,
            checkName: checkRun?.name,
            status: checkRun?.status,
            conclusion: checkRun?.conclusion,
            url: checkRun?.html_url,
            branchRef,
          },
        });
      }

      return NextResponse.json({
        ok: true,
        linkedTickets: linkedTickets.length,
      });
    }

    if (event === "workflow_run") {
      const workflowRun = body.workflow_run;
      const branchRef =
        typeof workflowRun?.head_branch === "string"
          ? workflowRun.head_branch
          : "";
      const selectorId = parseSelectorIdFromBranch(branchRef);
      const prNumber =
        typeof workflowRun?.pull_requests?.[0]?.number === "number"
          ? workflowRun.pull_requests[0].number
          : null;

      let linkedTickets = prNumber
        ? await loadLinkedTicketsByPrNumber(prNumber)
        : [];
      if (linkedTickets.length === 0) {
        const selectorTicket = await resolveTicketBySelector(selectorId);
        if (selectorTicket) linkedTickets = [selectorTicket as LinkedTicket];
      }

      for (const ticket of linkedTickets) {
        await logGithubActivity({
          ticketId: ticket.id,
          actorId: ticket.creatorId,
          type: "GH_WORKFLOW_RUN",
          summary: `${workflowRun?.name || "Workflow"}: ${workflowRun?.conclusion || workflowRun?.status || "updated"}`,
          metadata: {
            source: "github_webhook",
            event,
            selectorId,
            prNumber,
            branchRef,
            workflowName: workflowRun?.name,
            displayTitle: workflowRun?.display_title,
            status: workflowRun?.status,
            conclusion: workflowRun?.conclusion,
            url: workflowRun?.html_url,
            runNumber: workflowRun?.run_number,
            environment: workflowRun?.environment,
          },
        });
      }

      return NextResponse.json({
        ok: true,
        linkedTickets: linkedTickets.length,
      });
    }

    if (event === "deployment_status") {
      const deployment = body.deployment;
      const deploymentStatus = body.deployment_status;
      const ref = typeof deployment?.ref === "string" ? deployment.ref : "";
      const selectorId = parseSelectorIdFromBranch(ref);
      const selectorTicket = await resolveTicketBySelector(selectorId);

      if (!selectorTicket) {
        return NextResponse.json({ ok: true, ignored: true });
      }

      const ticket = selectorTicket as LinkedTicket;
      await logGithubActivity({
        ticketId: ticket.id,
        actorId: ticket.creatorId,
        type: "GH_DEPLOYMENT",
        summary: `Deployment ${deploymentStatus?.state || "updated"}${deploymentStatus?.environment ? ` (${deploymentStatus.environment})` : ""}`,
        metadata: {
          source: "github_webhook",
          event,
          selectorId,
          ref,
          environment: deploymentStatus?.environment,
          state: deploymentStatus?.state,
          url: deploymentStatus?.target_url || deploymentStatus?.log_url,
        },
      });

      return NextResponse.json({ ok: true, linkedTicket: ticket.id });
    }

    return NextResponse.json({ ok: true, ignored: true, event });
  } catch (error) {
    console.error("GitHub webhook error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
