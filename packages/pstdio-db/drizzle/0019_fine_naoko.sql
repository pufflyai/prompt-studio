ALTER TABLE "attempt_statuses" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "ticket_statuses" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "ticket_tag_assignments" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "ticket_tag_options" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "ticket_tags" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "ticket_files" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "tickets" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "ticket_workspaces" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "workspace_artifacts" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "attempt_statuses" CASCADE;--> statement-breakpoint
DROP TABLE "ticket_statuses" CASCADE;--> statement-breakpoint
DROP TABLE "ticket_tag_assignments" CASCADE;--> statement-breakpoint
DROP TABLE "ticket_tag_options" CASCADE;--> statement-breakpoint
DROP TABLE "ticket_tags" CASCADE;--> statement-breakpoint
DROP TABLE "ticket_files" CASCADE;--> statement-breakpoint
DROP TABLE "tickets" CASCADE;--> statement-breakpoint
DROP TABLE "ticket_workspaces" CASCADE;--> statement-breakpoint
DROP TABLE "workspace_artifacts" CASCADE;--> statement-breakpoint
ALTER TABLE "workspaces" DROP CONSTRAINT IF EXISTS "workspaces_attempt_status_id_attempt_statuses_id_fk";
--> statement-breakpoint
ALTER TABLE "workspaces" DROP COLUMN "attempt_status_id";
