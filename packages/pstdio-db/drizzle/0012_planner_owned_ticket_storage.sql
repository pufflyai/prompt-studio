ALTER TABLE "workspaces" ADD COLUMN IF NOT EXISTS "anchors_json" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
DROP TABLE IF EXISTS "workspace_artifacts" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "ticket_files" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "ticket_workspaces" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "ticket_tag_assignments" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "ticket_tag_options" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "ticket_tags" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "tickets" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "ticket_statuses" CASCADE;
