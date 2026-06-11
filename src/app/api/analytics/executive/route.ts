import { NextRequest, NextResponse } from "next/server";
import { Role, TicketStatus } from "@/lib/db-types";
import { db } from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";
import { getGithubClient } from "@/lib/github";

function startOfWeek(d: Date) {
  const x = new Date(d);
  const day = x.getDay();
  const diff = x.getDate() - day + (day === 0 ? -6 : 1);
  x.setDate(diff);
  x.setHours(0, 0, 0, 0);
  return x;
}

function weekKey(d: Date) {
  const s = startOfWeek(d);
  return s.toISOString().slice(0, 10);
}

function toDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function repoKeyFromGithubUrl(value: unknown): string | null {
  if (!value) return null;
  const text = String(value).trim();
  if (!text) return null;
  try {
    const parsed = new URL(text);
    const parts = parsed.pathname.split("/").filter(Boolean);
    if (parts.length < 2) return null;
    return `${parts[0]}/${parts[1]}`.toLowerCase();
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getUserFromRequest(request);
    if (!session || session.role !== Role.SUPER_ADMIN) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const requestedTeamId = searchParams.get("teamId") ?? "";
    const requestedCompareTeamId = searchParams.get("compareTeamId") ?? "";
    const requestedGithubRepo =
      searchParams.get("githubRepo")?.trim().toLowerCase() ?? "all";

    const [ticketStatusRows, openTickets] = await Promise.all([
      db.ticket.findMany({
        select: { status: true },
      }),
      db.ticket.count({
        where: { status: { not: TicketStatus.COMPLETE } },
      }),
    ]);

    // Project analytics are optional so executive view still loads on older DB snapshots.
    let projectHealthRows: Array<{ health?: string | null }> = [];
    let projectStatusRows: Array<{ status?: string | null }> = [];
    try {
      [projectHealthRows, projectStatusRows] = await Promise.all([
        db.project.findMany({
          select: { health: true },
        }),
        db.project.findMany({
          select: { status: true },
        }),
      ]);
    } catch (error) {
      console.warn("Executive analytics: project metrics unavailable", error);
    }

    const countBy = <T extends string>(
      rows: Array<{ value: T | null | undefined }>,
    ) => {
      const counts = new Map<string, number>();
      for (const row of rows) {
        if (!row.value) continue;
        counts.set(row.value, (counts.get(row.value) ?? 0) + 1);
      }
      return Array.from(counts.entries()).map(([key, count]) => ({
        key,
        count,
      }));
    };

    const ticketsByStatus = countBy(
      ticketStatusRows.map((row: any) => ({ value: row.status })),
    );
    const projectsByHealth = countBy(
      projectHealthRows.map((row: any) => ({ value: row.health })),
    );
    const projectsByStatus = countBy(
      projectStatusRows.map((row: any) => ({ value: row.status })),
    );

    const since = new Date();
    since.setDate(since.getDate() - 56);

    const completedTickets = await db.ticket.findMany({
      where: {
        status: TicketStatus.COMPLETE,
        updatedAt: { gte: since },
      },
      select: { updatedAt: true },
    });

    const weekly: Record<string, number> = {};
    for (const t of completedTickets) {
      const k = weekKey(t.updatedAt);
      weekly[k] = (weekly[k] ?? 0) + 1;
    }

    const keys = Object.keys(weekly).sort();
    const completedPerWeek = keys.map((k) => ({ week: k, count: weekly[k] }));

    let teamsBase: Array<{ id: string; name: string }> = [];
    let teamTicketRows: Array<{
      id: string;
      teamId?: string | null;
      assigneeId?: string | null;
      status?: string | null;
      priority?: string | null;
      createdAt: Date;
      updatedAt: Date;
      dueDate?: Date | null;
    }> = [];
    try {
      [teamsBase, teamTicketRows] = await Promise.all([
        db.team.findMany({
          select: {
            id: true,
            name: true,
          },
        }),
        db.ticket.findMany({
          select: {
            id: true,
            teamId: true,
            assigneeId: true,
            status: true,
            priority: true,
            createdAt: true,
            updatedAt: true,
            dueDate: true,
          },
        }),
      ]);
    } catch (error) {
      console.warn("Executive analytics: team metrics unavailable", error);
    }

    const ticketCountByTeam = new Map<string, number>();
    for (const row of teamTicketRows) {
      if (!row.teamId) continue;
      ticketCountByTeam.set(
        row.teamId,
        (ticketCountByTeam.get(row.teamId) ?? 0) + 1,
      );
    }

    const teams = teamsBase.map((team) => ({
      id: team.id,
      name: team.name,
      _count: {
        tickets: ticketCountByTeam.get(team.id) ?? 0,
      },
    }));

    const validTeamIds = new Set(teams.map((team) => team.id));
    const selectedTeamIds = [requestedTeamId, requestedCompareTeamId].filter(
      (id, index, arr) =>
        id && id !== "all" && validTeamIds.has(id) && arr.indexOf(id) === index,
    );
    const teamsInScope =
      selectedTeamIds.length > 0
        ? teams.filter((team) => selectedTeamIds.includes(team.id))
        : teams;

    const now = new Date();
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const teamById = new Map(teams.map((team) => [team.id, team.name]));
    const statusByTeam = new Map<string, Map<string, number>>();
    const weeklyByTeam = new Map<string, Map<string, number>>();
    const metricsBase = new Map<
      string,
      {
        totalTickets: number;
        openTickets: number;
        overdueTickets: number;
        urgentOpenTickets: number;
        completedLast7Days: number;
        completedCycleDaysTotal: number;
        completedCycleCount: number;
      }
    >();

    for (const team of teamsInScope) {
      metricsBase.set(team.id, {
        totalTickets: 0,
        openTickets: 0,
        overdueTickets: 0,
        urgentOpenTickets: 0,
        completedLast7Days: 0,
        completedCycleDaysTotal: 0,
        completedCycleCount: 0,
      });
      statusByTeam.set(team.id, new Map<string, number>());
      weeklyByTeam.set(team.id, new Map<string, number>());
    }

    for (const row of teamTicketRows) {
      if (!row.teamId || !metricsBase.has(row.teamId)) continue;

      const updatedAt = toDate(row.updatedAt);
      const createdAt = toDate(row.createdAt);
      const dueDate = toDate(row.dueDate);

      const metric = metricsBase.get(row.teamId)!;
      metric.totalTickets += 1;

      const status = row.status ?? "UNKNOWN";
      if (status !== TicketStatus.COMPLETE) {
        metric.openTickets += 1;
        if (dueDate && dueDate < now) {
          metric.overdueTickets += 1;
        }
        if (row.priority === "URGENT") {
          metric.urgentOpenTickets += 1;
        }
      } else {
        if (updatedAt && updatedAt >= sevenDaysAgo) {
          metric.completedLast7Days += 1;
        }

        if (updatedAt && createdAt) {
          const cycleDays =
            (updatedAt.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24);
          if (!Number.isNaN(cycleDays) && Number.isFinite(cycleDays)) {
            metric.completedCycleDaysTotal += cycleDays;
            metric.completedCycleCount += 1;
          }
        }

        if (updatedAt) {
          const wk = weekKey(updatedAt);
          const wkMap = weeklyByTeam.get(row.teamId)!;
          wkMap.set(wk, (wkMap.get(wk) ?? 0) + 1);
        }
      }

      const statusMap = statusByTeam.get(row.teamId)!;
      statusMap.set(status, (statusMap.get(status) ?? 0) + 1);
    }

    const teamMetrics = teamsInScope.map((team) => {
      const metric = metricsBase.get(team.id)!;
      return {
        id: team.id,
        name: team.name,
        totalTickets: metric.totalTickets,
        openTickets: metric.openTickets,
        overdueTickets: metric.overdueTickets,
        urgentOpenTickets: metric.urgentOpenTickets,
        completedLast7Days: metric.completedLast7Days,
        avgCycleDays:
          metric.completedCycleCount > 0
            ? Number(
                (
                  metric.completedCycleDaysTotal / metric.completedCycleCount
                ).toFixed(1),
              )
            : null,
      };
    });

    const teamStatusBreakdown = teamsInScope.flatMap((team) => {
      const statusMap = statusByTeam.get(team.id)!;
      return Array.from(statusMap.entries()).map(([status, count]) => ({
        teamId: team.id,
        teamName: team.name,
        status,
        count,
      }));
    });

    const weekSet = new Set<string>();
    for (const team of teamsInScope) {
      const wkMap = weeklyByTeam.get(team.id)!;
      for (const wk of wkMap.keys()) weekSet.add(wk);
    }
    const teamCompletedPerWeek = Array.from(weekSet)
      .sort()
      .flatMap((week) =>
        teamsInScope.map((team) => ({
          week,
          teamId: team.id,
          teamName: team.name,
          count: weeklyByTeam.get(team.id)?.get(week) ?? 0,
        })),
      );

    const scopeTeamIds = new Set(teamsInScope.map((team) => team.id));
    const ticketsInScope = teamTicketRows.filter(
      (row) => row.teamId && scopeTeamIds.has(row.teamId),
    );

    const assigneeIds = Array.from(
      new Set(
        ticketsInScope
          .map((row) => row.assigneeId)
          .filter((value): value is string => typeof value === "string"),
      ),
    );

    const assignees = assigneeIds.length
      ? await db.user.findMany({
          where: { id: { in: assigneeIds } },
          select: { id: true, name: true, email: true },
        })
      : [];

    const assigneeById = new Map<
      string,
      { id: string; name: string; email: string }
    >(assignees.map((assignee: any) => [assignee.id, assignee]));

    const memberBase = new Map<
      string,
      {
        id: string;
        name: string;
        email: string;
        assignedTotal: number;
        assignedOpen: number;
        overdueOpen: number;
        urgentOpen: number;
        inProgress: number;
        revisions: number;
        clientReview: number;
        completedLast7Days: number;
        completedCycleDaysTotal: number;
        completedCycleCount: number;
      }
    >();

    const ensureMember = (assigneeId: string) => {
      const existing = memberBase.get(assigneeId);
      if (existing) return existing;
      const profile = assigneeById.get(assigneeId);
      const created = {
        id: assigneeId,
        name: profile?.name ?? "Unknown",
        email: profile?.email ?? "",
        assignedTotal: 0,
        assignedOpen: 0,
        overdueOpen: 0,
        urgentOpen: 0,
        inProgress: 0,
        revisions: 0,
        clientReview: 0,
        completedLast7Days: 0,
        completedCycleDaysTotal: 0,
        completedCycleCount: 0,
      };
      memberBase.set(assigneeId, created);
      return created;
    };

    let unassignedOpenTickets = 0;
    for (const row of ticketsInScope) {
      const status = row.status ?? "UNKNOWN";
      const updatedAt = toDate(row.updatedAt);
      const createdAt = toDate(row.createdAt);
      const dueDate = toDate(row.dueDate);

      if (!row.assigneeId) {
        if (status !== TicketStatus.COMPLETE) {
          unassignedOpenTickets += 1;
        }
        continue;
      }

      const member = ensureMember(row.assigneeId);
      member.assignedTotal += 1;

      if (status !== TicketStatus.COMPLETE) {
        member.assignedOpen += 1;
        if (row.priority === "URGENT") {
          member.urgentOpen += 1;
        }
        if (dueDate && dueDate < now) {
          member.overdueOpen += 1;
        }
      }

      if (status === TicketStatus.IN_PROGRESS) {
        member.inProgress += 1;
      }
      if (status === TicketStatus.REVISIONS) {
        member.revisions += 1;
      }
      if (status === TicketStatus.CLIENT_REVIEW) {
        member.clientReview += 1;
      }

      if (status === TicketStatus.COMPLETE) {
        if (updatedAt && updatedAt >= sevenDaysAgo) {
          member.completedLast7Days += 1;
        }
        if (updatedAt && createdAt) {
          const cycleDays =
            (updatedAt.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24);
          if (!Number.isNaN(cycleDays) && Number.isFinite(cycleDays)) {
            member.completedCycleDaysTotal += cycleDays;
            member.completedCycleCount += 1;
          }
        }
      }
    }

    const memberMetrics = Array.from(memberBase.values())
      .map((member) => ({
        id: member.id,
        name: member.name,
        email: member.email,
        assignedTotal: member.assignedTotal,
        assignedOpen: member.assignedOpen,
        overdueOpen: member.overdueOpen,
        urgentOpen: member.urgentOpen,
        inProgress: member.inProgress,
        revisions: member.revisions,
        clientReview: member.clientReview,
        completedLast7Days: member.completedLast7Days,
        avgCycleDays:
          member.completedCycleCount > 0
            ? Number(
                (
                  member.completedCycleDaysTotal / member.completedCycleCount
                ).toFixed(1),
              )
            : null,
      }))
      .sort((a, b) => {
        if (b.assignedOpen !== a.assignedOpen) {
          return b.assignedOpen - a.assignedOpen;
        }
        if (b.urgentOpen !== a.urgentOpen) {
          return b.urgentOpen - a.urgentOpen;
        }
        return a.name.localeCompare(b.name);
      });

    const scopeTicketIds = new Set(
      ticketsInScope
        .map((row) => row.id)
        .filter((value): value is string => typeof value === "string"),
    );

    let githubAnalytics = {
      connectedRepos: 0,
      linkedPullRequests: 0,
      openPullRequests: 0,
      mergedPullRequests: 0,
      closedPullRequests: 0,
      mergedLast7Days: 0,
      staleOpenPullRequests: 0,
      pullRequestsByState: [] as Array<{ state: string; count: number }>,
      mergedPerWeek: [] as Array<{ week: string; count: number }>,
      selectedRepoKey: "all",
      repoOptions: [] as Array<{ value: string; label: string }>,
      repoBreakdown: [] as Array<{
        repo: string;
        linked: number;
        open: number;
        merged: number;
        closed: number;
        mergedLast7Days: number;
        staleOpen: number;
      }>,
    };

    try {
      const [pullRequestRows, repoRows, projectRows] = await Promise.all([
        db.githubPullRequest.findMany({
          select: {
            ticketId: true,
            state: true,
            url: true,
            createdAt: true,
            updatedAt: true,
          },
        }),
        db.githubRepo.findMany({
          select: {
            projectId: true,
            owner: true,
            name: true,
          },
        }),
        db.project.findMany({
          select: {
            id: true,
            teamId: true,
          },
        }),
      ]);

      const scopeTeamIdSet = new Set(teamsInScope.map((team) => team.id));
      const scopeProjectIds = new Set(
        (projectRows as Array<{ id: string; teamId?: string | null }>)
          .filter(
            (project) => project.teamId && scopeTeamIdSet.has(project.teamId),
          )
          .map((project) => project.id),
      );

      const connectedRepos = (
        repoRows as Array<{ projectId?: string | null }>
      ).filter((repo) => repo.projectId && scopeProjectIds.has(repo.projectId));

      const repoOptions = connectedRepos
        .map((repo: any) => ({
          value: `${String(repo.owner).toLowerCase()}/${String(repo.name).toLowerCase()}`,
          label: `${repo.owner}/${repo.name}`,
        }))
        .filter(
          (repo, index, arr) =>
            arr.findIndex((x) => x.value === repo.value) === index,
        )
        .sort((a, b) => a.label.localeCompare(b.label));

      const selectedRepoKey =
        requestedGithubRepo !== "all" &&
        repoOptions.some((repo) => repo.value === requestedGithubRepo)
          ? requestedGithubRepo
          : "all";

      let prsInScope = (
        pullRequestRows as Array<{
          ticketId?: string | null;
          state?: string | null;
          url?: string | null;
          createdAt?: unknown;
          updatedAt?: unknown;
        }>
      )
        .filter((pr) => pr.ticketId && scopeTicketIds.has(pr.ticketId))
        .map((pr) => ({
          ...pr,
          repoKey: repoKeyFromGithubUrl(pr.url),
        }))
        .filter((pr) =>
          selectedRepoKey === "all" ? true : pr.repoKey === selectedRepoKey,
        );

      if (prsInScope.length === 0 && repoOptions.length > 0) {
        try {
          const github = await getGithubClient(session.id);
          if (github) {
            const targetRepos =
              selectedRepoKey === "all"
                ? repoOptions
                : repoOptions.filter((repo) => repo.value === selectedRepoKey);

            const livePrs: Array<{
              state: string;
              repoKey: string;
              createdAt: unknown;
              updatedAt: unknown;
              mergedAt: unknown;
            }> = [];

            for (const repoOption of targetRepos) {
              const [owner, repo] = repoOption.value.split("/");
              if (!owner || !repo) continue;

              let page = 1;
              while (page <= 5) {
                const { data } = await github.octokit.rest.pulls.list({
                  owner,
                  repo,
                  state: "all",
                  per_page: 100,
                  page,
                });

                for (const pr of data as any[]) {
                  livePrs.push({
                    state: pr.merged_at
                      ? "merged"
                      : String(pr.state ?? "unknown"),
                    repoKey: repoOption.value,
                    createdAt: pr.created_at,
                    updatedAt: pr.updated_at,
                    mergedAt: pr.merged_at,
                  });
                }

                if (data.length < 100) {
                  break;
                }

                page += 1;
              }
            }

            if (livePrs.length > 0) {
              prsInScope = livePrs;
            }
          }
        } catch (liveError) {
          console.warn(
            "Executive analytics: github live fallback unavailable",
            liveError,
          );
        }
      }

      const stateCounts = new Map<string, number>();
      let openPullRequests = 0;
      let mergedPullRequests = 0;
      let closedPullRequests = 0;
      let mergedLast7Days = 0;
      let staleOpenPullRequests = 0;
      const mergedWeekly = new Map<string, number>();
      const repoBreakdown = new Map<
        string,
        {
          repo: string;
          linked: number;
          open: number;
          merged: number;
          closed: number;
          mergedLast7Days: number;
          staleOpen: number;
        }
      >();

      for (const pr of prsInScope) {
        const state = (pr.state ?? "unknown").toLowerCase();
        stateCounts.set(state, (stateCounts.get(state) ?? 0) + 1);
        const repo = pr.repoKey ?? "unmapped";

        if (!repoBreakdown.has(repo)) {
          repoBreakdown.set(repo, {
            repo,
            linked: 0,
            open: 0,
            merged: 0,
            closed: 0,
            mergedLast7Days: 0,
            staleOpen: 0,
          });
        }

        const repoMetric = repoBreakdown.get(repo)!;
        repoMetric.linked += 1;

        const createdAt = toDate(pr.createdAt);
        const updatedAt = toDate(pr.updatedAt);
        const mergedAt = toDate((pr as any).mergedAt);

        if (state === "open") {
          openPullRequests += 1;
          repoMetric.open += 1;
          if (createdAt) {
            const ageDays =
              (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24);
            if (ageDays > 7) {
              staleOpenPullRequests += 1;
              repoMetric.staleOpen += 1;
            }
          }
        } else if (state === "merged" || mergedAt) {
          mergedPullRequests += 1;
          repoMetric.merged += 1;
          const mergedOrUpdatedAt = mergedAt ?? updatedAt;
          if (mergedOrUpdatedAt && mergedOrUpdatedAt >= sevenDaysAgo) {
            mergedLast7Days += 1;
            repoMetric.mergedLast7Days += 1;
          }
          if (mergedOrUpdatedAt) {
            const wk = weekKey(mergedOrUpdatedAt);
            mergedWeekly.set(wk, (mergedWeekly.get(wk) ?? 0) + 1);
          }
        } else if (state === "closed") {
          closedPullRequests += 1;
          repoMetric.closed += 1;
        }
      }

      githubAnalytics = {
        connectedRepos: repoOptions.length,
        linkedPullRequests: prsInScope.length,
        openPullRequests,
        mergedPullRequests,
        closedPullRequests,
        mergedLast7Days,
        staleOpenPullRequests,
        pullRequestsByState: Array.from(stateCounts.entries()).map(
          ([state, count]) => ({ state, count }),
        ),
        mergedPerWeek: Array.from(mergedWeekly.entries())
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([week, count]) => ({ week, count })),
        selectedRepoKey,
        repoOptions,
        repoBreakdown: Array.from(repoBreakdown.values()).sort(
          (a, b) => b.linked - a.linked,
        ),
      };
    } catch (error) {
      console.warn("Executive analytics: github metrics unavailable", error);
    }
    return NextResponse.json({
      ticketsByStatus: ticketsByStatus.map((r) => ({
        status: r.key,
        count: r.count,
      })),
      projectsByHealth: projectsByHealth.map((r) => ({
        health: r.key,
        count: r.count,
      })),
      projectsByStatus: projectsByStatus.map((r) => ({
        status: r.key,
        count: r.count,
      })),
      openTickets,
      completedPerWeek,
      teams,
      teamMetrics,
      teamStatusBreakdown,
      teamCompletedPerWeek,
      memberMetrics,
      unassignedOpenTickets,
      githubAnalytics,
      selectedTeamIds,
      selectedTeamNames: selectedTeamIds
        .map((id) => teamById.get(id))
        .filter(Boolean),
    });
  } catch (error) {
    console.error("Executive analytics error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
