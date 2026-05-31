import { Role } from "@/lib/db-types";
import {
  canAccessTeam,
  teamIdsForUser,
  type UserWithMemberships,
} from "@/lib/access";

function makeUser(
  overrides: Partial<UserWithMemberships>,
): UserWithMemberships {
  return {
    id: "u1",
    email: "user@example.com",
    password: "hash",
    name: "User",
    phone: null,
    role: Role.USER,
    teamId: null,
    githubToken: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    teamMemberships: [],
    ...overrides,
  };
}

describe("teamIdsForUser", () => {
  it("returns null for super admin", () => {
    const user = makeUser({ role: Role.SUPER_ADMIN });
    expect(teamIdsForUser(user)).toBeNull();
  });

  it("deduplicates team ids from memberships and primary team", () => {
    const user = makeUser({
      teamId: "team-1",
      teamMemberships: [{ teamId: "team-1" }, { teamId: "team-2" }],
    });

    const ids = teamIdsForUser(user);
    expect(ids).toEqual(expect.arrayContaining(["team-1", "team-2"]));
    expect(ids).toHaveLength(2);
  });
});

describe("canAccessTeam", () => {
  it("allows super admin for any team", () => {
    const user = makeUser({ role: Role.SUPER_ADMIN });
    expect(canAccessTeam(user, "any-team")).toBe(true);
  });

  it("blocks client role", () => {
    const user = makeUser({ role: Role.CLIENT });
    expect(canAccessTeam(user, "team-1")).toBe(false);
  });

  it("allows only assigned teams for regular users", () => {
    const user = makeUser({ teamMemberships: [{ teamId: "team-1" }] });
    expect(canAccessTeam(user, "team-1")).toBe(true);
    expect(canAccessTeam(user, "team-2")).toBe(false);
  });
});
