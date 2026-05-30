-- Repair script for existing Supabase databases created before full schema constraints.
-- This adds missing columns/foreign keys required by PostgREST relation embedding.
-- Run in Supabase SQL editor, then retry /api/projects.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
  -- Ensure optional User profile fields exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'User' AND column_name = 'phone'
  ) THEN
    ALTER TABLE "User" ADD COLUMN phone text;
  END IF;

  -- Ensure Project relation columns exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'Project' AND column_name = 'teamId'
  ) THEN
    ALTER TABLE "Project" ADD COLUMN "teamId" uuid;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'Project' AND column_name = 'portfolioId'
  ) THEN
    ALTER TABLE "Project" ADD COLUMN "portfolioId" uuid;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'Project' AND column_name = 'clientId'
  ) THEN
    ALTER TABLE "Project" ADD COLUMN "clientId" uuid;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'Project' AND column_name = 'teamDescription'
  ) THEN
    ALTER TABLE "Project" ADD COLUMN "teamDescription" text;
  END IF;

  -- Project -> Team
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'project_team_fkey'
      AND conrelid = '"Project"'::regclass
  ) THEN
    ALTER TABLE "Project"
      ADD CONSTRAINT project_team_fkey
      FOREIGN KEY ("teamId") REFERENCES "Team"(id) ON DELETE CASCADE;
  END IF;

  -- Project -> Portfolio
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'project_portfolio_fkey'
      AND conrelid = '"Project"'::regclass
  ) THEN
    ALTER TABLE "Project"
      ADD CONSTRAINT project_portfolio_fkey
      FOREIGN KEY ("portfolioId") REFERENCES "Portfolio"(id) ON DELETE SET NULL;
  END IF;

  -- Project -> Client
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'project_client_fkey'
      AND conrelid = '"Project"'::regclass
  ) THEN
    ALTER TABLE "Project"
      ADD CONSTRAINT project_client_fkey
      FOREIGN KEY ("clientId") REFERENCES "Client"(id) ON DELETE SET NULL;
  END IF;

  -- Ensure Milestone.projectId exists + FK (needed for include/count on milestones)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'Milestone' AND column_name = 'projectId'
  ) THEN
    ALTER TABLE "Milestone" ADD COLUMN "projectId" uuid;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'milestone_project_fkey'
      AND conrelid = '"Milestone"'::regclass
  ) THEN
    ALTER TABLE "Milestone"
      ADD CONSTRAINT milestone_project_fkey
      FOREIGN KEY ("projectId") REFERENCES "Project"(id) ON DELETE CASCADE;
  END IF;

  -- Ensure Ticket.projectId exists + FK (needed for include/count on tickets)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'Ticket' AND column_name = 'creatorId'
  ) THEN
    ALTER TABLE "Ticket" ADD COLUMN "creatorId" uuid;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'Ticket' AND column_name = 'assigneeId'
  ) THEN
    ALTER TABLE "Ticket" ADD COLUMN "assigneeId" uuid;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'Ticket' AND column_name = 'teamId'
  ) THEN
    ALTER TABLE "Ticket" ADD COLUMN "teamId" uuid;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'Ticket' AND column_name = 'clientId'
  ) THEN
    ALTER TABLE "Ticket" ADD COLUMN "clientId" uuid;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'Ticket' AND column_name = 'projectId'
  ) THEN
    ALTER TABLE "Ticket" ADD COLUMN "projectId" uuid;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'Ticket' AND column_name = 'acceptanceCriteria'
  ) THEN
    ALTER TABLE "Ticket" ADD COLUMN "acceptanceCriteria" text;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ticket_creator_fkey'
      AND conrelid = '"Ticket"'::regclass
  ) THEN
    ALTER TABLE "Ticket"
      ADD CONSTRAINT ticket_creator_fkey
      FOREIGN KEY ("creatorId") REFERENCES "User"(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ticket_assignee_fkey'
      AND conrelid = '"Ticket"'::regclass
  ) THEN
    ALTER TABLE "Ticket"
      ADD CONSTRAINT ticket_assignee_fkey
      FOREIGN KEY ("assigneeId") REFERENCES "User"(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ticket_team_fkey'
      AND conrelid = '"Ticket"'::regclass
  ) THEN
    ALTER TABLE "Ticket"
      ADD CONSTRAINT ticket_team_fkey
      FOREIGN KEY ("teamId") REFERENCES "Team"(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ticket_client_fkey'
      AND conrelid = '"Ticket"'::regclass
  ) THEN
    ALTER TABLE "Ticket"
      ADD CONSTRAINT ticket_client_fkey
      FOREIGN KEY ("clientId") REFERENCES "Client"(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ticket_project_fkey'
      AND conrelid = '"Ticket"'::regclass
  ) THEN
    ALTER TABLE "Ticket"
      ADD CONSTRAINT ticket_project_fkey
      FOREIGN KEY ("projectId") REFERENCES "Project"(id) ON DELETE SET NULL;
  END IF;

  -- Helpful indexes
  CREATE INDEX IF NOT EXISTS idx_project_team_repair ON "Project"("teamId");
  CREATE INDEX IF NOT EXISTS idx_project_portfolio_repair ON "Project"("portfolioId");
  CREATE INDEX IF NOT EXISTS idx_project_client_repair ON "Project"("clientId");
  CREATE INDEX IF NOT EXISTS idx_milestone_project_repair ON "Milestone"("projectId");
  CREATE INDEX IF NOT EXISTS idx_ticket_creator_repair ON "Ticket"("creatorId");
  CREATE INDEX IF NOT EXISTS idx_ticket_assignee_repair ON "Ticket"("assigneeId");
  CREATE INDEX IF NOT EXISTS idx_ticket_team_repair ON "Ticket"("teamId");
  CREATE INDEX IF NOT EXISTS idx_ticket_client_repair ON "Ticket"("clientId");
  CREATE INDEX IF NOT EXISTS idx_ticket_project_repair ON "Ticket"("projectId");
END;
$$;

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

CREATE INDEX IF NOT EXISTS idx_githubrepo_project_repair ON "GithubRepo"("projectId");

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'Ticket'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE "Ticket";
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'Project'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE "Project";
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'Client'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE "Client";
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'Milestone'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE "Milestone";
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'Notification'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE "Notification";
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'Team'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE "Team";
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'Portfolio'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE "Portfolio";
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'GithubRepo'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE "GithubRepo";
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'Document'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE "Document";
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'TeamMembership'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE "TeamMembership";
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'GithubBranch'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE "GithubBranch";
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'GithubPullRequest'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE "GithubPullRequest";
    END IF;
  END IF;
END;
$$;

-- Ask PostgREST to reload schema cache so new relationships are available immediately.
NOTIFY pgrst, 'reload schema';
