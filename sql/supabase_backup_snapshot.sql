-- Backup snapshot table required for nightly backups + history + restore UI
-- Safe to run multiple times.

CREATE TABLE IF NOT EXISTS "BackupSnapshot" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  "triggerType" text NOT NULL,
  "generatedAt" timestamptz NOT NULL DEFAULT now(),
  "generatedById" uuid REFERENCES "User"(id) ON DELETE SET NULL,
  "generatedByEmail" text,
  "generatedByName" text,
  snapshot text NOT NULL,
  "tableCounts" text NOT NULL,
  "restoredAt" timestamptz,
  "restoredById" uuid REFERENCES "User"(id) ON DELETE SET NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_backups_generatedat ON "BackupSnapshot"("generatedAt");
CREATE INDEX IF NOT EXISTS idx_backups_trigger ON "BackupSnapshot"("triggerType");
CREATE INDEX IF NOT EXISTS idx_backups_createdat ON "BackupSnapshot"("createdAt");
