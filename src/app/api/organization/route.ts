import { NextRequest, NextResponse } from "next/server";
import { Role } from "@/lib/db-types";
import { db } from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";

export async function GET(request: NextRequest) {
  try {
    const session = await getUserFromRequest(request);
    if (!session || session.role === Role.CLIENT) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const settings = await db.organizationSettings.findUnique({
      where: { id: "default" },
    });
    const safe = settings ?? {
      id: "default",
      ssoEnabled: false,
      ssoProvider: null,
      allowedIpRaw: null,
      dataRetentionDays: null,
    };
    return NextResponse.json(safe);
  } catch (error) {
    console.error("Organization GET error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await getUserFromRequest(request);
    if (!session || session.role !== Role.SUPER_ADMIN) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const data: {
      ssoEnabled?: boolean;
      ssoProvider?: string | null;
      allowedIpRaw?: string | null;
      dataRetentionDays?: number | null;
    } = {};

    if (typeof body.ssoEnabled === "boolean") data.ssoEnabled = body.ssoEnabled;
    if (body.ssoProvider === null || typeof body.ssoProvider === "string") {
      data.ssoProvider = body.ssoProvider;
    }
    if (body.allowedIpRaw === null || typeof body.allowedIpRaw === "string") {
      data.allowedIpRaw = body.allowedIpRaw;
    }
    if (body.dataRetentionDays === null) data.dataRetentionDays = null;
    else if (typeof body.dataRetentionDays === "number") {
      data.dataRetentionDays = body.dataRetentionDays;
    }

    const settings = await db.organizationSettings.upsert({
      where: { id: "default" },
      create: { id: "default", ...data },
      update: data,
    });

    await writeAuditLog({
      actorId: session.id,
      action: "ORG_SETTINGS_UPDATE",
      entityType: "OrganizationSettings",
      entityId: "default",
      metadata: data as Record<string, unknown>,
    });

    return NextResponse.json(settings);
  } catch (error) {
    console.error("Organization PATCH error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
