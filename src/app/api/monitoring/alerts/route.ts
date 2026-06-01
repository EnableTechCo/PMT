import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { Role } from "@/lib/db-types";
import { createNotification } from "@/lib/ticketActivity";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      title?: string;
      body?: string;
      type?: string;
      ticketId?: string | null;
      userIds?: string[];
    };

    const title = typeof body.title === "string" ? body.title.trim() : "";
    if (!title) {
      return NextResponse.json({ error: "title is required" }, { status: 400 });
    }

    const notificationType =
      typeof body.type === "string" && body.type.trim()
        ? body.type.trim()
        : "MONITORING_ERROR";
    const message = typeof body.body === "string" ? body.body.trim() : "";
    const ticketId =
      typeof body.ticketId === "string" && body.ticketId ? body.ticketId : null;

    const explicitTargets = Array.isArray(body.userIds)
      ? body.userIds.filter((value): value is string => Boolean(value))
      : [];

    const targetIds =
      explicitTargets.length > 0
        ? explicitTargets
        : (
            await db.user.findMany({
              where: { role: Role.SUPER_ADMIN },
              select: { id: true },
            })
          ).map((user: { id: string }) => user.id);

    let created = 0;
    for (const userId of targetIds) {
      const existing = await db.notification.findFirst({
        where: {
          userId,
          type: notificationType,
          title,
          body: message || null,
          ticketId,
        },
        select: { id: true },
      });

      if (existing) continue;

      await createNotification({
        userId,
        type: notificationType,
        title,
        body: message || undefined,
        ticketId: ticketId || undefined,
      });
      created += 1;
    }

    return NextResponse.json({ ok: true, created });
  } catch (error) {
    console.error("Monitoring alert ingest error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
