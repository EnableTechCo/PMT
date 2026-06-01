import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthorizedUser } from "@/lib/ticketAccess";
import { Role } from "@/lib/db-types";

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthorizedUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const isSuperAdmin = user.role === Role.SUPER_ADMIN;

    const items = await db.notification.findMany({
      where: isSuperAdmin ? undefined : { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: isSuperAdmin ? 200 : 80,
    });

    return NextResponse.json(items);
  } catch (e) {
    console.error("Notifications GET:", e);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await getAuthorizedUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const isSuperAdmin = user.role === Role.SUPER_ADMIN;

    const body = (await request.json()) as {
      markAllRead?: boolean;
      ids?: string[];
    };

    if (body.markAllRead) {
      await db.notification.updateMany({
        where: isSuperAdmin
          ? { read: false }
          : { userId: user.id, read: false },
        data: { read: true },
      });
      return NextResponse.json({ ok: true });
    }

    if (Array.isArray(body.ids) && body.ids.length > 0) {
      await db.notification.updateMany({
        where: isSuperAdmin
          ? { id: { in: body.ids } }
          : { userId: user.id, id: { in: body.ids } },
        data: { read: true },
      });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "No operation" }, { status: 400 });
  } catch (e) {
    console.error("Notifications PATCH:", e);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
