import { db } from "@/lib/db";

const DEFAULT_SELECTOR_BASE = 10000;

function parseSelectorValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value);
  }

  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
}

export async function getNextTicketSelectorId() {
  const rows = await db.ticket.findMany({
    where: {
      selectorId: { not: null },
    },
    select: {
      selectorId: true,
    },
  });

  let maxSelector = DEFAULT_SELECTOR_BASE - 1;
  for (const row of rows as Array<{ selectorId?: unknown }>) {
    const value = parseSelectorValue(row.selectorId);
    if (value !== null && value > maxSelector) {
      maxSelector = value;
    }
  }

  return maxSelector + 1;
}

export async function backfillTicketSelectorIds() {
  const tickets = (await db.ticket.findMany({
    select: {
      id: true,
      selectorId: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  })) as Array<{ id: string; selectorId?: unknown }>;

  const used = new Set<number>();
  for (const ticket of tickets) {
    const value = parseSelectorValue(ticket.selectorId);
    if (value !== null) used.add(value);
  }

  let next = DEFAULT_SELECTOR_BASE;
  let updatedCount = 0;

  for (const ticket of tickets) {
    const existing = parseSelectorValue(ticket.selectorId);
    if (existing !== null) continue;

    while (used.has(next)) {
      next += 1;
    }

    await db.ticket.update({
      where: { id: ticket.id },
      data: { selectorId: next },
    });

    used.add(next);
    next += 1;
    updatedCount += 1;
  }

  return {
    total: tickets.length,
    updated: updatedCount,
  };
}

export function parseSelectorIdFromBranch(branch: string | null | undefined) {
  if (!branch || typeof branch !== "string") return null;
  const trimmed = branch.trim();

  // Match only the generated format: "<workType>/<selectorId>-<title>"
  // Example: "feat/10123-fix-login"
  const match = trimmed.match(/^[a-z]+\/(\d+)-/);
  if (!match) return null;
  return Number.parseInt(match[1], 10);
}
