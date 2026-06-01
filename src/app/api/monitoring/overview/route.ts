import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { Role } from "@/lib/db-types";
import { db } from "@/lib/db";
import { createNotification } from "@/lib/ticketActivity";
import { countUsers } from "@/lib/user-store";

function isConfigured(...values: Array<string | undefined>) {
  return values.some((value) => Boolean(value && value.trim().length > 0));
}

type SentryIssue = {
  id: string;
  title: string;
  level: string;
  status: string;
  count: string;
  userCount: number;
  lastSeen: string;
  permalink: string;
};

async function loadSentryIssues(): Promise<{
  checkedAt: string;
  reachable: boolean;
  statusCode: number | null;
  error: string | null;
  missingConfig: string[];
  issues: SentryIssue[];
}> {
  const token = process.env.SENTRY_AUTH_TOKEN?.trim();
  const org = process.env.SENTRY_ORG?.trim();
  const project = process.env.SENTRY_PROJECT?.trim();
  const baseUrl = (process.env.SENTRY_URL || "https://sentry.io")
    .trim()
    .replace(/\/$/, "");

  const missingConfig = [
    token ? null : "SENTRY_AUTH_TOKEN",
    org ? null : "SENTRY_ORG",
    project ? null : "SENTRY_PROJECT",
  ].filter((value): value is string => Boolean(value));

  if (missingConfig.length > 0) {
    return {
      checkedAt: new Date().toISOString(),
      reachable: false,
      statusCode: null,
      error: "Missing required Sentry API configuration",
      missingConfig,
      issues: [],
    };
  }

  const safeToken = token as string;
  const safeOrg = org as string;
  const safeProject = project as string;

  try {
    const response = await fetch(
      `${baseUrl}/api/0/projects/${encodeURIComponent(safeOrg)}/${encodeURIComponent(safeProject)}/issues/?query=is:unresolved&sort=date&statsPeriod=14d`,
      {
        headers: {
          Authorization: `Bearer ${safeToken}`,
          "Content-Type": "application/json",
        },
        cache: "no-store",
      },
    );

    if (!response.ok) {
      return {
        checkedAt: new Date().toISOString(),
        reachable: false,
        statusCode: response.status,
        error: `Sentry API returned ${response.status}`,
        missingConfig: [],
        issues: [],
      };
    }

    const body = (await response.json()) as unknown;
    if (!Array.isArray(body)) {
      return {
        checkedAt: new Date().toISOString(),
        reachable: true,
        statusCode: response.status,
        error: "Unexpected Sentry response format",
        missingConfig: [],
        issues: [],
      };
    }

    const issues = body
      .map((issue) => {
        const row = issue as Partial<SentryIssue>;
        if (!row.id || !row.title || !row.permalink) return null;
        return {
          id: String(row.id),
          title: String(row.title),
          level: String(row.level || "error"),
          status: String(row.status || "unresolved"),
          count: String(row.count || "0"),
          userCount: Number(row.userCount || 0),
          lastSeen: String(row.lastSeen || new Date().toISOString()),
          permalink: String(row.permalink),
        } satisfies SentryIssue;
      })
      .filter((row): row is SentryIssue => Boolean(row))
      .slice(0, 12);

    return {
      checkedAt: new Date().toISOString(),
      reachable: true,
      statusCode: response.status,
      error: null,
      missingConfig: [],
      issues,
    };
  } catch (error) {
    return {
      checkedAt: new Date().toISOString(),
      reachable: false,
      statusCode: null,
      error: error instanceof Error ? error.message : "Sentry request failed",
      missingConfig: [],
      issues: [],
    };
  }
}

async function syncMonitoringAlerts(issues: SentryIssue[]) {
  if (issues.length === 0) return;

  const superAdmins = await db.user.findMany({
    where: { role: Role.SUPER_ADMIN },
    select: { id: true },
  });

  if (superAdmins.length === 0) return;

  for (const issue of issues.slice(0, 12)) {
    const title = `Monitoring error: ${issue.title}`;
    const body = issue.permalink;

    for (const admin of superAdmins) {
      const existing = await db.notification.findFirst({
        where: {
          userId: admin.id,
          type: "MONITORING_ERROR",
          title,
          body,
        },
        select: { id: true },
      });

      if (existing) continue;

      await createNotification({
        userId: admin.id,
        type: "MONITORING_ERROR",
        title,
        body,
      });
    }
  }
}

function hourBucketLabel(value: Date) {
  return value.toISOString().slice(0, 13) + ":00:00.000Z";
}

function getTopCounts(items: string[], take = 8) {
  const counts = new Map<string, number>();
  for (const item of items) {
    counts.set(item, (counts.get(item) || 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, take);
}

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (user.role !== Role.SUPER_ADMIN) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const now = new Date();
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [
      userCount,
      rawAuditLogs,
      auditWindow24h,
      auditCount24h,
      auditCount7d,
      sentryIssues,
    ] = await Promise.all([
      countUsers(),
      db.auditLog.findMany({
        orderBy: { createdAt: "desc" },
        take: 80,
      }),
      db.auditLog.findMany({
        where: { createdAt: { gte: dayAgo } },
        orderBy: { createdAt: "desc" },
        take: 1500,
      }),
      db.auditLog.count({
        where: { createdAt: { gte: dayAgo } },
      }),
      db.auditLog.count({
        where: { createdAt: { gte: weekAgo } },
      }),
      loadSentryIssues(),
    ]);

    await syncMonitoringAlerts(sentryIssues.issues);

    const actorIds = Array.from(
      new Set(
        (rawAuditLogs as Array<{ actorId?: string | null }>)
          .concat(auditWindow24h as Array<{ actorId?: string | null }>)
          .map((row) => row.actorId)
          .filter((value): value is string => Boolean(value)),
      ),
    );

    const actors = actorIds.length
      ? await db.user.findMany({
          where: { id: { in: actorIds } },
          select: { id: true, name: true, email: true, role: true },
        })
      : [];

    const actorById = new Map(
      (
        actors as Array<{
          id: string;
          name: string;
          email: string;
          role: string;
        }>
      ).map((actor) => [actor.id, actor]),
    );

    const auditLogs = (rawAuditLogs as Array<Record<string, unknown>>).map(
      (row) => ({
        ...row,
        actor: row.actorId ? actorById.get(String(row.actorId)) || null : null,
      }),
    );

    const hourly = new Map<string, number>();
    for (let i = 23; i >= 0; i -= 1) {
      const bucketTime = new Date(now.getTime() - i * 60 * 60 * 1000);
      hourly.set(hourBucketLabel(bucketTime), 0);
    }

    const actorIds24h = new Set<string>();
    for (const row of auditWindow24h as Array<{
      createdAt: string | Date;
      actorId?: string | null;
    }>) {
      const created = new Date(row.createdAt);
      if (Number.isNaN(created.getTime())) continue;
      const key = hourBucketLabel(created);
      if (hourly.has(key)) {
        hourly.set(key, (hourly.get(key) || 0) + 1);
      }
      if (row.actorId) actorIds24h.add(String(row.actorId));
    }

    const topActionCounts = getTopCounts(
      (auditWindow24h as Array<{ action?: string }>).map((row) =>
        String(row.action || "UNKNOWN"),
      ),
      10,
    );

    const topEntityCounts = getTopCounts(
      (auditWindow24h as Array<{ entityType?: string }>).map((row) =>
        String(row.entityType || "Unknown"),
      ),
      10,
    );

    const topActorCounts = getTopCounts(
      (auditWindow24h as Array<{ actorId?: string | null }>).map((row) =>
        row.actorId ? String(row.actorId) : "system",
      ),
      8,
    ).map((item) => {
      if (item.key === "system") {
        return {
          id: "system",
          name: "System",
          email: null,
          role: null,
          count: item.count,
        };
      }
      const actor = actorById.get(item.key);
      return {
        id: item.key,
        name: actor?.name || "Unknown",
        email: actor?.email || null,
        role: actor?.role || null,
        count: item.count,
      };
    });

    const issuesByLevel = getTopCounts(
      sentryIssues.issues.map((issue) => issue.level || "error"),
      10,
    ).map((row) => ({ level: row.key, count: row.count }));

    return NextResponse.json({
      health: {
        status: "healthy",
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV,
        version: process.env.npm_package_version || "1.0.0",
        database: {
          reachable: true,
          users: userCount,
        },
      },
      auditLogs,
      audit: {
        sampled: auditCount24h > (auditWindow24h as Array<unknown>).length,
        events24h: auditCount24h,
        events7d: auditCount7d,
        uniqueActors24h: actorIds24h.size,
        topActions24h: topActionCounts.map((row) => ({
          action: row.key,
          count: row.count,
        })),
        topEntities24h: topEntityCounts.map((row) => ({
          entityType: row.key,
          count: row.count,
        })),
        topActors24h: topActorCounts,
        timeline24h: Array.from(hourly.entries()).map(([bucket, count]) => ({
          bucket,
          count,
        })),
      },
      integrations: {
        sentry: {
          configured: isConfigured(
            process.env.SENTRY_DSN,
            process.env.NEXT_PUBLIC_SENTRY_DSN,
            process.env.SENTRY_AUTH_TOKEN,
          ),
          environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV,
          release: process.env.SENTRY_RELEASE || null,
          apiReachable: sentryIssues.reachable,
          apiStatusCode: sentryIssues.statusCode,
          apiError: sentryIssues.error,
          missingConfig: sentryIssues.missingConfig,
          checkedAt: sentryIssues.checkedAt,
          unresolvedCount: sentryIssues.issues.length,
          issuesByLevel,
          issues: sentryIssues.issues,
        },
      },
    });
  } catch (error) {
    console.error("Monitoring overview error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
