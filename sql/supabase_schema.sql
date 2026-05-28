-- Full Supabase/Postgres schema for Project Management Tool
-- Safe to run multiple times (uses IF NOT EXISTS guards where possible).

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'role') THEN
    CREATE TYPE role AS ENUM ('USER', 'CLIENT', 'SUPER_ADMIN');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ticket_status') THEN
    CREATE TYPE ticket_status AS ENUM (
      'BACKLOG',
      'TODO',
      'REFINE',
      'IN_PROGRESS',
      'REVISIONS',
      'CLIENT_REVIEW',
      'COMPLETE'
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ticket_priority') THEN
    CREATE TYPE ticket_priority AS ENUM (
      'NONE',
      'LOW',
      'MEDIUM',
      'HIGH',
      'URGENT'
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'project_status') THEN
    CREATE TYPE project_status AS ENUM (
      'PLANNING',
      'ACTIVE',
      'ON_HOLD',
      'COMPLETE',
      'ARCHIVED'
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'project_health') THEN
    CREATE TYPE project_health AS ENUM ('GREEN', 'AMBER', 'RED');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "Team" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "User" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  password text NOT NULL DEFAULT '',
  name text NOT NULL,
  role role NOT NULL DEFAULT 'USER',
  "teamId" uuid REFERENCES "Team"(id) ON DELETE SET NULL,
  "githubToken" text,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "Client" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL UNIQUE,
  "isInvited" boolean NOT NULL DEFAULT false,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "TeamMembership" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" uuid NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  "teamId" uuid NOT NULL REFERENCES "Team"(id) ON DELETE CASCADE,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  UNIQUE ("userId", "teamId")
);

CREATE TABLE IF NOT EXISTS "Portfolio" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "Project" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  "teamDescription" text,
  status project_status,
  health project_health,
  progress integer NOT NULL DEFAULT 0,
  "teamId" uuid NOT NULL REFERENCES "Team"(id) ON DELETE CASCADE,
  "portfolioId" uuid REFERENCES "Portfolio"(id) ON DELETE SET NULL,
  "clientId" uuid REFERENCES "Client"(id) ON DELETE SET NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "Milestone" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "projectId" uuid NOT NULL REFERENCES "Project"(id) ON DELETE CASCADE,
  title text NOT NULL,
  "dueDate" timestamptz,
  "completedAt" timestamptz,
  "sortOrder" integer NOT NULL DEFAULT 0,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "Ticket" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  "acceptanceCriteria" text,
  status ticket_status NOT NULL DEFAULT 'BACKLOG',
  priority ticket_priority NOT NULL DEFAULT 'MEDIUM',
  "creatorId" uuid NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  "assigneeId" uuid REFERENCES "User"(id) ON DELETE SET NULL,
  "clientId" uuid REFERENCES "Client"(id) ON DELETE SET NULL,
  "teamId" uuid NOT NULL REFERENCES "Team"(id) ON DELETE CASCADE,
  "projectId" uuid REFERENCES "Project"(id) ON DELETE SET NULL,
  "startDate" timestamptz,
  "dueDate" timestamptz,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "TicketComment" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "ticketId" uuid NOT NULL REFERENCES "Ticket"(id) ON DELETE CASCADE,
  "authorId" uuid NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  body text NOT NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "TicketAttachment" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "ticketId" uuid NOT NULL REFERENCES "Ticket"(id) ON DELETE CASCADE,
  "uploadedById" uuid NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  filename text NOT NULL,
  "mimeType" text,
  size integer NOT NULL,
  url text NOT NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "TicketChecklistItem" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "ticketId" uuid NOT NULL REFERENCES "Ticket"(id) ON DELETE CASCADE,
  title text NOT NULL,
  completed boolean NOT NULL DEFAULT false,
  "sortOrder" integer NOT NULL DEFAULT 0,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "TicketActivity" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "ticketId" uuid NOT NULL REFERENCES "Ticket"(id) ON DELETE CASCADE,
  "actorId" uuid NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  type text NOT NULL,
  summary text NOT NULL,
  metadata text,
  "createdAt" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "AuditLog" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "actorId" uuid NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  action text NOT NULL,
  "entityType" text NOT NULL,
  "entityId" text NOT NULL,
  metadata text,
  "createdAt" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "Document" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  content text,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "AutomationRule" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  "trigger" text NOT NULL,
  action text NOT NULL,
  "teamId" uuid REFERENCES "Team"(id) ON DELETE SET NULL,
  enabled boolean NOT NULL DEFAULT true,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "GithubBranch" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "ticketId" uuid NOT NULL REFERENCES "Ticket"(id) ON DELETE CASCADE,
  name text NOT NULL,
  url text NOT NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  UNIQUE ("ticketId", name)
);

CREATE TABLE IF NOT EXISTS "GithubPullRequest" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "ticketId" uuid NOT NULL REFERENCES "Ticket"(id) ON DELETE CASCADE,
  number integer NOT NULL,
  title text NOT NULL,
  url text NOT NULL,
  state text NOT NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  UNIQUE ("ticketId", number)
);

CREATE TABLE IF NOT EXISTS "GithubRepo" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "projectId" uuid NOT NULL REFERENCES "Project"(id) ON DELETE CASCADE,
  owner text NOT NULL,
  name text NOT NULL,
  url text NOT NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  UNIQUE ("projectId", owner, name)
);

CREATE TABLE IF NOT EXISTS "Notification" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" uuid NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  body text,
  "ticketId" uuid REFERENCES "Ticket"(id) ON DELETE SET NULL,
  read boolean NOT NULL DEFAULT false,
  "createdAt" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "SavedView" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" uuid NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  name text NOT NULL,
  "teamId" uuid REFERENCES "Team"(id) ON DELETE SET NULL,
  filters text NOT NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "OrganizationSettings" (
  id text PRIMARY KEY DEFAULT 'default',
  "ssoEnabled" boolean NOT NULL DEFAULT false,
  "ssoProvider" text,
  "allowedIpRaw" text,
  "dataRetentionDays" integer,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "PasswordReset" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL UNIQUE,
  "userId" uuid NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  "expiresAt" timestamptz NOT NULL,
  used boolean NOT NULL DEFAULT false,
  "createdAt" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "InviteToken" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL UNIQUE,
  email text NOT NULL,
  role role NOT NULL DEFAULT 'USER',
  "expiresAt" timestamptz NOT NULL,
  used boolean NOT NULL DEFAULT false,
  "createdBy" uuid REFERENCES "User"(id) ON DELETE SET NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ticket_team ON "Ticket"("teamId");
CREATE INDEX IF NOT EXISTS idx_ticket_creator ON "Ticket"("creatorId");
CREATE INDEX IF NOT EXISTS idx_ticket_assignee ON "Ticket"("assigneeId");
CREATE INDEX IF NOT EXISTS idx_ticket_client ON "Ticket"("clientId");
CREATE INDEX IF NOT EXISTS idx_ticket_project ON "Ticket"("projectId");
CREATE INDEX IF NOT EXISTS idx_ticket_status ON "Ticket"(status);
CREATE INDEX IF NOT EXISTS idx_ticket_priority ON "Ticket"(priority);
CREATE INDEX IF NOT EXISTS idx_project_team ON "Project"("teamId");
CREATE INDEX IF NOT EXISTS idx_project_client ON "Project"("clientId");
CREATE INDEX IF NOT EXISTS idx_project_portfolio ON "Project"("portfolioId");
CREATE INDEX IF NOT EXISTS idx_milestone_project ON "Milestone"("projectId");
CREATE INDEX IF NOT EXISTS idx_comment_ticket ON "TicketComment"("ticketId");
CREATE INDEX IF NOT EXISTS idx_attachment_ticket ON "TicketAttachment"("ticketId");
CREATE INDEX IF NOT EXISTS idx_checklist_ticket ON "TicketChecklistItem"("ticketId");
CREATE INDEX IF NOT EXISTS idx_activity_ticket ON "TicketActivity"("ticketId");
CREATE INDEX IF NOT EXISTS idx_activity_actor ON "TicketActivity"("actorId");
CREATE INDEX IF NOT EXISTS idx_audit_actor ON "AuditLog"("actorId");
CREATE INDEX IF NOT EXISTS idx_notification_user ON "Notification"("userId");
CREATE INDEX IF NOT EXISTS idx_saved_view_user ON "SavedView"("userId");
CREATE INDEX IF NOT EXISTS idx_passwordreset_user ON "PasswordReset"("userId");
CREATE INDEX IF NOT EXISTS idx_passwordreset_token ON "PasswordReset"(token);
CREATE INDEX IF NOT EXISTS idx_invitetoken_email ON "InviteToken"(email);
CREATE INDEX IF NOT EXISTS idx_invitetoken_expiresat ON "InviteToken"("expiresAt");

INSERT INTO "OrganizationSettings" (id)
VALUES ('default')
ON CONFLICT (id) DO NOTHING;
