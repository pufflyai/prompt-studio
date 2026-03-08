CREATE TYPE "ticket_complexity" AS ENUM ('low', 'medium', 'high');--> statement-breakpoint
CREATE TYPE "session_status" AS ENUM ('in_progress', 'awaiting_input', 'completed', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "workspace_status" AS ENUM ('active', 'merged', 'rejected');--> statement-breakpoint

UPDATE "tickets"
SET "complexity" = NULL
WHERE "complexity" IS NOT NULL
  AND "complexity" NOT IN ('low', 'medium', 'high');--> statement-breakpoint

ALTER TABLE "tickets"
ALTER COLUMN "complexity" TYPE "ticket_complexity"
USING "complexity"::"ticket_complexity";--> statement-breakpoint

UPDATE "sessions"
SET "status" = 'in_progress'
WHERE "status" IS NULL
  OR "status" NOT IN ('in_progress', 'awaiting_input', 'completed', 'failed', 'cancelled');--> statement-breakpoint

ALTER TABLE "sessions" ALTER COLUMN "status" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "sessions"
ALTER COLUMN "status" TYPE "session_status"
USING "status"::"session_status";--> statement-breakpoint
ALTER TABLE "sessions" ALTER COLUMN "status" SET DEFAULT 'in_progress';--> statement-breakpoint

UPDATE "workspaces"
SET "status" = 'active'
WHERE "status" IS NULL
  OR "status" NOT IN ('active', 'merged', 'rejected');--> statement-breakpoint

ALTER TABLE "workspaces" ALTER COLUMN "status" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "workspaces"
ALTER COLUMN "status" TYPE "workspace_status"
USING "status"::"workspace_status";--> statement-breakpoint
ALTER TABLE "workspaces" ALTER COLUMN "status" SET DEFAULT 'active';
