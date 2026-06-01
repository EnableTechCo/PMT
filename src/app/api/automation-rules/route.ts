import { NextRequest, NextResponse } from "next/server";
import { Role } from "@/lib/db-types";
import { db } from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";

function canManageAutomation(role: Role | undefined) {
  return role === Role.USER || role === Role.SUPER_ADMIN;
}

export async function GET(request: NextRequest) {
  try {
    const session = await getUserFromRequest(request);
    if (!session || !canManageAutomation(session.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const rows = await db.automationRule.findMany({
      orderBy: { updatedAt: "desc" },
    });
    return NextResponse.json(rows);
  } catch (error) {
    console.error("Automation list error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getUserFromRequest(request);
    if (!session || !canManageAutomation(session.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const trigger = typeof body.trigger === "string" ? body.trigger.trim() : "";
    const action = typeof body.action === "string" ? body.action.trim() : "";
    if (!name || !trigger || !action) {
      return NextResponse.json(
        { error: "name, trigger, and action are required (JSON strings)" },
        { status: 400 },
      );
    }

    const rule = await db.automationRule.create({
      data: {
        name,
        trigger,
        action,
        teamId: typeof body.teamId === "string" ? body.teamId : undefined,
        enabled: body.enabled !== false,
      },
    });

    await writeAuditLog({
      actorId: session.id,
      action: "AUTOMATION_CREATE",
      entityType: "AutomationRule",
      entityId: rule.id,
      metadata: { name },
    });

    return NextResponse.json(rule, { status: 201 });
  } catch (error) {
    console.error("Automation create error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
