import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  normalizeNotificationPreferences,
} from "@/lib/notification-preferences";

type Row = {
  userId: string;
  preferences: string;
  createdAt?: string;
  updatedAt?: string;
};

async function loadUserPreferences(userId: string) {
  const row = (await db.userNotificationPreference.findUnique({
    where: { userId },
  })) as Row | null;

  if (!row?.preferences) return DEFAULT_NOTIFICATION_PREFERENCES;

  try {
    const parsed = JSON.parse(row.preferences) as unknown;
    return normalizeNotificationPreferences(parsed);
  } catch {
    return DEFAULT_NOTIFICATION_PREFERENCES;
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const preferences = await loadUserPreferences(user.id);

    return NextResponse.json({ preferences });
  } catch (error) {
    console.error("Settings notifications GET error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json().catch(() => null)) as {
      preferences?: unknown;
    } | null;

    const preferences = normalizeNotificationPreferences(body?.preferences);
    const serialized = JSON.stringify(preferences);

    const existing = (await db.userNotificationPreference.findUnique({
      where: { userId: user.id },
      select: { userId: true },
    })) as { userId: string } | null;

    if (existing) {
      await db.userNotificationPreference.update({
        where: { userId: user.id },
        data: {
          preferences: serialized,
          updatedAt: new Date().toISOString(),
        },
      });
    } else {
      await db.userNotificationPreference.create({
        data: {
          userId: user.id,
          preferences: serialized,
        },
      });
    }

    return NextResponse.json({ ok: true, preferences });
  } catch (error) {
    console.error("Settings notifications PATCH error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
