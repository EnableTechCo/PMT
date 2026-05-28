import { Role } from "@/lib/db-types";
import { db } from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";
import {
  canAccessTeam,
  getClientRecordForUser,
  getUserWithTeamAccess,
} from "@/lib/access";
import type { NextRequest } from "next/server";

export async function getAuthorizedUser(request: NextRequest) {
  const sessionUser = await getUserFromRequest(request);
  if (!sessionUser) return null;
  return getUserWithTeamAccess(sessionUser.id);
}

export async function assertTicketReadable(
  user: NonNullable<Awaited<ReturnType<typeof getUserWithTeamAccess>>>,
  ticket: { id: string; clientId: string | null; teamId: string | null },
) {
  if (user.role === Role.CLIENT) {
    const client = await getClientRecordForUser(user);
    if (!client || ticket.clientId !== client.id) {
      return { ok: false as const, status: 404 as const };
    }
    return { ok: true as const };
  }
  if (ticket.teamId && !canAccessTeam(user, ticket.teamId)) {
    return { ok: false as const, status: 403 as const };
  }
  return { ok: true as const };
}

export async function loadTicketRow(id: string) {
  return db.ticket.findUnique({ where: { id } });
}
