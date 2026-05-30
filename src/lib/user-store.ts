import { type Client, type Role, type User } from "@/lib/db-types";
import { createSupabaseAdminClient } from "@/lib/supabase";

type UserRow = Omit<User, "createdAt" | "updatedAt"> & {
  createdAt: string | Date;
  updatedAt: string | Date;
};

type ClientRow = Omit<Client, "createdAt" | "updatedAt"> & {
  createdAt: string | Date;
  updatedAt: string | Date;
};

type TeamMembershipRow = {
  teamId: string;
};

type CreateUserInput = {
  email: string;
  password: string;
  name: string;
  role: Role;
  teamId?: string | null;
  phone?: string | null;
  githubToken?: string | null;
};

type UpdateUserInput = Partial<
  Pick<User, "password" | "name" | "role" | "teamId" | "phone" | "githubToken">
>;

function toDate(value: string | Date): Date {
  return value instanceof Date ? value : new Date(value);
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function mapUser(row: UserRow): User {
  return {
    ...row,
    createdAt: toDate(row.createdAt),
    updatedAt: toDate(row.updatedAt),
  };
}

function mapClient(row: ClientRow): Client {
  return {
    ...row,
    createdAt: toDate(row.createdAt),
    updatedAt: toDate(row.updatedAt),
  };
}

type SupabaseErrorLike = {
  code?: string;
  message?: string;
  details?: string | null;
  hint?: string | null;
};

function normalizeSupabaseError(error: unknown): Error {
  const supabaseError = error as SupabaseErrorLike;
  const message =
    supabaseError?.message ||
    supabaseError?.details ||
    `Database error: ${JSON.stringify(error)}`;

  if (
    typeof message === "string" &&
    /Could not find the table/i.test(message)
  ) {
    const schemaError = new Error(
      "Ooops!!! Something went wrong. Try refreshing the page. If the problem persists, please contact support.",
    );
    schemaError.name = "DatabaseSchemaError";
    return schemaError;
  }

  const normalized = new Error(message);
  normalized.name = supabaseError?.code || "SupabaseError";
  return normalized;
}

export async function findUserById(userId: string): Promise<User | null> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("User")
    .select("*")
    .eq("id", userId)
    .maybeSingle<UserRow>();

  if (error) throw normalizeSupabaseError(error);
  return data ? mapUser(data) : null;
}

export async function findUserByEmail(email: string): Promise<User | null> {
  const supabase = createSupabaseAdminClient();
  const normalizedEmail = normalizeEmail(email);
  const { data, error } = await supabase
    .from("User")
    .select("*")
    .ilike("email", normalizedEmail)
    .maybeSingle<UserRow>();

  if (error) throw normalizeSupabaseError(error);
  return data ? mapUser(data) : null;
}

export async function findUserTeamMemberships(
  userId: string,
): Promise<TeamMembershipRow[]> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("TeamMembership")
    .select("teamId")
    .eq("userId", userId)
    .returns<TeamMembershipRow[]>();

  if (error) throw normalizeSupabaseError(error);
  return data ?? [];
}

export async function findClientByEmail(email: string): Promise<Client | null> {
  const supabase = createSupabaseAdminClient();
  const normalizedEmail = normalizeEmail(email);
  const { data, error } = await supabase
    .from("Client")
    .select("*")
    .ilike("email", normalizedEmail)
    .maybeSingle<ClientRow>();

  if (error) throw normalizeSupabaseError(error);
  return data ? mapClient(data) : null;
}

export async function countUsers(): Promise<number> {
  const supabase = createSupabaseAdminClient();
  const { count, error } = await supabase
    .from("User")
    .select("id", { count: "exact", head: true });

  if (error) throw normalizeSupabaseError(error);
  return count ?? 0;
}

export async function updateUserGithubToken(
  userId: string,
  githubToken: string | null,
) {
  await updateUser(userId, { githubToken });
}

export async function updateUser(userId: string, updates: UpdateUserInput) {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("User")
    .update(updates)
    .eq("id", userId);

  if (error) throw normalizeSupabaseError(error);
}

export async function createUser(input: CreateUserInput): Promise<User> {
  const supabase = createSupabaseAdminClient();
  const payload = {
    email: normalizeEmail(input.email),
    password: input.password,
    name: input.name,
    role: input.role,
    teamId: input.teamId ?? null,
    phone: input.phone ?? null,
    githubToken: input.githubToken ?? null,
  };

  const { data, error } = await supabase
    .from("User")
    .insert(payload)
    .select("*")
    .single<UserRow>();

  if (error) throw normalizeSupabaseError(error);
  return mapUser(data);
}
