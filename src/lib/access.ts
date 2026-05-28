import { Role, type User } from "@/lib/db-types";
import {
  findClientByEmail,
  findUserById,
  findUserTeamMemberships,
} from "@/lib/user-store";

export type UserWithMemberships = User & {
  teamMemberships: { teamId: string }[];
};

export async function getUserWithTeamAccess(
  userId: string,
): Promise<UserWithMemberships | null> {
  const user = await findUserById(userId);
  if (!user) return null;

  const teamMemberships = await findUserTeamMemberships(userId);
  return {
    ...user,
    teamMemberships,
  };
}

/** null means all teams (super admin). Empty array means no team access. */
export function teamIdsForUser(user: UserWithMemberships): string[] | null {
  if (user.role === Role.SUPER_ADMIN) return null;
  const ids = new Set<string>();
  for (const m of user.teamMemberships) ids.add(m.teamId);
  if (user.teamId) ids.add(user.teamId);
  return Array.from(ids);
}

export function canAccessTeam(
  user: UserWithMemberships,
  teamId: string,
): boolean {
  if (user.role === Role.SUPER_ADMIN) return true;
  if (user.role === Role.CLIENT) return false;
  const ids = teamIdsForUser(user);
  if (ids === null) return true;
  return ids.includes(teamId);
}

export async function getClientRecordForUser(user: UserWithMemberships) {
  if (user.role !== Role.CLIENT) return null;
  return findClientByEmail(user.email);
}
