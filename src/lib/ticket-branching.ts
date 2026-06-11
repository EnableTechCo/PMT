import { db } from "@/lib/db";

export const WORK_TYPE_OPTIONS = [
  "feat",
  "fix",
  "bugfix",
  "chore",
  "docs",
  "refactor",
  "test",
  "perf",
  "hotfix",
] as const;

export type WorkType = (typeof WORK_TYPE_OPTIONS)[number];

export const DEFAULT_WORK_TYPE: WorkType = "chore";

const WORK_TYPE_SET = new Set<string>(WORK_TYPE_OPTIONS);

export function normalizeWorkType(value: unknown): WorkType {
  if (typeof value !== "string") {
    return DEFAULT_WORK_TYPE;
  }

  const normalized = value.trim().toLowerCase();
  if (WORK_TYPE_SET.has(normalized)) {
    return normalized as WorkType;
  }

  return DEFAULT_WORK_TYPE;
}

export function slugifyBranchTitle(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }

  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

export function buildTicketBranchName(input: {
  workType: string;
  selectorId?: number | null;
  title?: unknown;
}): string {
  const workType = normalizeWorkType(input.workType);
  const selectorPart =
    typeof input.selectorId === "number" && Number.isFinite(input.selectorId)
      ? String(Math.trunc(input.selectorId))
      : "ticket";
  const titlePart = slugifyBranchTitle(input.title) || "update";

  return `${workType}/${selectorPart}-${titlePart}`;
}

export function buildTicketBranchCommands(input: {
  workType: string;
  selectorId?: number | null;
  title?: unknown;
}) {
  const branchName = buildTicketBranchName(input);
  return {
    branchName,
    commands: [
      "git checkout develop",
      "git pull origin develop",
      `git checkout -b ${branchName}`,
    ],
  };
}

export async function backfillTicketWorkTypes() {
  const tickets = (await db.ticket.findMany({
    select: {
      id: true,
      workType: true,
    },
    orderBy: { createdAt: "asc" },
  })) as Array<{ id: string; workType?: unknown }>;

  let updatedCount = 0;

  for (const ticket of tickets) {
    const normalized = normalizeWorkType(ticket.workType);
    if (ticket.workType === normalized) {
      continue;
    }

    await db.ticket.update({
      where: { id: ticket.id },
      data: { workType: normalized },
    });

    updatedCount += 1;
  }

  return {
    total: tickets.length,
    updated: updatedCount,
  };
}
