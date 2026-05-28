import { NextRequest, NextResponse } from "next/server";
import { Role } from "@/lib/db-types";
import { db } from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";

function isInternalStaff(role: Role) {
  return role === Role.USER || role === Role.SUPER_ADMIN;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!isInternalStaff(user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();

    const existing = await db.client.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    const data: { name?: string; email?: string; isInvited?: boolean } = {};

    if (typeof body.name === "string") {
      const trimmed = body.name.trim();
      if (!trimmed) {
        return NextResponse.json(
          { error: "Client name cannot be empty" },
          { status: 400 },
        );
      }
      data.name = trimmed;
    }

    if (typeof body.email === "string") {
      const email = body.email.trim().toLowerCase();
      if (!email) {
        return NextResponse.json(
          { error: "Email cannot be empty" },
          { status: 400 },
        );
      }
      const duplicate = await db.client.findUnique({ where: { email } });
      if (duplicate && duplicate.id !== id) {
        return NextResponse.json(
          { error: "Another client already uses this email" },
          { status: 400 },
        );
      }
      data.email = email;
    }

    if (typeof body.isInvited === "boolean") {
      data.isInvited = body.isInvited;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 },
      );
    }

    const updated = await db.client.update({
      where: { id },
      data,
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Update client error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!isInternalStaff(user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    const existing = await db.client.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({
        success: true,
        alreadyDeleted: true,
      });
    }

    const [projectCount, ticketCount] = await Promise.all([
      db.project.count({ where: { clientId: id } }),
      db.ticket.count({ where: { clientId: id } }),
    ]);

    if (projectCount > 0 || ticketCount > 0) {
      return NextResponse.json(
        {
          error:
            "Cannot delete client with linked projects or tickets. Reassign or remove those records first.",
        },
        { status: 400 },
      );
    }

    await db.client.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete client error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
