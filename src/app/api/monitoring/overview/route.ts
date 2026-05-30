import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { Role } from "@/lib/db-types";
import { db } from "@/lib/db";
import { countUsers } from "@/lib/user-store";

function isConfigured(...values: Array<string | undefined>) {
  return values.some((value) => Boolean(value && value.trim().length > 0));
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

    const [userCount, auditLogs] = await Promise.all([
      countUsers(),
      db.auditLog.findMany({
        orderBy: { createdAt: "desc" },
        take: 12,
        include: {
          actor: { select: { id: true, name: true, email: true, role: true } },
        },
      }),
    ]);

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
      integrations: {
        sentry: {
          configured: isConfigured(
            process.env.SENTRY_DSN,
            process.env.NEXT_PUBLIC_SENTRY_DSN,
            process.env.SENTRY_AUTH_TOKEN,
          ),
          environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV,
          release: process.env.SENTRY_RELEASE || null,
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
